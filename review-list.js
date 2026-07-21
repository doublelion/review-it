/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 더미 DOM 완벽 삭제, 그리드 뷰 복구, 모달 작성자 몰이름 강제 교정
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

    // 💡 몰 이름 추출 로직
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
      console.log("▶ [REVIEW-IT] 리스트 엔진 가동 (더미 데이터 초기화 및 모달 교정 모드)");
      this.hideConflicts();
      this.injectGridCSS(); 
      this.createLayout(); // 여기서 과거 하드코딩된 좀비 데이터 완벽 삭제
      
      if (window.ReviewApp && typeof window.ReviewApp.initModal === 'function') {
        window.ReviewApp.initModal();
        this.hijackModal(); // 💡 위젯 소스 수정 없이 작성자 이름 '몰 이름'으로 강제 교체
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
        
        /* 다중 이미지 스와이퍼 깨짐 교정 */
        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; }

        /* 🛑 [핵심 픽스] 상단 헤더, 그리드 뷰 버튼, 몰 이름 완벽 복구 */
        .rit-modal-window { overflow: visible !important; }
        .rit-modal-header { display: flex !important; z-index: 99999 !important; visibility: visible !important; opacity: 1 !important; }
        .btn-rit-grid { display: flex !important; visibility: visible !important; } /* 버튼 부활 */
        .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; }
        
        /* 🛑 [핵심 픽스] 그리드 뷰 화면 깨짐 복구 (z-index 및 배경색 강제 지정) */
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      // 🛑 [결정적 픽스] HTML 스킨에 하드코딩된 과거 더미 컨테이너가 있다면 무조건 파괴하고 새로 만듭니다.
      const existingContainer = document.querySelector('.rit-list-container');
      if (existingContainer) {
        existingContainer.remove(); // 과거 좀비 HTML 완벽 박멸
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

    // 💡 위젯 소스 수정 없이 모달 작성자 이름을 '몰 이름'으로 강제로 덮어씌우는 해킹 함수
    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
        const origRender = window.ReviewApp.renderDetail;
        window.ReviewApp.renderDetail = async function(id) {
          // 1. 위젯의 원래 모달 오픈 로직 실행
          await origRender.call(this, id);
          
          // 2. 그려진 즉시 작성자명 텍스트를 몰 이름(CONFIG.mallName)으로 강제 교체
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

      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Range': `${offset}-${offset + CONFIG.limit - 1}` }
        });
        const data = await res.json();
        
        if (data.length < CONFIG.limit) {
          this.hasMore = false;
          const anchor = document.getElementById('rit-scroll-anchor');
          if(anchor) anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
        }

        if (window.ReviewApp) {
          data.forEach(r => {
            if (!window.ReviewApp.data[r.id]) {
              r.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
              r.is_parsed = false; 
              window.ReviewApp.data[r.id] = r;
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
        if (!this.renderedIds.has(r.article_no)) {
          this.renderedIds.add(r.article_no);
          uniqueReviews.push(r);
        }
      });

      if (uniqueReviews.length === 0) return; 

      const html = uniqueReviews.map(r => {
        const imgUrl = (r.image_urls && r.image_urls.length > 0 && r.image_urls[0] !== CONFIG.defaultImg) ? r.image_urls[0] : CONFIG.defaultImg;
        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-meta">
                <span>${CONFIG.mallName}</span> <!-- 💡 갤러리 리스트 작성자 이름 강제 고정 -->
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" style="height:12px; filter: invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.5)); background: rgba(255, 255, 255, 0.2); padding: 2px 4px; border-radius: 4px;">
              </div>
            </div>
          </div>
        `;
      }).join('');
      grid.insertAdjacentHTML('beforeend', html);
    },

    initIntersectionObserver() {
      const anchor = document.getElementById('rit-scroll-anchor');
      if(!anchor) return;
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