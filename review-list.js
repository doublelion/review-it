/**
 * @Project: Review-It Universal Board List Engine v1.0.9 (UX Patch)
 * @Role: Cafe24 Review SaaS Lead Developer
 * @Update: 
 *  1. [클린업] 맥 에디터 쓰레기 태그(p.p1, span.s1 등) 리스트 프리뷰 완벽 정제 로직
 *  2. [UI/UX] 칩(Chip) 텍스트를 '상품 보기'로 강제 통일하여 구매 전환율(CTA) 극대화 및 스킨 오류 원천 차단
 *  3. [데이터] 위젯과 리스트 간의 상품 번호(product_no) 완벽 동기화 및 모달 링크 끊김 방어
 *  4. [이벤트] 칩 클릭 시 모달이 아닌 상품 상세로 이동하도록 버블링(stopPropagation) 차단
 */
(function (window) {
  if (window.RIT_LIST_LOADED) return;
  window.RIT_LIST_LOADED = true;

  const stripHtml = (html) => {
    if (!html) return "";
    let cleanedHtml = String(html)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/p\.p1\s*\{[^}]*\}/gi, '')
      .replace(/span\.s1\s*\{[^}]*\}/gi, '')
      .replace(/&nbsp;/gi, ' ');

    let tmp = document.createElement("DIV");
    tmp.innerHTML = cleanedHtml;
    return (tmp.textContent || tmp.innerText || "").trim();
  };

  const getDynamicConfig = () => {
    let cafe24MallId = null;
    if (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) {
      cafe24MallId = window.CAFE24API.MALL_ID;
    } else if (typeof window.SHOP_ID !== 'undefined' && window.SHOP_ID) {
      cafe24MallId = window.SHOP_ID;
    } else if (typeof EC_SHOP_ID !== 'undefined' && EC_SHOP_ID) {
      cafe24MallId = EC_SHOP_ID;
    }
    let fallbackMallId = window.location.hostname.split('.').filter(part => !['www', 'm', 'cafe24', 'com', 'co', 'kr'].includes(part))[0];

    let mallName = "REVIEW-IT";
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) mallName = ogSiteName.content.trim();

    return {
      mallId: cafe24MallId || fallbackMallId || 'default_mall',
      mallName: mallName
    };
  };

  const env = getDynamicConfig();

  const currentPath = window.location.pathname.toLowerCase();
  const currentSearch = window.location.search.toLowerCase(); // 기존 로직을 위해 다시 부활
  const urlParams = new URLSearchParams(window.location.search); // 정밀 타겟팅용 추가

  // 1. 읽기 페이지 차단 로직 (no 파라미터 오탐지 방지용 특수 로직)
  const isBlockedReadPage =
    currentPath.includes('/board/product/read.html') ||
    urlParams.has('article_no') ||
    urlParams.has('no');

  // 2. 기타 예외 페이지
  const isBlockedDetailPage = currentPath.includes('/product/detail.html');
  const isBlockedWritePage = currentPath.includes('/write.html') || currentPath.includes('/modify.html');

  if (isBlockedReadPage || isBlockedDetailPage || isBlockedWritePage) {
    console.log("▶ [REVIEW-IT List] 예외 페이지 감지 -> 리스트 엔진 차단 및 뼈대 강제 삭제 가동");

    const killListGhosts = () => {
      document.querySelectorAll('.rit-list-container, #review-it-widget, #rit-widget-container').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.innerHTML = '';
      });
    };

    killListGhosts();
    window.addEventListener('DOMContentLoaded', killListGhosts);

    const ghostInterval = setInterval(killListGhosts, 200);
    setTimeout(() => clearInterval(ghostInterval), 3000);

    return;
  }

  // 3. 리뷰 게시판 감지 (여기에 currentSearch가 쓰이고 있었습니다!)
  const isReviewBoardPage =
    currentPath.includes('/board/product/list') ||
    currentPath.includes('상품-사용후기') ||
    (currentPath.includes('/board/') && (currentSearch.includes('board_no=4') || currentPath.includes('/4/')));

  if (!isReviewBoardPage) return;

  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: env.mallId,
    mallName: env.mallName,
    limit: 15,
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    starPath: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating'
  };

  const ReviewListApp = {
    page: 0,
    isLoading: false,
    hasMore: true,
    renderedIds: new Set(),
    allFetchedReviews: [],

    async init() {
      console.log("▶ [REVIEW-IT] 세계 최고 수준의 미니멀 리뷰 리스트 엔진 가동 v1.0.9");

      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}&select=list_design_type`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` }
        });
        const data = await res.json();

        if (data && data.length > 0 && data[0].list_design_type === 'cafe24') {
          console.log("▶ [REVIEW-IT] Cafe24 기본 디자인 사용 모드 - 리스트 덮어쓰기를 취소합니다.");
          return;
        }
      } catch (e) {
        console.warn("설정값 로드 실패. 기본 REVIEW-IT 뷰로 렌더링합니다.");
      }

      this.hideConflicts();
      this.injectGridCSS();
      this.createLayout();

      if (window.ReviewApp && typeof window.ReviewApp.initModal === 'function') {
        window.ReviewApp.initModal();
        this.hijackModal();
      }

      this.fetchReviews();
      this.initIntersectionObserver();
    },

    hideConflicts() {
      const selectors = [
        '.xans-board-listpackage', '.xans-board-normalpackage',
        '.boardList', 'table.boardList', 'table.xans-board-list',
        '.boardSort', '.xans-board-empty', '#prdReview',
        '.xans-product-review', '.review_list_item',
        'div[id^="ec-product-review"]', '.board-list-wrap',
        '.xans-board-movement', '.boardAdmin', '.xans-board-admin',
        '#board_admin', '.xans-board-buttons', '.xans-board-button',
        '.xans-board-paging', '.ec-base-paginate', '.xans-board-4',
        '#review-it-widget', '#rit-widget-container', '.rit-list-container'
      ];

      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        if (el) el.style.setProperty('display', 'none', 'important');
      });
    },

    injectGridCSS() {
      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }

      if (document.getElementById('rit-list-grid-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-list-grid-css';
      style.innerHTML = `
        #review-it-widget, #rit-widget-container { display: none !important; }
        
        .rit-list-container { width: 100%; max-width: 1200px; margin: 30px auto 60px; box-sizing: border-box; }
        
        /* 💡 1. 헤더 스타일 원복 및 스킨 충돌 강제 방어 (!important 적용) */
        .rit-universal-header { 
          text-align: center !important; 
          margin-bottom: 40px !important; 
          display: block !important;
          width: 100% !important;
        }
        .rit-universal-title { 
          font-size: 26px !important; 
          font-weight: 700 !important; 
          color: #18181b !important; 
          margin: 0 0 10px 0 !important; 
          letter-spacing: -0.5px !important; 
          font-family: inherit !important; 
          text-align: center !important;
          display: block !important;
        }
        .rit-universal-subtitle { 
          font-size: 14px !important; 
          color: #71717a !important; 
          font-weight: 400 !important; 
          margin: 0 !important; 
          word-break: keep-all !important; 
          text-align: center !important;
          display: block !important;
        }
        @media (min-width: 1024px) {
          .rit-universal-title { font-size: 32px !important; }
          .rit-universal-subtitle { font-size: 15px !important; }
        }

        /* --- 대시보드 관련 CSS (기존 유지) --- */
        .rit-dashboard-card { background: #ffffff; border: 1px solid #f0f0f0; border-radius: 16px; padding: 28px 32px; margin-bottom: 35px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02); display: flex; flex-direction: column; gap: 24px; }
        @media (min-width: 1024px) { .rit-dashboard-card { flex-direction: row; align-items: center; justify-content: space-between; } }
        .rit-dash-left { display: flex; flex-direction: column; gap: 15px; flex: 1; }
        .rit-dash-score-box { display: flex; align-items: center; gap: 18px; }
        .rit-dash-big-score { font-size: 44px; font-weight: 800; color: #111; line-height: 1; letter-spacing: -1px; }
        .rit-dash-score-info { display: flex; flex-direction: column; gap: 4px; }
        .rit-dash-stars { display: flex; gap: 2px; }
        .rit-universal-star { height: 16px !important; }
        .rit-dash-count-text { font-size: 13px; color: #666; font-weight: 500; }
        .rit-dash-satisfaction { font-size: 12px; color: #71717a; font-weight: 600; }
        .rit-dash-gauge-box { flex: 1; max-width: 420px; display: flex; flex-direction: column; gap: 6px; }
        @media (min-width: 1024px) { .rit-dash-gauge-box { border-left: 1px solid #f3f3f3; padding-left: 32px; } }

        .rit-gauge-row { display: flex; align-items: center; gap: 12px; font-size: 11px; color: #888; margin-bottom: 2px; }
        .rit-gauge-label { width: 28px; font-weight: 600; color: #52525b; }
        .rit-gauge-bg { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
        .rit-gauge-fill { height: 100%; background: linear-gradient(90deg, #fde047 0%, #f59e0b 100%); border-radius: 4px; transition: width 1s cubic-bezier(0.25, 1, 0.5, 1); }
        .rit-gauge-percent { width: 32px; text-align: right; font-weight: 600; color: #71717a; }

        .rit-product-chip { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; transition: background 0.2s; }
        .rit-product-chip:hover { background: #f1f5f9; }
        .rit-product-chip-img { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; }
        .rit-product-chip-name { font-size: 11px; color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* 💡 2. 가장 중요한 레이아웃 교체: CSS Grid 도입 및 높이 맞춤(Stretching) 방지 */
        .rit-masonry-grid { 
          display: grid !important; 
          grid-template-columns: repeat(2, 1fr) !important; /* 기본 모바일 2열 */
          gap: 12px !important; 
          align-items: start !important; /* 카드가 세로로 억지로 늘어나는 것을 방지 */
          width: 100% !important; 
          box-sizing: border-box; 
        }
        @media (min-width: 768px) { 
          .rit-masonry-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 18px !important; } 
        }
        @media (min-width: 1024px) { 
          .rit-masonry-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 20px !important; } 
        }
        
        .rit-masonry-item { 
          width: 100% !important;
          margin-bottom: 0 !important; /* Grid의 gap이 간격을 대신하므로 0으로 처리 */
          border-radius: 12px; 
          overflow: hidden; 
          background: #fff; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.04); 
          cursor: pointer; 
          transition: transform 0.2s; 
          border: 1px solid #f0f0f0; 
          display: flex;
          flex-direction: column;
        }

        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; aspect-ratio: 4/5; /* 이미지 비율 일정하게 고정 */ } 
        .rit-masonry-info { padding: 15px; display: flex; flex-direction: column; flex-grow: 1; }
        .rit-masonry-subject { font-size: 13px; color: #18181b; font-weight: 700; line-height: 1.4; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #52525b; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 10px; margin-top: auto; }
        
        /* 모달 및 스켈레톤 (기존 유지) */
        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; background: #000 !important; }
        .rit-img-side { background: #000 !important; }

        @media (min-width: 768px) {
          .rit-modal-window { overflow: visible !important; }
          .rit-modal-header { position: absolute !important; top: -60px !important; left: 0; right: 0; background: transparent !important; padding: 0 !important; display: flex !important; z-index: 99999 !important; border: none !important; }
          
          .btn-rit-grid { display: flex !important; align-items: center; backdrop-filter: blur(4px); padding: 6px 14px; border-radius: 20px; margin-right: 15px; transition: background 0.2s; }
          .btn-rit-grid:hover { background: rgba(255,255,255,0.25); }
          .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; border-left: 1px solid rgba(255,255,255,0.4); padding-left: 10px; margin-left: 5px; }
          .btn-rit-close { color: #fff !important; }
        }
        
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
        
        @keyframes rit-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .rit-skeleton-box { background-color: #f2f5f7; border-radius: 6px; position: relative; overflow: hidden; }
        .rit-skeleton-box::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%); animation: rit-shimmer 1.5s infinite; }

        .rit-dash-skeleton { display: flex; flex-direction: column; gap: 24px; padding: 28px 32px; background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; margin-bottom: 35px; }
        @media (min-width: 1024px) { .rit-dash-skeleton { flex-direction: row; justify-content: space-between; } }
        .rit-dash-skeleton-left { flex: 1; display: flex; align-items: center; gap: 18px; }
        .rit-dash-skeleton-right { flex: 1; display: flex; flex-direction: column; gap: 10px; max-width: 420px; }
        .rit-gauge-fill { height: 100%; background: #18181b; border-radius: 3px; width: 0%; transition: width 1s cubic-bezier(0.25, 1, 0.5, 1); }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      document.querySelectorAll('.rit-list-container, #rit-scroll-anchor').forEach(el => el.remove());

      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';

      container.innerHTML = `
        <div class="rit-universal-header">
          <h2 class="rit-universal-title">Product Reviews</h2>
          <p class="rit-universal-subtitle">고객님들이 직접 남겨주신 생생한 후기를 확인해보세요.</p>
        </div>
        <div id="rit-dashboard-area">
          <div class="rit-dash-skeleton">
            <div class="rit-dash-skeleton-left">
              <div class="rit-skeleton-box" style="width: 60px; height: 60px; border-radius: 12px;"></div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div class="rit-skeleton-box" style="width: 100px; height: 16px;"></div>
                <div class="rit-skeleton-box" style="width: 140px; height: 12px;"></div>
              </div>
            </div>
            <div class="rit-dash-skeleton-right">
              ${[1, 2, 3, 4, 5].map(() => `<div class="rit-skeleton-box" style="width: 100%; height: 12px;"></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="rit-masonry-grid" id="rit-masonry-grid">
          ${[1, 2, 3, 4, 5, 6].map(() => `
            <div class="rit-masonry-item rit-skeleton-box" style="height: 300px;"></div>
          `).join('')}
        </div>
        <div id="rit-scroll-anchor" style="padding:30px; text-align:center;"></div>
      `;
      wrapper.appendChild(container);
    },

    renderDashboard(reviews) {
      const dashArea = document.getElementById('rit-dashboard-area');
      if (!dashArea || reviews.length === 0) return;

      const totalCount = reviews.length;
      let totalStars = 0;
      const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

      reviews.forEach(r => {
        const star = parseInt(r.stars || 5, 10);
        totalStars += star;
        if (starCounts[star] !== undefined) starCounts[star]++;
        else starCounts[5]++;
      });

      const avgScore = (totalStars / totalCount).toFixed(1);
      const satisfiedRatio = Math.round(((starCounts[5] + starCounts[4]) / totalCount) * 100);
      const getPercent = (count) => Math.round((count / totalCount) * 100);

      dashArea.innerHTML = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score" id="rit-score-anim">0.0</div> 
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars">
                  <img src="${CONFIG.starPath}5.svg" class="rit-universal-star" alt="star rating">
                </div>
                <div class="rit-dash-count-text">총 <strong>${totalCount.toLocaleString()}개</strong>의 생생한 후기</div>
                <div class="rit-dash-satisfaction">구매 고객의 <span style="color:#f59e0b; font-weight:800; font-size:13px;">${satisfiedRatio}%</span>가 만족했습니다</div>
              </div>
            </div>
          </div>

          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
        const pct = getPercent(starCounts[star]);
        return `
                <div class="rit-gauge-row">
                  <span class="rit-gauge-label">${star}점</span>
                  <div class="rit-gauge-bg">
                    <div class="rit-gauge-fill" data-target="${pct}%" style="width: 0%;"></div>
                  </div>
                  <span class="rit-gauge-percent">${pct}%</span>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;

      this.animateDashboard(parseFloat(avgScore));
    },

    animateDashboard(targetScore) {
      setTimeout(() => {
        document.querySelectorAll('.rit-gauge-fill').forEach(bar => {
          bar.style.width = bar.getAttribute('data-target');
        });

        const scoreEl = document.getElementById('rit-score-anim');
        if (!scoreEl) return;

        let startTimestamp = null;
        const duration = 1200;

        const step = (timestamp) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);
          const easeOutProgress = 1 - (1 - progress) * (1 - progress);

          const currentScore = (easeOutProgress * targetScore).toFixed(1);
          scoreEl.innerHTML = currentScore;

          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else {
            scoreEl.innerHTML = targetScore.toFixed(1);
          }
        };
        window.requestAnimationFrame(step);
      }, 1500);
    },

    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
      }
    },

    openModal(id) {
      if (window.ReviewApp) window.ReviewApp.openModal(id);
    },

    async fetchReviews() {
      if (this.isLoading || !this.hasMore) return;
      this.isLoading = true;
      const offset = this.page * CONFIG.limit;

      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Range': `${offset}-${offset + CONFIG.limit - 1}` }
        });
        const data = await res.json();

        if (data.length < CONFIG.limit) {
          this.hasMore = false;
          const anchor = document.getElementById('rit-scroll-anchor');
          if (anchor) anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
        }

        const enrichedData = await Promise.all(data.map(async (r) => {
          if (window.ReviewApp) {
            if (!window.ReviewApp.data[r.id]) {
              window.ReviewApp.data[r.id] = { ...r };
              window.ReviewApp.listOrder.push(r.id);
            } else {
              window.ReviewApp.data[r.id] = { ...window.ReviewApp.data[r.id], ...r };
            }

            let widgetData = window.ReviewApp.data[r.id];

            if (!widgetData.is_parsed && typeof window.ReviewApp._fetchAndSeparateContent === 'function') {
              const scraped = await window.ReviewApp._fetchAndSeparateContent(r.article_no, r.board_no);
              if (scraped) {
                widgetData.all_images = (scraped.images && scraped.images.length > 0) ? scraped.images : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg]);
                widgetData.clean_text_body = stripHtml(scraped.text || r.content || '');
                if (scraped.writer) widgetData.author_name = scraped.writer;

                // 💡 추출 로직은 뒤에서 묵묵히 일하도록 살려둡니다.
                if (scraped.productName) widgetData.scraped_product_name = scraped.productName;
                if (scraped.productNo) widgetData.scraped_product_no = scraped.productNo;
                if (scraped.productImg) widgetData.scraped_product_img = scraped.productImg;
              } else {
                widgetData.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
                widgetData.clean_text_body = stripHtml(r.content || '');
              }
              widgetData.is_parsed = true;
            }
            return widgetData;
          }

          r.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
          r.clean_text_body = stripHtml(r.content || '');
          return r;
        }));

        this.allFetchedReviews = [...this.allFetchedReviews, ...enrichedData];
        this.renderDashboard(this.allFetchedReviews);

        this.renderItems(enrichedData);
        this.page++;
      } catch (error) {
        console.error("❌ [REVIEW-IT] 리스트 로드 실패:", error);
      } finally {
        setTimeout(() => { this.isLoading = false; }, 300);
      }
    },

    renderItems(reviews) {
      const grid = document.getElementById('rit-masonry-grid');
      if (!grid) return;

      const uniqueReviews = [];
      reviews.forEach(r => {
        const checkKey = r.article_no || r.id;
        if (!this.renderedIds.has(checkKey)) {
          this.renderedIds.add(checkKey);
          uniqueReviews.push(r);
        }
      });

      if (uniqueReviews.length === 0) return;

      const html = uniqueReviews.map(r => {
        const imgUrl = (r.all_images && r.all_images.length > 0 && r.all_images[0] !== CONFIG.defaultImg) ? r.all_images[0] : CONFIG.defaultImg;
        const cleanContent = r.clean_text_body || '내용이 없습니다.';

        const avgScore = r.product_avg_score || r.stars || 5;
        const revCount = r.product_review_count;
        const reviewCountHtml = revCount ? `<span style="color:#e4e4e7; margin:0 2px;">|</span><span style="font-weight:500; color:#71717a;">리뷰 ${revCount.toLocaleString()}</span>` : '';

        // 날짜 포맷팅 (YY.MM.DD 작성)
        const rawDate = r.original_date ? r.original_date : (r.created_at ? r.created_at.split('T')[0] : '');
        let formattedDate = rawDate;
        if(rawDate) {
           const dateObj = new Date(rawDate);
           if(!isNaN(dateObj)) {
               const yy = String(dateObj.getFullYear()).slice(-2);
               const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
               const dd = String(dateObj.getDate()).padStart(2, '0');
               formattedDate = `${yy}.${mm}.${dd} 작성`;
           }
        }

        const actualProductName = '상품 보기';
        const actualProductImg = r.scraped_product_img || r.product_image || r.product_img || imgUrl;
        const actualProductNo = r.scraped_product_no || r.product_no || '';
        const productLink = actualProductNo ? `/product/detail.html?product_no=${actualProductNo}` : '';

        const productChipHtml = `
          <div class="rit-product-chip" 
               ${productLink ? `onclick="event.stopPropagation(); window.location.href='${productLink}';"` : ''} 
               style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; transition: background 0.2s; cursor: pointer;">
            <img src="${actualProductImg}" class="rit-product-chip-img" style="width: 22px; height: 22px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="product" onerror="this.src='${CONFIG.defaultImg}'">
            <span class="rit-product-chip-name" style="font-size: 11px; color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${actualProductName}</span>
          </div>
        `;

        const rawName = (r.author_name ? r.author_name : (r.writer || '고객')).trim();
        
        // 💡 [핵심 방어 1] 관리자 판별 로직 추가
        const adminKeywords = ['관리자', 'Official', '운영자', 'admin', '대표', '주인장'];
        const isMallOwner = (CONFIG.mallName && (rawName === CONFIG.mallName.trim() || CONFIG.mallName.includes(rawName))) 
                            || adminKeywords.some(k => rawName.includes(k));

        let displayName = rawName;
        if (!isMallOwner && window.ReviewApp && typeof window.ReviewApp.maskName === 'function') {
          displayName = window.ReviewApp.maskName(rawName);
        } else if (!isMallOwner) {
          if (rawName.length <= 2) displayName = rawName.charAt(0) + '*';
          else if (rawName.length === 3) displayName = rawName.charAt(0) + '*' + rawName.charAt(2);
          else displayName = rawName.substring(0, 2) + '**';
        }

        // 💡 [핵심 방어 2] 관리자가 아닐 때만 구매 인증 배지 생성
        const verifiedBadgeHtml = !isMallOwner ? `
          <span style="position: absolute; right: 8px; bottom: 8px; background: rgba(255,255,255,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: #3f3f46; padding: 4px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: -0.5px; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">구매 인증</span>
        ` : '';

        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            
            <!-- 💡 [결과] 이미지 래퍼 생성 및 배지 삽입 -->
            <div style="position: relative; width: 100%; overflow: hidden; background: rgba(0,0,0,0.02);">
              <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'" style="width: 100%; height: auto; display: block; object-fit: cover;">
              ${verifiedBadgeHtml}
            </div>
            
            <div class="rit-masonry-info" style="display: flex; flex-direction: column; padding: 15px;">
              <div style="display:flex; align-items:center; gap:5px; margin-bottom:8px; font-size:11px; font-weight:700; color:#52525b;">
                 <span style="color:#fbbf24;">★</span>
                 <span>${Number(avgScore).toFixed(1)}</span>
                 ${reviewCountHtml}
              </div>
              
              <!-- 💡 [결과] 제목 최소 2줄 무조건 고정 -->
              <div class="rit-masonry-subject" style="font-size: 13px; color: #18181b; font-weight: 700; line-height: 1.4; height: 2.8em; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal;">${r.subject}</div>
              
              <div class="rit-masonry-desc" style="font-size: 12px; color: #52525b; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all;">${cleanContent}</div>
              
              ${productChipHtml}
              
              <!-- 💡 [결과] 하단 작성자/날짜 한 줄 고정 (ellipsis) -->
              <div class="rit-masonry-meta" style="border-top: 1px solid #f4f4f5; padding-top: 10px; margin-top: auto;">
                <div style="display: flex; align-items: center; gap: 6px; width: 100%; overflow: hidden;">
                  <span style="font-size: 11px; color: #71717a; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${displayName}</span>
                  <span style="font-size: 10px; color: #e4e4e7; flex-shrink: 0;">|</span>
                  <span style="font-size: 11px; color: #a1a1aa; flex-shrink: 0; white-space: nowrap;">${formattedDate}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (this.page === 0) {
        grid.innerHTML = html;
      } else {
        grid.insertAdjacentHTML('beforeend', html);
      }
    },

    initIntersectionObserver() {
      const anchor = document.getElementById('rit-scroll-anchor');
      if (!anchor) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
          this.fetchReviews();
        }
      }, { rootMargin: '200px' });
      observer.observe(anchor);
    }
  };

  window.ReviewListApp = ReviewListApp;

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);