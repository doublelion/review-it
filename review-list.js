/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 그리드 뷰 빈 화면 픽스 및 중복 렌더링 초정밀 디버깅 툴 탑재
 */
(function (window) {
  if (window.RIT_LIST_LOADED) return;
  window.RIT_LIST_LOADED = true;

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
  if (env.mallId !== 'ykinas') return;

  const currentPath = decodeURIComponent(window.location.pathname);
  const currentSearch = window.location.search;
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

    init() {
      console.log("▶ [REVIEW-IT] 리스트 엔진 가동 (디버깅 모드)");
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
      const selectors = ['.xans-board-listpackage', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => el.style.setProperty('display', 'none', 'important'));
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
        
        .rit-list-container { width: 100%; max-width: 1200px; margin: 40px auto; padding: 0 15px; }
        .rit-masonry-grid { column-count: 2; column-gap: 10px; }
        @media (min-width: 768px) { .rit-masonry-grid { column-count: 3; column-gap: 15px; } }
        @media (min-width: 1024px) { .rit-masonry-grid { column-count: 4; column-gap: 20px; } }
        .rit-masonry-item { break-inside: avoid; margin-bottom: 10px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; border: 1px solid #eee; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; display: block; object-fit: cover; aspect-ratio: 1/1; }
        .rit-masonry-info { padding: 15px; }
        .rit-masonry-subject { font-size: 13px; color: #222; font-weight: 600; line-height: 1.4; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888; }
        
        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; }

        .rit-modal-window { overflow: visible !important; }
        .rit-modal-header { display: flex !important; z-index: 99999 !important; visibility: visible !important; opacity: 1 !important; }
        .btn-rit-grid { display: flex !important; visibility: visible !important; }
        .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; }
        
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      const existingContainer = document.querySelector('.rit-list-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" style="text-align:center; padding:30px; color:#999; font-size:13px;">리뷰를 불러오는 중입니다...</div>
      `;
      wrapper.appendChild(container);
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
        };
      }
    },

    async fetchReviews() {
      if (this.isLoading || !this.hasMore) return;
      this.isLoading = true;
      const offset = this.page * CONFIG.limit;

      console.log(`\n========== [DEBUG LOG] ==========`);
      console.log(`▶ API 통신 시작: 페이지 ${this.page}, 불러올 범위 ${offset} ~ ${offset + CONFIG.limit - 1}`);

      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Range': `${offset}-${offset + CONFIG.limit - 1}` }
        });
        const data = await res.json();

        console.log(`▶ API 응답 데이터 개수: ${data.length}개`);
        console.table(data.map(d => ({ ID: d.id, Article_No: d.article_no, Subject: d.subject.substring(0, 10) })));

        if (data.length < CONFIG.limit) {
          this.hasMore = false;
          const anchor = document.getElementById('rit-scroll-anchor');
          if (anchor) anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
        }

        if (window.ReviewApp) {
          data.forEach(r => {
            if (!window.ReviewApp.data[r.id]) {
              r.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
              r.is_parsed = false;
              window.ReviewApp.data[r.id] = r;

              // 🛑 [핵심 픽스: GRID VIEW 부활] 모달에서 그리드 뷰를 그릴 때 필요한 장부에 데이터를 넣어줍니다.
              window.ReviewApp.listOrder.push(r.id);
            }
          });
        }

        this.renderItems(data);
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
        const checkKey = r.article_no || r.id; // article_no가 없을 경우에 대비한 방어 코드
        if (!this.renderedIds.has(checkKey)) {
          this.renderedIds.add(checkKey);
          uniqueReviews.push(r);
        } else {
          console.warn(`▶ [DEBUG] 중복 데이터 렌더링 차단됨! (Article No: ${checkKey})`);
        }
      });

      console.log(`▶ 화면에 그릴 고유 데이터 개수: ${uniqueReviews.length}개`);
      console.log(`=================================\n`);

      if (uniqueReviews.length === 0) return;

      const html = uniqueReviews.map(r => {
        const imgUrl = (r.image_urls && r.image_urls.length > 0 && r.image_urls[0] !== CONFIG.defaultImg) ? r.image_urls[0] : CONFIG.defaultImg;
        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-meta">
                <span>${CONFIG.mallName}</span>
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" style="height:12px; filter: invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.5)); background: rgba(255, 255, 255, 0.2); padding: 2px 4px; border-radius: 4px;">
              </div>
            </div>
            <!-- 🛑 [디버깅 UI] 빨간색 식별표: 2개가 똑같은 번호인지 직관적으로 확인 가능 -->
            <div style="background-color: red; color: white; padding: 5px; font-size: 10px; text-align: center; word-break: break-all;">
              DB ID: ${r.id} <br>
              Article No: ${r.article_no}
            </div>
          </div>
        `;
      }).join('');
      grid.insertAdjacentHTML('beforeend', html);
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