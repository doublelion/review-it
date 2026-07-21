/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 위젯 엔진 데이터 100% 동기화 (이미지 누락 해결, 중복 차단, 스와이퍼 원격 교정)
 */
(function (window) {
  // 🛑 스크립트 중복 실행 원천 차단
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
    return cafe24MallId || fallbackMallId || 'default_mall';
  };

  const currentMallId = getDynamicConfig();
  if (currentMallId !== 'ykinas') return; // 테스트 몰 외 차단

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
    page: 1, // 위젯이 이미 1페이지(0~14)를 로드하므로, 리스트 엔진은 2페이지(15~)부터 대기
    isLoading: false,
    hasMore: true,
    renderedIds: new Set(), // 렌더링된 리뷰 ID 장부 (이중 노출 철통 방어)

    init() {
      console.log("▶ [REVIEW-IT] 리스트 엔진 가동: 기존 위젯 데이터 동기화 대기 중...");
      this.hideConflicts();
      this.injectGridCSS();
      this.createLayout();

      // 위젯이 데이터를 수집할 때까지 기다렸다가 렌더링
      this.waitForWidgetData();
    },

    hideConflicts() {
      const selectors = ['.xans-board-listpackage', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => el.style.setProperty('display', 'none', 'important'));
    },

    injectGridCSS() {
      if (document.getElementById('rit-list-grid-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-list-grid-css';
      style.innerHTML = `
        /* 메인 위젯 숨김 */
        #review-it-widget, #rit-widget-container { display: none !important; }
        
        /* 갤러리 뷰 CSS */
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
        
        /* 💡 [핵심 픽스] 위젯 수정 없이 모달 다중 이미지 스와이퍼 깨짐 원격 치료 */
        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      if (document.querySelector('.rit-list-container')) return;
      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" style="text-align:center; padding:30px; color:#999; font-size:13px;">리뷰를 불러오는 중입니다...</div>
      `;
      wrapper.appendChild(container);
    },

    // 💡 위젯(ReviewApp)이 Supabase 통신 및 이미지 스크래핑을 마칠 때까지 폴링(Polling) 대기
    waitForWidgetData() {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.ReviewApp && window.ReviewApp.listOrder && window.ReviewApp.listOrder.length > 0) {
          clearInterval(checkInterval);
          console.log("▶ [REVIEW-IT] 위젯 데이터 동기화 완료! 리스트 렌더링 개시");

          // 위젯이 파싱해둔 데이터를 그대로 가져와서 화면에 출력
          const initialReviews = window.ReviewApp.listOrder.map(id => window.ReviewApp.data[id]).filter(Boolean);
          this.renderItems(initialReviews);
          this.initIntersectionObserver();

        } else if (attempts > 50) { // 5초 이상 응답 없으면 자체 통신 시작 (Fallback)
          clearInterval(checkInterval);
          console.log("▶ [REVIEW-IT] 위젯 데이터 지연. 안전 모드로 자체 로딩 시작");
          this.page = 0; // 자체 로딩이므로 0페이지부터
          this.fetchMoreReviews();
          this.initIntersectionObserver();
        }
      }, 100);
    },

    // 무한 스크롤 발생 시 추가 데이터를 불러오는 함수
    async fetchMoreReviews() {
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

        // 스크롤로 새로 불러온 데이터도 위젯의 스크래핑 엔진을 빌려 이미지를 긁어옴
        const enrichedData = await Promise.all(data.map(async (r) => {
          if (window.ReviewApp && window.ReviewApp._fetchAndSeparateContent) {
            if (window.ReviewApp.data[r.id] && window.ReviewApp.data[r.id].is_parsed) return window.ReviewApp.data[r.id];

            const scraped = await window.ReviewApp._fetchAndSeparateContent(r.article_no, r.board_no);
            if (scraped) {
              // 스크래핑된 이미지가 있으면 적용, 없으면 Supabase 이미지 적용
              r.all_images = (scraped.images && scraped.images.length > 0) ? scraped.images : (r.image_urls || [CONFIG.defaultImg]);
              r.is_parsed = true;
            }
            window.ReviewApp.data[r.id] = r;
          }
          return r;
        }));

        this.renderItems(enrichedData);
        this.page++;
      } catch (error) {
        console.error("❌ [REVIEW-IT] 추가 리스트 로드 실패:", error);
      } finally {
        setTimeout(() => { this.isLoading = false; }, 300); // 락 해제 딜레이
      }
    },

    renderItems(reviews) {
      const grid = document.getElementById('rit-masonry-grid');
      if (!grid) return;

      // 🛑 장부에 기록된 ID는 무시하고, 새로운 데이터만 추출하여 중복 원천 차단
      const uniqueReviews = reviews.filter(r => !this.renderedIds.has(r.id));
      uniqueReviews.forEach(r => this.renderedIds.add(r.id));

      if (uniqueReviews.length === 0) return; // 그릴 게 없으면 조용히 종료

      const html = uniqueReviews.map(r => {
        // 위젯이 파싱해둔 썸네일을 1순위로 사용 (카메라 아이콘 대체 완료)
        const imgUrl = (r.all_images && r.all_images.length > 0 && r.all_images[0] !== CONFIG.defaultImg)
          ? r.all_images[0]
          : ((r.image_urls && r.image_urls.length > 0 && r.image_urls[0] !== CONFIG.defaultImg) ? r.image_urls[0] : CONFIG.defaultImg);

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
      if (!anchor) return;
      const observer = new IntersectionObserver((entries) => {
        // 화면 하단에 도착하면 무한 스크롤(2페이지) 통신 시작
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
          this.fetchMoreReviews();
        }
      }, { rootMargin: '200px' });
      observer.observe(anchor);
    }
  };

  window.ReviewListApp = ReviewListApp;

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);