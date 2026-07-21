/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 기존 프리미엄 모달(ReviewApp) 완벽 연동 및 CSS 충돌 원천 차단
 */
(function (window) {
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
    return cafe24MallId || fallbackMallId || 'default_mall';
  };

  const currentMallId = getDynamicConfig();
  if (currentMallId !== 'ykinas') return;

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
    mallId: currentMallId,
    limit: 15, 
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    starPath: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating'
  };

  const ReviewListApp = {
    page: 0,
    isLoading: false,
    hasMore: true,

    init() {
      console.log("▶ [REVIEW-IT] 리스트 뷰 및 기존 모달 연동 시작");
      this.hideConflicts();
      this.injectGridCSS(); // 모달 CSS는 건드리지 않고 오직 리스트 격자 CSS만 주입
      this.createLayout();
      this.fetchReviews();
      this.initIntersectionObserver();
    },

    hideConflicts() {
      const selectors = ['.xans-board-listpackage', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => el.style.setProperty('display', 'none', 'important'));
      
      const mainWidget = document.getElementById('review-it-widget');
      if (mainWidget) mainWidget.style.setProperty('display', 'none', 'important');
    },

    injectGridCSS() {
      const style = document.createElement('style');
      style.innerHTML = `
        /* 하단 중복 롤링 위젯 강제 숨김 */
        #review-it-widget, #rit-widget-container { display: none !important; }
        
        /* 맨선리 격자 레이아웃 전용 CSS */
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
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" style="text-align:center; padding:30px; color:#999; font-size:13px;">리뷰를 불러오는 중입니다...</div>
      `;
      wrapper.appendChild(container);
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
          document.getElementById('rit-scroll-anchor').innerHTML = '모든 리뷰를 불러왔습니다.';
        }
        
        // 💡 [핵심 연동 포인트] 불러온 데이터를 기존 전역 ReviewApp.data에 주입
        if (window.ReviewApp) {
          data.forEach(r => {
            if (!window.ReviewApp.data[r.id]) {
              window.ReviewApp.data[r.id] = r;
              window.ReviewApp.listOrder.push(r.id);
            }
          });
        }

        this.renderItems(data);
        this.page++;
      } catch (error) {
        console.error("❌ [REVIEW-IT] 리스트 로드 실패:", error);
      } finally {
        this.isLoading = false;
      }
    },

    renderItems(reviews) {
      const grid = document.getElementById('rit-masonry-grid');
      const html = reviews.map(r => {
        const imgUrl = (r.image_urls && r.image_urls.length > 0) ? r.image_urls[0] : CONFIG.defaultImg;
        // 💡 기존 위젯의 완벽한 모달 팝업(ReviewApp.openModal)을 그대로 호출!
        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-meta">
                <span>${r.writer || '고객'}</span>
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
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) this.fetchReviews();
      }, { rootMargin: '200px' });
      observer.observe(anchor);
    }
  };

  // 전역 접근 허용 (혹시 모를 에러 방지)
  window.ReviewListApp = ReviewListApp;

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);