/**
 * @Project: Review-It Universal Widget Engine v9.0
 * @Author: YKINAS Digital Assets Group
 * @Description: 타이틀 바인딩 완벽 해결 및 딥스캔 로직 통합 버전
 * @Philosophy: "Install & Forget" - 설치 즉시 작동하는 SaaS 솔루션
 */
(function (window) {
  const getDynamicConfig = () => {
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0];

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId,
      BOARD_NO: '4',
      DEFAULT_IMG: `${window.location.origin}/web/upload/no-img.png`,
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자'],
      SPAM_KEYWORDS: /star|icon|btn|twitch|logo|dummy|ec2-common|star_fill|star_empty/i
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
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
      console.log(`🚀 [REVIEW-IT] ${CONFIG.MALL_ID} 가동 시작`);
      this.injectCSS();
      // 1. 설정과 데이터를 순차적으로 로드 (순서 엄격 준수)
      await this.loadWidgetSettings();
      await this.loadReviews();
      // 2. 모든 데이터 준비 후 렌더링
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
          // DB 값이 'EMPTY'인 경우를 대비한 방어 로직 포함
          const isValid = (val) => val && val !== 'EMPTY' && val !== '';
          Object.keys(this.settings).forEach(key => {
            if (s[key] !== undefined && s[key] !== null) {
              let value = s[key];
              if (key === 'description' && typeof value === 'string') value = value.replace(/\n/g, '<br>');
              if (isValid(value)) this.settings[key] = value;
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 설정 로드 실패, 기본값을 유지합니다."); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => String(name).includes(k))) return name;
      let n = String(name).split('[')[0].replace(/[*]/g, '').trim();
      if (n.length <= 1) return n + "*";
      return n.substring(0, 1) + "*" + (n.length > 2 ? n.substring(2) : "");
    },

    async _fetchFullContent(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content');
        return contentArea ? contentArea.innerHTML.replace(/<img[^>]*>|<button[^>]*>.*?<\/button>/g, "").trim() : null;
      } catch (e) { return null; }
    },

    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const imgs = Array.from(doc.querySelectorAll('.view_content_raw img, .boardContent img, #board_read_content img')).map(img => {
          let src = img.getAttribute('src');
          if (!src || CONFIG.SPAM_KEYWORDS.test(src) || src.includes('.gif')) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        }).filter(src => src !== null);
        return imgs;
      } catch (e) { return []; }
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc&limit=${this.settings.display_limit}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        this.data = {};
        this.listOrder = [];

        for (const r of list) {
          const id = String(r.id);
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.length > 0 ? imgs : [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }
      } catch (e) { console.error("[REVIEW-IT] 데이터 로드 에러:", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      const gridClass = `rit-pc-r${this.settings.grid_rows_desktop} rit-mo-r${this.settings.grid_rows_mobile}`;

      let html = `
        <div class="rit-header-area">
          <div class="rit-tagline">${this.settings.tagline}</div>
          <h2 class="rit-main-title">${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
      `;

      if (this.settings.display_type === 'grid') {
        html += `<div class="rit-main-grid-layout ${gridClass}">${this.listOrder.map(id => this.getCardHTML(id)).join('')}</div>`;
      } else {
        html += `<div class="swiper rit-main-swiper"><div class="swiper-wrapper">${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}</div></div>`;
      }

      html += `
        <div id="ritModal" class="rit-modal-container" style="display:none;">
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
                  <div id="ritContent" class="rit-body-text">본문을 불러오는 중...</div>
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
        new Swiper('.rit-main-swiper', { slidesPerView: 2.2, spaceBetween: 15, autoplay: { delay: 4000 }, breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 25 } } });
      }
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')">
        <div class="rit-img-wrap"><img src="${d.all_images[0]}" class="rit-card-img" loading="lazy"></div>
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
      const modal = document.getElementById('ritModal');
      modal.style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      await this.renderDetail(id);
    },

    async renderDetail(id) {
      const d = this.data[id];
      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      const imgSide = document.getElementById('ritModalImg');
      imgSide.innerHTML = `<div class="swiper rit-modal-swiper"><div class="swiper-wrapper">${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}</div><div class="rit-fraction"></div></div>`;

      if (window.Swiper && d.all_images.length > 1) {
        new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-fraction', type: 'fraction' } });
      }

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-top-meta">
          <span class="rit-name-tag">${this.maskName(d.writer)}</span>
          <span class="rit-divider">|</span>
          <div class="rit-star-box"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
          <span class="rit-date-tag">${new Date(d.created_at).toLocaleDateString()}</span>
        </div>`;

      document.getElementById('ritSubject').innerText = d.subject;
      const content = await this._fetchFullContent(d.article_no);
      document.getElementById('ritContent').innerHTML = content || d.content;
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
      pCard.innerHTML = `<div class="rit-comm-head"><span>COMMENTS</span><a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">원문보기</a></div><div id="ritCommList"></div>`;
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li');
        const list = document.getElementById('ritCommList');
        if (items.length > 0) {
          list.innerHTML = Array.from(items).map(item => `<div class="rit-comm-item"><div class="rit-comm-name">${this.maskName(item.querySelector('.name')?.innerText)}</div><div class="rit-comm-body">${item.querySelector('.comment')?.innerText || ""}</div></div>`).join('');
        } else { list.innerHTML = '<p class="rit-no-comm">등록된 답변이 없습니다.</p>'; }
      } catch (e) { pCard.innerHTML = ''; }
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      if (document.getElementById('rit-dynamic-style')) return;
      const style = document.createElement('style');
      style.id = 'rit-dynamic-style';
      style.innerHTML = `
        #rit-widget-container { padding: 60px 20px; max-width: 1200px; margin: 0 auto; text-align: center; font-family: 'Inter', sans-serif; }
        .rit-header-area { margin-bottom: 40px; }
        .rit-tagline { font-size: 13px; color: #999; letter-spacing: 3px; font-weight: 600; text-transform: uppercase; margin-bottom: 10px; }
        .rit-main-title { font-size: 32px; font-weight: 800; color: #111; margin: 0; letter-spacing: -0.5px; }
        .rit-line { width: 30px; height: 2px; background: #333; margin: 20px auto; }
        .rit-desc { font-size: 15px; color: #666; line-height: 1.6; }
        .rit-main-grid-layout { display: grid; gap: 15px; }
        .rit-pc-r1 { grid-template-columns: repeat(5, 1fr); }
        .rit-pc-r2 { grid-template-columns: repeat(5, 1fr); }
        @media (max-width: 1023px) {
          .rit-main-grid-layout { grid-template-columns: repeat(2, 1fr); }
          .rit-mo-r1 > div:nth-child(n+3) { display: none; }
          .rit-mo-r2 > div:nth-child(n+5) { display: none; }
        }
        .rit-card { cursor: pointer; border: 1px solid #eee; background: #fff; overflow: hidden; transition: 0.3s; }
        .rit-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
        .rit-img-wrap { aspect-ratio: 1/1; overflow: hidden; }
        .rit-card-img { width: 100%; height: 100%; object-fit: cover; }
        .rit-card-info { padding: 15px; text-align: left; }
        .rit-card-subject { font-size: 14px; font-weight: 700; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rit-card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #999; }
        .rit-stars-small img { height: 11px; }
      `;
      document.head.appendChild(style);

      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link'; link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }
    }
  };

  window.ReviewApp = ReviewApp;
  if (document.readyState === 'complete') ReviewApp.init();
  else window.addEventListener('load', () => ReviewApp.init());
})(window);