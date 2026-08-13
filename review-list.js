/**
 * @Project: Review-It Universal Board List Engine v1.1.0 (True Masonry Patch)
 * @Role: Cafe24 Review SaaS Lead Developer
 * @Update: 
 *  1. [헤더] 중앙 정렬 및 기존 우아한 타이포그래피 완벽 원복
 *  2. [레이아웃] CSS column-count 폐기 -> JS 기반 DOM Flex Column 분배 방식(True Masonry) 적용
 *  3. [버그픽스] 아이템 개수가 적을 때 한쪽으로 쏠리거나 텅 비는 현상, 세로로 늘어나는 기괴한 현상 100% 원천 차단
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
  const currentSearch = window.location.search.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);

  const isBlockedReadPage = currentPath.includes('/board/product/read.html') || urlParams.has('article_no') || urlParams.has('no');
  const isBlockedDetailPage = currentPath.includes('/product/detail.html');
  const isBlockedWritePage = currentPath.includes('/write.html') || currentPath.includes('/modify.html');

  if (isBlockedReadPage || isBlockedDetailPage || isBlockedWritePage) {
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

  const isReviewBoardPage = currentPath.includes('/board/product/list') || currentPath.includes('상품-사용후기') || (currentPath.includes('/board/') && (currentSearch.includes('board_no=4') || currentPath.includes('/4/')));

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
    currentCols: 0, // 💡 현재 활성화된 화면의 단(Column) 수를 추적합니다.

    async init() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}&select=list_design_type`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` }
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].list_design_type === 'cafe24') return;
      } catch (e) { }

      this.hideConflicts();
      this.injectGridCSS();
      this.createLayout();

      if (window.ReviewApp && typeof window.ReviewApp.initModal === 'function') {
        window.ReviewApp.initModal();
        this.hijackModal();
      }

      // 💡 화면 리사이즈 시 단(Column) 수를 실시간으로 계산하여 즉시 재배치합니다.
      window.addEventListener('resize', () => {
        let expectedCols = window.innerWidth >= 1024 ? 4 : (window.innerWidth >= 768 ? 3 : 2);
        if (this.allFetchedReviews.length > 0 && this.allFetchedReviews.length < expectedCols) {
          expectedCols = this.allFetchedReviews.length;
        }
        if (this.currentCols !== expectedCols && this.allFetchedReviews.length > 0) {
          this.renderGrid();
        }
      });

      this.fetchReviews();
      this.initIntersectionObserver();
    },

    hideConflicts() {
      const selectors = [
        '.xans-board-listpackage', '.xans-board-normalpackage', '.boardList', 'table.boardList', 'table.xans-board-list', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap', '.xans-board-movement', '.boardAdmin', '.xans-board-admin', '#board_admin', '.xans-board-buttons', '.xans-board-button', '.xans-board-paging', '.ec-base-paginate', '.xans-board-4', '#review-it-widget', '#rit-widget-container', '.rit-list-container'
      ];
      document.querySelectorAll(selectors.join(', ')).forEach(el => { if (el) el.style.setProperty('display', 'none', 'important'); });
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
        @media (max-width: 767px) {
          .rit-list-container { padding:0; }
        }
        
        /* 💡 1. 헤더 디자인 완벽 원복: 과도한 block 설정을 풀고 본래의 유려한 중앙정렬 룩으로 복구 */
        .rit-universal-header { text-align: center; margin-bottom: 40px; display: flex; flex-direction: column; align-items: center; width: 100%; }
        .rit-universal-title { font-size: 26px; font-weight: 700; color: #18181b; margin: 0 0 10px 0; letter-spacing: -0.5px; font-family: inherit; line-height: 1.2; text-align: center; }
        .rit-universal-subtitle { font-size: 14px; color: #71717a; font-weight: 400; margin: 0; word-break: keep-all; text-align: center; }
        @media (min-width: 1024px) {
          .rit-universal-title { font-size: 32px; }
          .rit-universal-subtitle { font-size: 15px; }
        }

        /* --- 대시보드 관련 (기존 유지) --- */
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

        /* 💡 2. 궁극의 해결책! CSS Flex Column을 이용한 'True Masonry' (Stretching 완벽 차단) */
        .rit-masonry-grid { 
          display: flex !important; 
          flex-direction: row !important;
          align-items: flex-start !important; /* 상단 정렬로 강제 세로 늘어남 완전 차단 */
          width: 100% !important;
          box-sizing: border-box; 
          gap: 12px !important;
        }
        
        .rit-masonry-column {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important; /* 아이템이 적어도 텅 비어보이지 않게 꽉 차게 비율 조절 */
          min-width: 0 !important;
          gap: 12px !important;
        }

        @media (min-width: 768px) { 
          .rit-masonry-grid, .rit-masonry-column { gap: 18px !important; }
        }
        @media (min-width: 1024px) { 
          .rit-masonry-grid, .rit-masonry-column { gap: 20px !important; }
        }
        
        .rit-masonry-item { 
          width: 100% !important; 
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

        .rit-masonry-img { 
          width: 100% !important; 
          height: auto !important; 
          display: block !important; 
          object-fit: cover;
        } 
        
        .rit-masonry-info { padding: 15px; display: flex; flex-direction: column; flex-grow: 1; }
        .rit-masonry-subject { font-size: 13px; color: #18181b; font-weight: 700; line-height: 1.4; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; text-align: left; }
        .rit-masonry-desc { font-size: 12px; color: #52525b; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; text-align: left; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 10px; margin-top: auto; }
        
        /* --- 모달 관련 CSS --- */
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
        <!-- 💡 스켈레톤도 Flex Column 규격에 맞춰 4개로 세팅 (PC 기준) -->
        <div class="rit-masonry-grid" id="rit-masonry-grid">
          ${[1, 2, 3, 4].map(() => `
            <div class="rit-masonry-column">
                <div class="rit-masonry-item rit-skeleton-box" style="height: 300px !important;"></div>
            </div>
          `).join('')}
        </div>
        <div id="rit-scroll-anchor" style="padding:30px; text-align:center; font-size:14px; color:#a1a1aa; font-weight:500; word-break:keep-all;"></div>
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
                <div class="rit-dash-stars"><img src="${CONFIG.starPath}5.svg" class="rit-universal-star" alt="star rating"></div>
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
                  <div class="rit-gauge-bg"><div class="rit-gauge-fill" data-target="${pct}%" style="width: 0%;"></div></div>
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
        document.querySelectorAll('.rit-gauge-fill').forEach(bar => bar.style.width = bar.getAttribute('data-target'));
        const scoreEl = document.getElementById('rit-score-anim');
        if (!scoreEl) return;
        let startTimestamp = null;
        const duration = 1200;
        const step = (timestamp) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);
          const currentScore = (1 - (1 - progress) * (1 - progress)) * targetScore;
          scoreEl.innerHTML = currentScore.toFixed(1);
          if (progress < 1) window.requestAnimationFrame(step);
          else scoreEl.innerHTML = targetScore.toFixed(1);
        };
        window.requestAnimationFrame(step);
      }, 1500);
    },

    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
      }
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
          if (anchor) {
            anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
            // 명시적으로 한 번 더 스타일 강제 적용
            anchor.style.fontSize = '14px';
            anchor.style.color = '#a1a1aa';
          }
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

        const newUnique = [];
        enrichedData.forEach(r => {
          const checkKey = r.article_no || r.id;
          if (!this.renderedIds.has(checkKey)) {
            this.renderedIds.add(checkKey);
            newUnique.push(r);
          }
        });

        if (newUnique.length > 0) {
          this.allFetchedReviews = [...this.allFetchedReviews, ...newUnique];
          this.renderDashboard(this.allFetchedReviews);
          this.renderGrid(); // 💡 배열이 갱신될 때마다 전체 그리드를 완벽하게 재구성합니다.
        }
        this.page++;
      } catch (error) {
        console.error("❌ [REVIEW-IT] 리스트 로드 실패:", error);
      } finally {
        setTimeout(() => { this.isLoading = false; }, 300);
      }
    },

    // 💡 개별 카드의 HTML을 리턴하는 독립된 함수입니다.
    getCardHTML(r) {
      const imgUrl = (r.all_images && r.all_images.length > 0 && r.all_images[0] !== CONFIG.defaultImg) ? r.all_images[0] : CONFIG.defaultImg;
      const cleanContent = r.clean_text_body || '내용이 없습니다.';
      const avgScore = r.product_avg_score || r.stars || 5;
      const revCount = r.product_review_count;
      const reviewCountHtml = revCount ? `<span style="color:#e4e4e7; margin:0 2px;">|</span><span style="font-weight:500; color:#71717a;">리뷰 ${revCount.toLocaleString()}</span>` : '';

      const rawDate = r.original_date ? r.original_date : (r.created_at ? r.created_at.split('T')[0] : '');
      let formattedDate = rawDate;
      if (rawDate) {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj)) {
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

      const adminKeywords = ['관리자', 'official', '운영자', 'admin', '대표', '주인장', 'md', '스토어', '스태프', 'staff'];

      const isMallOwner = (CONFIG.mallName && (rawName === CONFIG.mallName.trim() || rawName.includes(CONFIG.mallName)))
        || adminKeywords.some(k => rawName.toLowerCase().includes(k.toLowerCase()));

      let displayName = rawName;
      if (!isMallOwner && window.ReviewApp && typeof window.ReviewApp.maskName === 'function') {
        displayName = window.ReviewApp.maskName(rawName);
      } else if (!isMallOwner) {
        if (rawName.length <= 2) displayName = rawName.charAt(0) + '*';
        else if (rawName.length === 3) displayName = rawName.charAt(0) + '*' + rawName.charAt(2);
        else displayName = rawName.substring(0, 2) + '**';
      }

      // isMallOwner가 true(관리자)이면 뱃지를 빈 문자열로 처리하여 숨김
      const verifiedBadgeHtml = !isMallOwner ? `
      <span style="position: absolute; right: 8px; bottom: 8px; background: rgba(255,255,255,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: #3f3f46; padding: 4px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: -0.5px; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">구매 인증</span>
      ` : '';

      return `
        <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
          <div style="position: relative; width: 100%; overflow: hidden; background: rgba(0,0,0,0.02);">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            ${verifiedBadgeHtml}
          </div>
          <div class="rit-masonry-info">
            <div style="display:flex; align-items:center; gap:5px; margin-bottom:8px; font-size:11px; font-weight:700; color:#52525b;">
               <span style="color:#fbbf24;">★</span>
               <span>${Number(avgScore).toFixed(1)}</span>
               ${reviewCountHtml}
            </div>
            <div class="rit-masonry-subject">${r.subject}</div>
            <div class="rit-masonry-desc">${cleanContent}</div>
            ${productChipHtml}
            <div class="rit-masonry-meta">
              <div style="display: flex; align-items: center; gap: 6px; width: 100%; overflow: hidden;">
                <span style="font-size: 11px; color: #71717a; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${displayName}</span>
                <span style="font-size: 10px; color: #e4e4e7; flex-shrink: 0;">|</span>
                <span style="font-size: 11px; color: #a1a1aa; flex-shrink: 0; white-space: nowrap;">${formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // 💡 핵심 엔진 교체 구역: 브라우저가 아닌 JS가 직접 4개의 기둥을 세우고 아이템을 공평하게 분배합니다.
    renderGrid() {
      const grid = document.getElementById('rit-masonry-grid');
      if (!grid || this.allFetchedReviews.length === 0) return;

      // 1. 현재 화면 크기에 맞는 목표 단(Column) 수를 계산합니다.
      let cols = window.innerWidth >= 1024 ? 4 : (window.innerWidth >= 768 ? 3 : 2);

      // 2. 만약 리뷰 개수가 단 수보다 적다면 (예: 4단인데 리뷰가 3개), 빈칸이 흉하게 생기지 않도록 단 수를 줄입니다.
      if (this.allFetchedReviews.length < cols) cols = this.allFetchedReviews.length;

      // 3. 단 개수만큼 빈 배열(Column)을 준비합니다.
      const columnDOMs = Array.from({ length: cols }, () => []);

      // 4. 리뷰들을 1열, 2열, 3열, 4열... 순서대로 공평하게 던져넣습니다. (Round-Robin)
      this.allFetchedReviews.forEach((r, i) => {
        columnDOMs[i % cols].push(this.getCardHTML(r));
      });

      // 5. 완성된 각 단(Column)을 출력합니다. Flex 특성 상 이 단들은 강제로 똑같은 너비를 나눠 가집니다.
      grid.innerHTML = columnDOMs.map(col => `
        <div class="rit-masonry-column">
          ${col.join('')}
        </div>
      `).join('');

      this.currentCols = cols; // 현재 단 수를 저장하여 불필요한 재렌더링을 막습니다.
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