/**
 * @Project: Review-It Universal Board List Engine
 * @Description: 모바일 퍼스트 맨선리(Pinterest style) 갤러리 뷰 및 무한 스크롤
 */
(function (window) {
  // 1. 설정값 및 Mall ID 가져오기
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
  console.log("▶ [REVIEW-IT Debug] 1. 인식된 몰 ID:", currentMallId);

  // 🛑 [안전 게이트웨이] ykinas 몰이 아니면 스크립트 강제 종료
  if (currentMallId !== 'ykinas') {
    console.log("▶ [REVIEW-IT Debug] ykinas 몰이 아니므로 실행을 안전하게 중단합니다.");
    return;
  }

  // 2. 리뷰 게시판 리스트 페이지 감지 (💡 한글 인코딩 디코딩 및 다중 패턴 감지 적용)
  const currentPath = decodeURIComponent(window.location.pathname);
  const currentSearch = window.location.search;
  console.log("▶ [REVIEW-IT Debug] 2. 디코딩된 URL 경로:", currentPath);
  
  // /board/product/list.html?board_no=4 이거나 /board/상품-사용후기/4/ 형태 모두 감지
  const isReviewBoardPage = 
    currentPath.includes('/board/product/list') || 
    currentPath.includes('상품-사용후기') ||
    (currentPath.includes('/board/') && (currentSearch.includes('board_no=4') || currentPath.includes('/4/')));

  console.log("▶ [REVIEW-IT Debug] 3. 리뷰 게시판 여부 확인:", isReviewBoardPage);

  if (!isReviewBoardPage) {
    console.log("▶ [REVIEW-IT Debug] 여기는 리뷰 리스트 페이지가 아니므로 위젯을 띄우지 않습니다.");
    return; 
  }

  // ---------------------------------------------------------
  // 👇 여기서부터는 기존 ReviewListApp 코드가 그대로 이어집니다.
  // ---------------------------------------------------------
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: currentMallId,
    limit: 10, 
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    starPath: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating'
  };

  const ReviewListApp = {
    page: 0,
    isLoading: false,
    hasMore: true,

    init() {
      console.log("▶ [REVIEW-IT Debug] 4. 모바일 퍼스트 맨선리 뷰 정상 가동 시작!");
      this.hideDefaultBoard();
      this.injectCSS();
      this.createLayout();
      this.fetchReviews();
      this.initIntersectionObserver();
    },

    // 💡 [업그레이드] 카페24 구형, 신형, 프리미엄 스킨의 모든 리뷰 게시판 요소를 완벽 차단
    hideDefaultBoard() {
      const selectors = [
        '.xans-board-listpackage', 
        '.boardSort',                 
        '.xans-board-empty',          
        '#prdReview',                 
        '.xans-product-review',       
        '.review_list_item',          
        'div[id^="ec-product-review"]', 
        '.board-list-wrap'           
      ].join(', ');

      const defaultBoards = document.querySelectorAll(selectors);
      
      defaultBoards.forEach(el => {
        el.style.setProperty('display', 'none', 'important');
      });

      console.log(`▶ [REVIEW-IT Debug] 5. 기본 리뷰 게시판 DOM 차단 완료`);
    },

    // 초경량 맨선리 CSS 주입 (모바일 퍼스트)
    injectCSS() {
      const style = document.createElement('style');
      style.innerHTML = `
        .rit-list-container {
          width: 100%;
          max-width: 1200px;
          margin: 40px auto;
          padding: 0 15px;
        }
        /* 순수 CSS 맨선리 핵심 로직 */
        .rit-masonry-grid {
          column-count: 2; /* 모바일: 기본 2열 */
          column-gap: 10px;
        }
        @media (min-width: 768px) {
          .rit-masonry-grid { column-count: 3; column-gap: 15px; } /* 태블릿: 3열 */
        }
        @media (min-width: 1024px) {
          .rit-masonry-grid { column-count: 4; column-gap: 20px; } /* PC: 4열 */
        }
        .rit-masonry-item {
          break-inside: avoid; /* 요소가 열 사이에서 잘리지 않도록 방지 */
          margin-bottom: 10px;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        @media (min-width: 1024px) {
          .rit-masonry-item { margin-bottom: 20px; }
          .rit-masonry-item:hover { transform: translateY(-3px); }
        }
        .rit-masonry-img {
          width: 100%;
          display: block;
          object-fit: cover;
        }
        .rit-masonry-info {
          padding: 12px;
        }
        .rit-masonry-subject {
          font-size: 13px;
          color: #222;
          font-weight: 500;
          line-height: 1.4;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rit-masonry-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #888;
        }
        .rit-loading-spinner {
          text-align: center;
          padding: 30px;
          color: #999;
          font-size: 13px;
        }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      const wrapper = document.querySelector('#contents') || document.querySelector('.xans-board-listpackage').parentNode || document.body;
      
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      
      container.innerHTML = `
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" class="rit-loading-spinner">리뷰를 불러오는 중입니다...</div>
      `;
      
      wrapper.appendChild(container);
    },

    // 수파베이스에서 페이징 처리하여 데이터 가져오기 (초기 10개, 스크롤시 추가 10개)
    async fetchReviews() {
      if (this.isLoading || !this.hasMore) return;
      this.isLoading = true;

      const offset = this.page * CONFIG.limit;
      // PostgREST Range header: "0-9", "10-19" ...
      const rangeHeader = `${offset}-${offset + CONFIG.limit - 1}`; 

      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 
            'apikey': CONFIG.sbKey, 
            'Authorization': `Bearer ${CONFIG.sbKey}`,
            'Range': rangeHeader
          }
        });

        const data = await res.json();
        
        if (data.length < CONFIG.limit) {
          this.hasMore = false;
          document.getElementById('rit-scroll-anchor').innerHTML = '모든 리뷰를 불러왔습니다.';
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
        const writer = r.writer || '고객';
        const stars = r.stars || 5;

        // onClick 이벤트에 기존 review-widget.js의 모달 오픈 함수(ReviewApp.openModal) 연결
        // (단, 기존 모달 로직이 전역 window.ReviewApp으로 떠있다는 전제. 통합 시 수정 가능)
        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-meta">
                <span>${writer}</span>
                <img src="${CONFIG.starPath}${stars}.svg" style="height:12px;">
              </div>
            </div>
          </div>
        `;
      }).join('');

      grid.insertAdjacentHTML('beforeend', html);
    },

    // Intersection Observer를 활용한 무한 스크롤 (화면 하단에 닿으면 자동 로드)
    initIntersectionObserver() {
      const anchor = document.getElementById('rit-scroll-anchor');
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
          this.fetchReviews();
        }
      }, { rootMargin: '200px' }); // 미리 200px 앞서서 로딩 시작 (UX 최적화)
      
      observer.observe(anchor);
    }
  };

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);