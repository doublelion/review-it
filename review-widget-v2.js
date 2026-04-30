/**
 * @Project: Review-It Widget Engine v8.0
 * @Update: 실시간 본문 복구 + 모달 레이아웃 최적화 + 관리자 설정 연동
 */
(function (window) {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: 'ecudemo389879',
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png',
    STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
    ADMIN_KEYWORDS: ['관리자', 'Official', '운영자'],
    SPAM_KEYWORDS: /star|icon|btn|twitch|logo|dummy|ec2-common|star_fill|star_empty/i
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    settings: {
      display_type: 'grid',
      tagline: 'PEOPLE CHOICE',
      title: 'REAL PHOTO FEED',
      description: '실제 고객님들의 생생한 후기'
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
          if (s.display_type) this.settings.display_type = s.display_type;
          if (s.tagline) this.settings.tagline = s.tagline;
          if (s.title) this.settings.title = s.title;
          if (s.description) this.settings.description = s.description.replace(/\n/g, '<br>');
          if (s.display_limit !== undefined) this.settings.display_limit = s.display_limit;
          if (s.grid_rows_desktop !== undefined) this.settings.grid_rows_desktop = s.grid_rows_desktop;
          if (s.grid_rows_mobile !== undefined) this.settings.grid_rows_mobile = s.grid_rows_mobile;
        }
      } catch (e) { console.error("설정 로드 에러:", e); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => String(name).includes(k))) return name;
      let n = String(name).split('[')[0].replace(/[*]/g, '').trim();
      if (n.length > 10) return "고객";
      if (n.length <= 1) return n + "*";
      if (n.length === 2) return n[0] + "*";
      return n.substring(0, 2) + "**";
    },

    async _fetchFullContent(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail');
        if (!contentArea) return null;
        return contentArea.innerHTML.replace(/<img[^>]*>|<button[^>]*>.*?<\/button>|<script[^>]*>.*?<\/script>/g, "").trim();
      } catch (e) { return null; }
    },

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

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        const limit = this.settings.display_limit || 15;
        const targetList = list.slice(0, limit);

        this.data = {};
        this.listOrder = [];

        await Promise.all(targetList.map(async (r) => {
          const id = String(r.id);
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.filter(src => !CONFIG.SPAM_KEYWORDS.test(src));
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }));
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error("로드 에러:", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      // [스마트 로직] 데스크탑 줄 수와 모바일 줄 수를 조합한 고유 타입을 부여합니다.
      const pcRows = this.settings.grid_rows_desktop || 1;
      const moRows = this.settings.grid_rows_mobile || 2;
      const gridTypeClass = `rit-pc-r${pcRows} rit-mo-r${moRows}`;


      let html = `
        <div class="rit-header-area">
          <div class="rit-tagline">${this.settings.tagline}</div>
          <h2>${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
      `;
      if (this.settings.display_type === 'grid') {
        html += `<div class="rit-main-grid-layout ${gridTypeClass}">${this.listOrder.map(id => this.getCardHTML(id)).join('')}</div>`;
      } else {
        html += `<div class="swiper rit-main-swiper"><div class="swiper-wrapper">${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}</div></div>`;
      }
      html += `
        <div id="ritModal" class="rit-modal-container">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
            <div class="rit-modal-header">
              <span class="rit-logo-text">${this.settings.title}</span>
              <div class="rit-header-buttons">
                <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="9" height="9" rx="1" />
                    <rect x="13" y="2" width="9" height="9" rx="1" />
                    <rect x="2" y="13" width="9" height="9" rx="1" />
                    <rect x="13" y="13" width="9" height="9" rx="1" />
                  </svg>
                  GRID VIEW
                </button>
                <button onclick="ReviewApp.closeModal()" class="btn-rit-close">✕</button>
              </div>
            </div>
            <div class="rit-modal-body">
              <div id="ritDetailView" class="rit-flex-container">
                <div id="ritModalImg" class="rit-img-side"></div>
                <div class="rit-txt-side">
                  <div id="ritMetaArea"></div>
                  <h3 id="ritSubject"></h3>
                  <div id="ritContent" class="rit-body-text">불러오는 중...</div>
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
      if (this.settings.display_type !== 'grid') {
        new Swiper('.rit-main-swiper', { slidesPerView: 2.2, spaceBetween: 15, autoplay: { delay: 4000 }, breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 25 } } });
      }
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')"><img src="${d.all_images[0]}" class="rit-card-img" loading="lazy"><div class="rit-card-info"><div class="rit-card-subject">${d.subject}</div><div class="rit-card-meta"><span>${this.maskName(d.writer)}</span><div class="rit-stars-small"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div></div></div></div>`;
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
      document.getElementById('ritModalImg').innerHTML = `<div class="swiper rit-modal-swiper"><div class="swiper-wrapper">${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}</div><div class="rit-fraction"></div></div>`;
      new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-fraction', type: 'fraction' } });
      document.getElementById('ritMetaArea').innerHTML = `<div class="rit-top-meta"><span class="rit-name-tag">${this.maskName(d.writer)}</span><span class="rit-divider">|</span><div class="rit-star-box"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div><span class="rit-date-tag">${new Date(d.created_at).toLocaleDateString()}</span></div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      const fullContent = await this._fetchFullContent(d.article_no);
      document.getElementById('ritContent').innerHTML = fullContent || d.content.replace(/<[^>]*>?/gm, '');
      this.loadComments(d.article_no);
    },

    toggleGrid() {
      const gv = document.getElementById('ritGridView');
      const gi = document.getElementById('ritGridInner');
      if (gv.classList.contains('rit-hidden')) {
        gv.classList.remove('rit-hidden');
        gi.innerHTML = this.listOrder.map(id => `<div class="rit-grid-thumb" onclick="ReviewApp.renderDetail('${id}')"><img src="${this.data[id].all_images[0]}"></div>`).join('');
      } else { gv.classList.add('rit-hidden'); }
    },

    async loadComments(articleNo) {
      const pCard = document.getElementById('ritProductCard');
      pCard.innerHTML = `<div class="rit-comm-head"><span>COMMENTS</span><a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">리뷰 원문보기</a></div><div id="ritCommList"></div>`;
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .replyArea li');
        const list = document.getElementById('ritCommList');
        if (items.length > 0) {
          list.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            return `<div class="rit-comm-item"><div class="rit-comm-name">${this.maskName(wr)}</div><div class="rit-comm-body">${item.querySelector('.comment')?.innerText || ""}</div></div>`;
          }).join('');
        } else { list.innerHTML = '<p class="rit-no-comm">등록된 답변이 없습니다.</p>'; }
      } catch (e) { pCard.innerHTML = ''; }
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      const styleId = 'rit-dynamic-style';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }

      // 1줄부터 3줄까지 모든 케이스를 미리 정의하여 어떤 설정에도 즉시 대응합니다.
      styleTag.innerHTML = `
    /* [공통 기본 설정] */
    .rit-main-grid-layout {
      display: grid;
      gap: 15px;
      grid-template-columns: repeat(2, 1fr);
    }
    .rit-main-grid-layout > div { display: block; }

    /* [모바일 제어: 1023px 이하] */
    @media (max-width: 1023px) {
      .rit-mo-r1 > div:nth-child(n+3) { display: none !important; } /* 1줄: 2개 노출 */
      .rit-mo-r2 > div:nth-child(n+5) { display: none !important; } /* 2줄: 4개 노출 */
      .rit-mo-r3 > div:nth-child(n+7) { display: none !important; } /* 3줄: 6개 노출 */
    }

    /* [PC 제어: 1024px 이상] */
    @media (min-width: 1024px) {
      .rit-main-grid-layout {
        grid-template-columns: repeat(5, 1fr);
      }
      
      /* PC 환경으로 넘어오면 일단 모바일의 숨김 처리를 강제로 해제합니다. */
      .rit-main-grid-layout > div { display: block !important; }

      /* 그 후, 설정된 타입별로 정확히 숨김 처리합니다. */
      .rit-pc-r1 > div:nth-child(n+6) { display: none !important; }  /* 1줄: 5개 노출 */
      .rit-pc-r2 > div:nth-child(n+11) { display: none !important; } /* 2줄: 10개 노출 */
      .rit-pc-r3 > div:nth-child(n+16) { display: none !important; } /* 3줄: 15개 노출 */
    }
  `;

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
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);