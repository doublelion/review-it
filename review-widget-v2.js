/**
 * @Project: Review-It Universal Widget Engine v9.1 (Precision Update)
 * @Update: 하이브리드 이미지 스캔 강화, 상세페이지 상품 타겟팅, 클라이언트 정렬 보충
 * @Philosophy: "Install & Forget" - 누락 없는 데이터 수집과 완벽한 렌더링
 */
(function (window) {
  const getDynamicConfig = () => {
    const host = window.location.hostname;
    let mallId = host.split('.').filter(part => !['www', 'm', 'cafe24', 'com'].includes(part))[0];
    if (!mallId) mallId = 'default_mall';

    const getProductNo = () => {
      if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return window.iProductNo;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('product_no') || null;
    };

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId,
      PRODUCT_NO: getProductNo(), // 현재 보고 있는 상품 번호
      BOARD_NO: '4',
      DEFAULT_IMG: '//img.echosting.cafe24.com/thumb/img_product_medium.gif',
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|star_fill|star_empty|rating/i,
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자']
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    settings: {
      display_type: 'grid',
      tagline: 'REVIEW-IT',
      title: 'REAL PHOTO FEED',
      description: '실제 고객님들의 생생한 후기',
      display_limit: 15,
      grid_rows_desktop: 1,
      grid_rows_mobile: 2
    },

    async init() {
      this.injectCSS();
      await this.loadWidgetSettings();
      await this.loadReviews();
      this.renderWidget();
    },

    async loadWidgetSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const s = data[0];
          Object.keys(this.settings).forEach(key => {
            if (s[key] !== undefined && s[key] !== null) {
              this.settings[key] = (key === 'description') ? s[key].replace(/\n/g, '<br>') : s[key];
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 기본 설정을 유지합니다."); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => name.includes(k))) return name;
      return name.length > 1 ? name.charAt(0) + "*".repeat(name.length - 1) : name;
    },

    // [보충: 정밀 이미지 스캔] v8.5 로직 계승 및 강화
    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail');
        const imgs = Array.from((contentArea || doc).querySelectorAll('img')).map(img => {
          let src = img.getAttribute('src');
          if (!src || CONFIG.SPAM_KEYWORDS.test(src) || src.includes('.gif')) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        }).filter(src => src !== null);
        return imgs;
      } catch (e) { return []; }
    },

    // [추가] 상세페이지에서 리뷰 본문을 추출하는 함수
    async _fetchFullContent(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 카페24의 다양한 스킨에 대응하는 본문 영역 셀렉터
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail');

        // 이미지 태그 등 불필요한 요소 필터링이 필요하다면 여기서 추가 전처리 가능
        return contentArea ? contentArea.innerHTML : null;
      } catch (e) {
        console.warn("[REVIEW-IT] 본문 로드 실패, 요약본으로 대체합니다.", e);
        return null;
      }
    },

    async loadReviews() {
      try {
        // [보충: 상품 상세페이지일 경우 해당 상품 리뷰만 필터링]
        let apiUrl = `${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true`;
        if (CONFIG.PRODUCT_NO) {
          apiUrl += `&product_no=eq.${CONFIG.PRODUCT_NO}`;
        }
        apiUrl += `&order=created_at.desc`;

        const res = await fetch(apiUrl, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        if (!list || list.length === 0) return;

        this.data = {};
        this.listOrder = [];

        // [보충: 비동기 딥스캔 병렬 처리 최적화]
        await Promise.all(list.slice(0, this.settings.display_limit).map(async (r) => {
          const id = String(r.id);

          // 이미지가 없거나 부족한 경우 실시간 딥스캔 실행 (v8.5 핵심로직)
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.filter(img => !CONFIG.SPAM_KEYWORDS.test(img));

          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];

          this.data[id] = r;
          this.listOrder.push(id);
        }));

        // [보충: 클라이언트 사이드 최종 정렬]
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));

      } catch (e) { console.error("[REVIEW-IT] 데이터 처리 에러:", e); }
    },

    renderWidget() {
      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (!container) return;

      const isGrid = this.settings.display_type === 'grid';
      const limit = this.settings.display_limit || 15;
      const reviews = this.listOrder.slice(0, limit);

      // 설정값 처리
      let pcCols, moCols;
      if (isGrid) {
        pcCols = parseInt(this.settings.grid_rows_desktop) || 5;
        moCols = parseInt(this.settings.grid_rows_mobile) || 2;
      } else {
        pcCols = 5;   // 스와이프 데스크탑 고정
        moCols = 2.2; // 스와이프 모바일 고정
      }

      let mainHtml = `
    <style>
      #review-it-widget { max-width: 1260px !important; margin: 0 auto !important; padding: 40px 20px; box-sizing: border-box; }
      .rit-main-title { font-size: 32px !important; font-weight: 800 !important; text-align: center; margin: 10px 0 !important; }
      
      /* 그리드 레이아웃 스타일 (이 부분은 CSS 표준이라 반전 버그가 없습니다) */
      .rit-main-grid-layout {
        display: grid !important;
        gap: 15px;
        grid-template-columns: repeat(${Math.floor(moCols)}, 1fr) !important;
      }

      @media (min-width: 1024px) {
        .rit-main-grid-layout {
          grid-template-columns: repeat(${pcCols}, 1fr) !important;
          gap: 20px;
        }
      }
      
      .rit-main-swiper .rit-card { width: 100%; height: auto; }
    </style>

    <div class="rit-header-area" style="text-align:center; margin-bottom:30px;">
      <div class="rit-tagline" style="font-size:12px; color:#b38a58; font-weight:700;">${this.settings.tagline}</div>
      <h2 class="rit-main-title">${this.settings.title}</h2>
      <div class="rit-line"></div>
      <p class="rit-desc">${this.settings.description}</p>
    </div>

    ${isGrid
          ? `<div class="rit-main-grid-layout">${reviews.map(id => this.getCardHTML(id)).join('')}</div>`
          : `<div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${reviews.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}
          </div>
         </div>`
        }
  `;

      container.innerHTML = mainHtml;

      // [핵심 해결] 카페24 구버전 Swiper 충돌 원천 차단 로직
      // Breakpoints를 쓰지 않고 브라우저 가로폭을 직접 계산하여 강제 부여합니다.
      if (!isGrid && window.Swiper) {
        const getSwiperConfig = () => {
          const isPc = window.innerWidth >= 1024;
          return {
            slidesPerView: isPc ? pcCols : moCols,
            spaceBetween: isPc ? 20 : 12,
            observer: true,
            observeParents: true
          };
        };

        // 초기 인스턴스 생성
        let ritSwiper = new Swiper('.rit-main-swiper', getSwiperConfig());

        // 화면 크기가 모바일<->PC로 바뀔 때만 안전하게 인스턴스 재시작
        let isDesktopLast = window.innerWidth >= 1024;
        window.addEventListener('resize', () => {
          const isDesktopNow = window.innerWidth >= 1024;
          if (isDesktopLast !== isDesktopNow) {
            isDesktopLast = isDesktopNow;
            if (ritSwiper && ritSwiper.destroy) ritSwiper.destroy(true, true);
            ritSwiper = new Swiper('.rit-main-swiper', getSwiperConfig());
          }
        });
      }

      this.initModal();
    },

    // 모달 중복 생성 방지를 위해 별도 함수로 분리해서 호출하는 것이 깔끔합니다.
    initModal() {
      let modalContainer = document.getElementById('ritModal');
      if (modalContainer) return;

      modalContainer = document.createElement('div');
      modalContainer.id = 'ritModal';
      modalContainer.className = 'rit-modal-container';
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = `
    <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
    <div class="rit-modal-window">
       <div class="rit-modal-header">
          <span class="rit-logo-text">${this.settings.title}</span>
          <div class="rit-header-buttons">
            <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">GRID VIEW</button>
            <button onclick="ReviewApp.closeModal()" class="btn-rit-close">✕</button>
          </div>
       </div>
       <div class="rit-modal-body">
          <div id="ritDetailView" class="rit-flex-container">
            <div id="ritModalImg" class="rit-img-side"></div>
            <div class="rit-txt-side">
              <div id="ritMetaArea"></div>
              <h3 id="ritSubject"></h3>
              <div id="ritContent" class="rit-body-text"></div>
              <div id="ritProductCard"></div>
            </div>
          </div>
          <div id="ritGridView" class="rit-grid-overlay rit-hidden">
            <div id="ritGridInner" class="rit-grid-box-wrap"></div>
          </div>
       </div>
    </div>
  `;
      document.body.appendChild(modalContainer);
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')">
        <img src="${d.all_images[0]}" class="rit-card-img" loading="lazy">
        <div class="rit-card-info">
          <div class="rit-card-subject">${d.subject}</div>
          <div class="rit-card-meta">
            <span>${this.maskName(d.writer)}</span>
            <div class="rit-stars-small"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
          </div>
        </div>
      </div>`;
    },

    async openModal(id) {
      this.currentScrollY = window.pageYOffset;
      document.getElementById('ritModal').style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      await this.renderDetail(id);
    },

    async renderDetail(id) {
      const d = this.data[id];
      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      document.getElementById('ritModalImg').innerHTML = `
        <div class="swiper rit-modal-swiper"><div class="swiper-wrapper">
          ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
        </div><div class="rit-fraction"></div></div>`;

      if (window.Swiper) new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-fraction', type: 'fraction' } });

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-top-meta">
          <span class="rit-name-tag">${this.maskName(d.writer)}</span>
          <span class="rit-divider">|</span>
          <span class="rit-date-tag">${d.created_at.split('T')[0]}</span>
        </div>`;

      document.getElementById('ritSubject').innerText = d.subject;
      const fullContent = await this._fetchFullContent(d.article_no);
      document.getElementById('ritContent').innerHTML = fullContent || d.content;
      this.loadComments(d.article_no);
    },

    // 1. 카페24 게시판에서 댓글 HTML을 긁어오는 함수
    async loadComments(articleNo) {
      const commContainer = document.getElementById('ritCommList') || document.createElement('div');
      commContainer.id = 'ritCommList';
      commContainer.innerHTML = '<div style="padding:20px; text-align:center; font-size:12px; color:#999;">댓글 불러오는 중...</div>';

      // content 영역 하단에 댓글 컨테이너가 없다면 추가
      const contentArea = document.getElementById('ritContent');
      if (!document.getElementById('ritCommList')) {
        contentArea.insertAdjacentElement('afterend', commContainer);
      }

      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 카페24 기본 댓글 리스트 셀렉터 (스킨에 따라 다를 수 있으나 보통 .commentList)
        const comments = Array.from(doc.querySelectorAll('.commentList li, .replyArea li, #commentList .item')).map(el => {
          return {
            writer: el.querySelector('.name, .writer')?.innerText?.trim() || '고객',
            content: el.querySelector('.comment, .content, [class*="comment_"]')?.innerText?.trim() || '',
            date: el.querySelector('.date')?.innerText?.trim() || ''
          };
        }).filter(c => c.content !== "");

        this.renderComments(comments);
      } catch (e) {
        commContainer.innerHTML = ''; // 에러 시 조용히 비움
      }
    },

    // 2. 가져온 댓글 데이터를 화면에 그리는 함수
    renderComments(comments) {
      const container = document.getElementById('ritCommList');
      if (comments.length === 0) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="rit-comm-head" style="margin-top:30px; border-top:1px solid #eee; padding-top:20px; margin-bottom:15px;">
          <span style="font-weight:bold; font-size:13px;">댓글 ${comments.length}</span>
        </div>
        ${comments.map(c => `
          <div class="rit-comm-item" style="margin-bottom:15px; background:#f9f9f9; padding:12px; border-radius:8px;">
            <div style="font-size:11px; font-weight:bold; margin-bottom:5px;">${this.maskName(c.writer)} <span style="font-weight:normal; color:#999; margin-left:5px;">${c.date}</span></div>
            <div style="font-size:13px; color:#555; line-height:1.5;">${c.content}</div>
          </div>
        `).join('')}
      `;
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      // 외부 CSS 파일 로드 (배포된 경로)
      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }
    }
  };

  window.ReviewApp = ReviewApp;
  if (document.readyState === 'complete') ReviewApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);