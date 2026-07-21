/**
 * @Project: Review-It Universal Board List Engine
 * @Update: 위젯 중복 노출 제거, 맨선리 무한 스크롤, 실시간 모달 팝업 및 본문 이미지 파싱 적용
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
    data: {}, // 리뷰 상세 데이터 임시 저장소

    init() {
      this.hideConflicts();
      this.injectCSS();
      this.createLayout();
      this.fetchReviews();
      this.initIntersectionObserver();
      this.initModal();
    },

    // 💡 위젯 및 기존 게시판 충돌 방지
    hideConflicts() {
      // 1. 기존 게시판 숨김
      const selectors = ['.xans-board-listpackage', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => el.style.setProperty('display', 'none', 'important'));

      // 2. 메인 롤링 위젯이 리스트 페이지에 떴다면 강제 삭제 (상단 중복 노출 해결)
      const mainWidget = document.getElementById('review-it-widget');
      if (mainWidget) mainWidget.style.setProperty('display', 'none', 'important');
    },

    // 1. 인스타그램 피드형 무한 스크롤 (Visual First)
    injectCSS() {
      const style = document.createElement('style');
      style.innerHTML = `
        /* [신규 픽스] 메인 롤링 위젯 원천 차단 */
        #review-it-widget, #rit-widget-container { display: none !important; }
        .rit-list-container { width: 100%; max-width: 1200px; margin: 40px auto; padding: 0 15px; }
        .rit-masonry-grid { column-count: 2; column-gap: 10px; }
        @media (min-width: 768px) { .rit-masonry-grid { column-count: 3; column-gap: 15px; } }
        @media (min-width: 1024px) { .rit-masonry-grid { column-count: 4; column-gap: 20px; } }
        .rit-masonry-item { break-inside: avoid; margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; border: 1px solid #eee; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; display: block; object-fit: cover; aspect-ratio: 1/1; }
        .rit-masonry-info { padding: 12px; }
        .rit-masonry-subject { font-size: 13px; color: #222; font-weight: 500; line-height: 1.4; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888; }
        
        /* 모달 CSS */
        .rit-modal-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; display: flex; align-items: center; justify-content: center; }
        .rit-modal-bg { position: absolute; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); }
        .rit-modal-window { position: relative; width: 90%; max-width: 900px; height: 80vh; background: #fff; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; z-index: 2; }
        .rit-modal-header { height: 60px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; font-weight: bold; }
        .rit-modal-body { display: flex; flex: 1; overflow: hidden; flex-direction: column; }
        @media (min-width: 768px) { .rit-modal-body { flex-direction: row; } }
        .rit-img-side { flex: 1; background: #f9f9f9; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .rit-txt-side { flex: 1; padding: 30px; overflow-y: auto; }
        .btn-rit-close { background: none; border: none; font-size: 20px; cursor: pointer; }
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

        data.forEach(r => this.data[r.id] = r); // 데이터 저장
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
        return `
          <div class="rit-masonry-item" onclick="ReviewListApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-meta">
                <span>${r.writer || '고객'}</span>
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" style="height:12px;">
              </div>
            </div>
          </div>
        `;
      }).join('');
      grid.insertAdjacentHTML('beforeend', html);
    },

    initIntersectionObserver() {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) this.fetchReviews();
      }, { rootMargin: '200px' });
      observer.observe(document.getElementById('rit-scroll-anchor'));
    },

    // 2. 끊김 없는 팝업(Modal) 경험 (Zero Friction)
    initModal() {
      const modal = document.createElement('div');
      modal.id = 'ritListModal';
      modal.className = 'rit-modal-container';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="rit-modal-bg" onclick="ReviewListApp.closeModal()"></div>
        <div class="rit-modal-window">
          <div class="rit-modal-header">
            <span>REVIEW-IT 상세뷰</span>
            <button onclick="ReviewListApp.closeModal()" class="btn-rit-close">✕</button>
          </div>
          <div class="rit-modal-body">
            <div id="ritModalImgArea" class="rit-img-side"></div>
            <div class="rit-txt-side">
              <div id="ritModalMeta" style="margin-bottom:15px; font-size:12px; color:#888;"></div>
              <h3 id="ritModalSubject" style="margin-top:0; font-size:18px; line-height:1.4;"></h3>
              <div id="ritModalContent" style="font-size:14px; color:#444; line-height:1.6; margin-top:20px;"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    async openModal(id) {
      const d = this.data[id];
      if (!d) return;

      document.getElementById('ritListModal').style.display = 'flex';
      document.body.style.overflow = 'hidden'; // 뒤 배경 스크롤 방지

      document.getElementById('ritModalSubject').innerText = d.subject;
      document.getElementById('ritModalMeta').innerHTML = `<span>${d.writer || '고객'}</span> | <img src="${CONFIG.starPath}${d.stars || 5}.svg" style="height:12px; vertical-align:middle;">`;
      document.getElementById('ritModalContent').innerHTML = "본문 데이터를 불러오는 중입니다...";
      document.getElementById('ritModalImgArea').innerHTML = `<img src="${(d.image_urls && d.image_urls.length > 0) ? d.image_urls[0] : CONFIG.defaultImg}" style="max-width:100%; max-height:100%; object-fit:contain;">`;

      // 💡 [핵심] 게시글 본문 파싱 (관리자가 작성한 글 내의 이미지/텍스트 추출)
      try {
        const res = await fetch(`/board/product/read.html?board_no=${d.board_no}&no=${d.article_no}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail');
        if (contentArea) {
          const imgs = contentArea.querySelectorAll('img');
          const extractedImages = [];

          imgs.forEach(img => {
            let src = img.getAttribute('src');
            if (src && !src.match(/star|icon|btn|logo|dummy|ec2-common|rating|clear/i)) {
              src = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? window.location.origin + src : src);
              extractedImages.push(src);
            }
            img.remove(); // 텍스트 영역에서 이미지는 제거 (좌측 스와이퍼로 넘기기 위함)
          });

          document.getElementById('ritModalContent').innerHTML = contentArea.innerHTML.trim();

          // 💡 스와이퍼 적용 (추출된 이미지가 있을 경우)
          if (extractedImages.length > 0) {
            document.getElementById('ritModalImgArea').innerHTML = `
              <div class="swiper rit-list-modal-swiper" style="width:100%; height:100%;">
                <div class="swiper-wrapper">
                  ${extractedImages.map(img => `
                    <div class="swiper-slide" style="display:flex; align-items:center; justify-content:center; background:#000;">
                      <img src="${img}" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </div>
                  `).join('')}
                </div>
                <div class="swiper-button-next" style="color:#fff;"></div>
                <div class="swiper-button-prev" style="color:#fff;"></div>
              </div>
            `;
            if (window.Swiper) {
              new Swiper('.rit-list-modal-swiper', {
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                loop: extractedImages.length > 1
              });
            }
          }
        } else {
          document.getElementById('ritModalContent').innerHTML = "본문을 확인할 수 없습니다.";
        }
      } catch (e) {
        console.error("본문 로딩 실패", e);
      }
    },

    closeModal() {
      document.getElementById('ritListModal').style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  window.ReviewListApp = ReviewListApp;

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);