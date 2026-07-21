/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 로딩 중복 제거, 진성 맨선리 뷰(본문 2줄 노출), 모달 레이아웃 100% 위젯 동기화
 */
(function (window) {
  if (window.RIT_LIST_LOADED) return;
  window.RIT_LIST_LOADED = true;

  // HTML 태그를 벗겨내고 순수 텍스트만 추출하는 헬퍼 함수
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
      console.log("▶ [REVIEW-IT] 리스트 엔진 가동 (프리미엄 맨선리 뷰 적용)");
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
        
        /* 🛑 [핵심 픽스] 역동적인 맨선리를 위해 이미지 고정 비율 삭제 및 본문 영역 2줄 세팅 */
        .rit-masonry-item { break-inside: avoid; margin-bottom: 15px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; border: 1px solid #eee; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; } /* aspect-ratio 삭제 -> 진성 맨선리 */
        .rit-masonry-info { padding: 15px; }
        .rit-masonry-subject { font-size: 13px; color: #222; font-weight: 700; line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888; border-top: 1px solid #f5f5f5; padding-top: 10px; }
        
        /* 🛑 [핵심 픽스] 모달 좌측 꼴보기 싫은 흰선 박멸, 완벽한 블랙 강제 고정 */
        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; background: #000 !important; }
        .rit-img-side { background: #000 !important; }
        
        /* 🛑 [핵심 픽스] 모달 상단 헤더, 위젯(PC 뷰)처럼 완벽히 밖으로 띄우고 투명화 */
        @media (min-width: 768px) {
          .rit-modal-window { overflow: visible !important; }
          .rit-modal-header { position: absolute !important; top: -60px !important; left: 0; right: 0; background: transparent !important; padding: 0 !important; display: flex !important; z-index: 99999 !important; border: none !important; }
          .btn-rit-grid { display: flex !important; visibility: visible !important; color: #fff !important; background: transparent !important; }
          .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; border-left: 1px solid rgba(255,255,255,0.4); padding-left: 10px; margin-left: 5px; }
          .btn-rit-close { color: #fff !important; }
        }
        
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      // 🛑 [결정적 픽스] 이중 로딩 텍스트 및 좀비 더미 컨테이너 모조리 색출 후 폭파
      document.querySelectorAll('.rit-list-container, #rit-scroll-anchor').forEach(el => el.remove());

      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" style="text-align:center; padding:30px; color:#999; font-size:13px; font-weight:500;">리뷰를 불러오는 중입니다...</div>
      `;
      wrapper.appendChild(container);
    },

    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
        const origRender = window.ReviewApp.renderDetail;
        window.ReviewApp.renderDetail = async function(id) {
          await origRender.call(this, id);
          const authorEl = document.querySelector('#ritMetaArea .rit-author');
          if (authorEl) {
             authorEl.innerText = CONFIG.mallName;
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
          if(anchor) anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
        }

        // 💡 [본문 출력 픽스] 데이터를 넘길 때 본문(clean_text_body)을 미리 세팅하여 "본문이 없습니다" 출력 방어
        if (window.ReviewApp) {
          data.forEach(r => {
            if (!window.ReviewApp.data[r.id]) {
              r.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
              r.is_parsed = false; 
              r.clean_text_body = stripHtml(r.content || ''); // 본문 태그 제거 후 주입
              window.ReviewApp.data[r.id] = r;
              window.ReviewApp.listOrder.push(r.id);
            }
          });
        }

        // 혹시 카페24 스킨에 하드코딩된 '모든 리뷰를 불러왔습니다.' 텍스트가 있다면 지워달라고 콘솔에 안내
        console.log("▶ [안내] 카페24 게시판 HTML 소스에 하드코딩된 텍스트가 있다면 지워주셔야 화면이 가장 깔끔합니다.");

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
        const checkKey = r.article_no || r.id; 
        if (!this.renderedIds.has(checkKey)) {
          this.renderedIds.add(checkKey);
          uniqueReviews.push(r);
        }
      });

      if (uniqueReviews.length === 0) return; 

      const html = uniqueReviews.map(r => {
        const imgUrl = (r.image_urls && r.image_urls.length > 0 && r.image_urls[0] !== CONFIG.defaultImg) ? r.image_urls[0] : CONFIG.defaultImg;
        // 💡 [모바일 퍼스트 픽스] 본문 내용 순수 텍스트 추출
        const cleanContent = stripHtml(r.content || '');

        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-desc">${cleanContent}</div> <!-- 본문 2줄 출력 영역 -->
              <div class="rit-masonry-meta">
                <span style="font-weight:600; color:#555;">${CONFIG.mallName}</span>
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" style="height:12px; filter: invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.5)); background: rgba(255, 255, 255, 0.2); padding: 2px 4px; border-radius: 4px;">
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