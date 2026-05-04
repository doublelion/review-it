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

    // (이하 renderWidget, getCardHTML, openModal, renderDetail 등 UI 로직은 대표님 소스 유지)
    renderWidget() {
      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (!container) return;

      const gridClass = `rit-pc-r${this.settings.grid_rows_desktop} rit-mo-r${this.settings.grid_rows_mobile}`;
      let html = `
        <div class="rit-header-area">
          <div class="rit-tagline">${this.settings.tagline}</div>
          <h2 class="rit-main-title">${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
        ${this.settings.display_type === 'grid'
          ? `<div class="rit-main-grid-layout ${gridClass}">${this.listOrder.map(id => this.getCardHTML(id)).join('')}</div>`
          : `<div class="swiper rit-main-swiper"><div class="swiper-wrapper">${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}</div></div>`
        }
        <div id="ritModal" class="rit-modal-container" style="display:none;">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
             <!-- 상세 모달 구조 (대표님 원본 유지) -->
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
        </div>
      `;
      container.innerHTML = html;

      if (this.settings.display_type !== 'grid' && window.Swiper) {
        new Swiper('.rit-main-swiper', {
          slidesPerView: 2.2, spaceBetween: 15, autoplay: { delay: 4000 },
          breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 25 } }
        });
      }
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