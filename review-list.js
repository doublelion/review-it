/**
 * @Project: Review-It Universal Board List Engine v1.0.2
 * @Role: Cafe24 Review SaaS Lead Developer
 * @Update: 
 *  1. 기존 카페24 게시판(텍스트 리스트) 완벽 숨김 처리
 *  2. 데스크탑 그리드 뷰 버튼 노출 보정
 *  3. 모달 내 쇼퍼블 버튼 슬림화 및 실제 썸네일 이미지 적용
 *  4. 모바일 좌측 여백 밸런스 교정
 */
(function (window) {
  if (window.RIT_LIST_LOADED) return;
  window.RIT_LIST_LOADED = true;

  const stripHtml = (html) => {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || "";
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

  // 🔒 [테스트 안전장치] ykinas 몰 전용 유지
  if (env.mallId !== 'ykinas') return;

  const currentPath = window.location.pathname.toLowerCase();
  const currentSearch = window.location.search.toLowerCase();

  // 💡 [초강력 차단] 상세(read), 작성(write), 수정(modify) 페이지 및 글 번호 파라미터 감지 시 즉시 종료
  if (
    currentPath.includes('/read.html') ||
    currentPath.includes('/write.html') ||
    currentPath.includes('/modify.html') ||
    currentSearch.includes('no=') ||
    currentSearch.includes('article_no=')
  ) {
    console.log("▶ [REVIEW-IT] 게시판 상세/작성 페이지 감지 -> 리스트 엔진 렌더링 안전 차단");
    return;
  }

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

    init() {
      console.log("▶ [REVIEW-IT] 세계 최고 수준의 미니멀 리뷰 리스트 엔진 가동 v1.0.2");
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
        // 👇 새롭게 추가된 페이징 모듈 차단 선택자
        '.xans-board-paging', '.ec-base-paginate'
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
        
        /* 💡 모바일 좌측 여백 교정: box-sizing 추가 및 패딩 정렬 */
        .rit-list-container { width: 100%; max-width: 1200px; margin: 30px auto 60px; padding: 0 16px; box-sizing: border-box; }
        
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
        .rit-gauge-row { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #888; }
        .rit-gauge-label { width: 28px; font-weight: 600; color: #555; }
        .rit-gauge-bg { flex: 1; height: 6px; background: #f2f2f2; border-radius: 3px; overflow: hidden; }
        .rit-gauge-fill { height: 100%; background: #18181b; border-radius: 3px; transition: width 0.6s ease; }
        .rit-gauge-percent { width: 32px; text-align: right; font-weight: 500; color: #71717a; }

        /* 🛍️ 리스트 내 상품 칩 스타일 */
        .rit-product-chip { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; transition: background 0.2s; }
        .rit-product-chip:hover { background: #f1f5f9; }
        .rit-product-chip-img { width: 22px; height: 22px; border-radius: 4px; object-fit: cover; }
        .rit-product-chip-name { font-size: 11px; color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* 🖼️ 진성 맨선리 레이아웃 */
        .rit-masonry-grid { column-count: 2; column-gap: 12px; box-sizing: border-box; }
        @media (min-width: 768px) { .rit-masonry-grid { column-count: 3; column-gap: 18px; } }
        @media (min-width: 1024px) { .rit-masonry-grid { column-count: 4; column-gap: 20px; } }
        .rit-masonry-item { break-inside: avoid; margin-bottom: 16px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s; border: 1px solid #f0f0f0; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; } 
        .rit-masonry-info { padding: 15px; }
        .rit-masonry-subject { font-size: 13px; color: #18181b; font-weight: 700; line-height: 1.4; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #52525b; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 10px; }
        .rit-card-star { height: 12px !important; }

        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; background: #000 !important; }
        .rit-img-side { background: #000 !important; }
        
        @media (min-width: 768px) {
          .rit-modal-window { overflow: visible !important; }
          .rit-modal-header { position: absolute !important; top: -60px !important; left: 0; right: 0; background: transparent !important; padding: 0 !important; display: flex !important; z-index: 99999 !important; border: none !important; }
          
          /* 💡 데스크탑 그리드 뷰 버튼 숨김 해제 및 스타일 보정 */
          .btn-rit-grid { 
            display: flex !important; 
            align-items: center;
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.3);
            backdrop-filter: blur(4px);
            padding: 6px 14px;
            border-radius: 20px;
            margin-right: 15px;
            transition: background 0.2s;
          }
          .btn-rit-grid:hover { background: rgba(255,255,255,0.25); }
          
          .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; border-left: 1px solid rgba(255,255,255,0.4); padding-left: 10px; margin-left: 5px; }
          .btn-rit-close { color: #fff !important; }
        }
        
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
        
        /* =========================================
          REVIEW-IT 스켈레톤 UI & 애니메이션
        ========================================= */
        /* 쉬머(Shimmer) 애니메이션 */
        @keyframes rit-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .rit-skeleton-box {
          background-color: #f2f5f7;
          border-radius: 6px;
          position: relative;
          overflow: hidden;
        }
        .rit-skeleton-box::after {
          content: "";
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%);
          animation: rit-shimmer 1.5s infinite;
        }

        /* 스켈레톤 대시보드 전용 */
        .rit-dash-skeleton { display: flex; flex-direction: column; gap: 24px; padding: 28px 32px; background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; margin-bottom: 35px; }
        @media (min-width: 1024px) { .rit-dash-skeleton { flex-direction: row; justify-content: space-between; } }
        .rit-dash-skeleton-left { flex: 1; display: flex; align-items: center; gap: 18px; }
        .rit-dash-skeleton-right { flex: 1; display: flex; flex-direction: column; gap: 10px; max-width: 420px; }

        /* 게이지 바 차오르는 애니메이션 */
        .rit-gauge-fill {
          height: 100%;
          background: #18181b;
          border-radius: 3px;
          width: 0%; /* 💡 초기값을 0으로 설정하여 JS로 채움 */
          transition: width 1s cubic-bezier(0.25, 1, 0.5, 1); /* 부드럽고 텐션 있는 타이밍 함수 */
        }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      document.querySelectorAll('.rit-list-container, #rit-scroll-anchor').forEach(el => el.remove());

      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';

      // 💡 데이터 로드 전 보여줄 스켈레톤 UI
      container.innerHTML = `
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

      // 💡 초기 게이지는 0%로 세팅 (data-target 속성에 목표치 저장)
      dashArea.innerHTML = `
    <div class="rit-dashboard-card">
      <div class="rit-dash-left">
        <div class="rit-dash-score-box">
          <div class="rit-dash-big-score" id="rit-score-anim">0.0</div> <!-- 💡 0.0부터 시작 -->
          <div class="rit-dash-score-info">
            <div class="rit-dash-stars">
              <img src="${CONFIG.starPath}5.svg" class="rit-universal-star" alt="star rating">
            </div>
            <div class="rit-dash-count-text">총 <strong>${totalCount.toLocaleString()}개</strong>의 생생한 후기</div>
            <div class="rit-dash-satisfaction">구매 고객의 ${satisfiedRatio}%가 만족했습니다</div>
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

      // 렌더링 직후 애니메이션 트리거
      this.animateDashboard(parseFloat(avgScore));
    },

    // 💡 새롭게 추가되는 애니메이션 메서드
    animateDashboard(targetScore) {
      // 💡 페이지 로딩 후 렌더링 안정화를 위해 3초(3000ms) 딜레이 적용
      setTimeout(() => {
        // 1. 게이지 바 애니메이션
        document.querySelectorAll('.rit-gauge-fill').forEach(bar => {
          bar.style.width = bar.getAttribute('data-target');
        });

        // 2. 평점 숫자 카운트업 애니메이션
        const scoreEl = document.getElementById('rit-score-anim');
        if (!scoreEl) return;

        let startTimestamp = null;
        const duration = 1200; // 1.2초 동안 진행

        const step = (timestamp) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);

          // easeOutQuad 타이밍
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
      }, 3000); // 3초 대기
    },

    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
        const origRender = window.ReviewApp.renderDetail;
        window.ReviewApp.renderDetail = async function (id) {
          await origRender.call(this, id);

          const authorEl = document.querySelector('#ritMetaArea .rit-author');
          if (authorEl) {
            authorEl.innerText = CONFIG.mallName;
          }

          const d = window.ReviewApp.data[id];
          const contentSide = document.getElementById('ritContent');

          if (d && contentSide) {
            const oldWrap = contentSide.querySelector('.rit-shoppable-wrap');
            if (oldWrap) oldWrap.remove();

            const productNo = d.product_no || d.product_id;
            const targetProductNo = productNo || '11';
            const productUrl = `/product/detail.html?product_no=${targetProductNo}`;

            // 💡 썸네일 이미지 추출 (리스트용 이미지 또는 기본 이미지)
            const targetProductImg = d.product_img || (d.all_images && d.all_images.length > 0 ? d.all_images[0] : CONFIG.defaultImg);

            // 💡 모달 내 쇼퍼블 버튼 슬림화 및 썸네일 이미지 적용
            const shoppableBtnHtml = `
              <div class="rit-shoppable-wrap" style="border-top: 1px solid #f4f4f5;">
                <a href="${productUrl}" class="rit-btn-shoppable" target="_blank" style="
                  display: flex; align-items: center; justify-content: space-between; 
                  background: #fafafa; color: #18181b; border: 1px solid #e4e4e7; 
                  text-decoration: none; padding: 10px 14px; border-radius: 8px; 
                  font-size: 12px; font-weight: 700; transition: all 0.2s ease;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${targetProductImg}" alt="product thumbnail" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;">
                    <span>리뷰 속 상품 보러가기</span>
                  </div>
                  <span style="color: #a1a1aa; font-weight: 400;">→</span>
                </a>
              </div>
            `;
            contentSide.insertAdjacentHTML('beforeend', shoppableBtnHtml);
          }
        };
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
              window.ReviewApp.data[r.id] = r;
              window.ReviewApp.listOrder.push(r.id);
            }

            let widgetData = window.ReviewApp.data[r.id];

            if (!widgetData.is_parsed && typeof window.ReviewApp._fetchAndSeparateContent === 'function') {
              const scraped = await window.ReviewApp._fetchAndSeparateContent(r.article_no, r.board_no);
              if (scraped) {
                widgetData.all_images = (scraped.images && scraped.images.length > 0) ? scraped.images : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg]);
                widgetData.clean_text_body = stripHtml(scraped.text || r.content || '');
                if (scraped.subject) widgetData.subject = scraped.subject;
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

        const sampleProductName = r.product_name || "REVIEW-IT 프리미엄 솔루션";
        const sampleProductImg = r.product_img || imgUrl;

        const productChipHtml = `
          <div class="rit-product-chip">
            <img src="${sampleProductImg}" class="rit-product-chip-img" alt="product">
            <span class="rit-product-chip-name">${sampleProductName}</span>
          </div>
        `;

        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-desc">${cleanContent}</div>
              ${productChipHtml}
              <div class="rit-masonry-meta">
                <span style="font-weight:600; color:#52525b;">${CONFIG.mallName}</span>
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" class="rit-card-star" alt="star">
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