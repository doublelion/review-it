/**
 * @Project: Review-It Widget Engine (SaaS & Multi-Tenant Edition)
 * @Description: 상점별 Mall ID 자동 감지 및 데이터 격리 렌더링
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',

    // ✅ Mall ID 및 환경 정보 동적 추출
    MALL: window.location.origin,
    MALL_ID: window.location.hostname.split('.')[0],
    MALL_NAME: document.title.split('-')[0].trim() || 'SHOP',

    ADMIN_KEYWORDS: ['관리자', 'CS', 'TENUE'],
    COPYRIGHT: `© ${new Date().getFullYear()} ${window.location.hostname.split('.')[0].toUpperCase()}. ALL RIGHTS RESERVED.`
  };

  const ReviewApp = {
    settings: {
      display_type: 'grid',
      tagline: 'Verified Authenticity',
      title: 'People Choice',
      description: '실제 구매 고객들이 직접 경험하고 기록한 생생한 리얼 피드'
    },
    data: {},
    listOrder: [],
    activeId: null,
    modalImgSwiper: null,

    async init() {
      console.log(`🎨 [Review-it] Widget active for: ${CONFIG.MALL_ID}`);

      // 1. Swiper 의존성 체크 및 로드
      await this.checkSwiper();

      // 2. CSS 주입
      this.injectCSS();

      // 3. 데이터 로드
      await Promise.all([this.loadSettings(), this.loadReviews()]);

      // 4. 렌더링
      this.renderList();
      this.bindSecurity();
    },

    async checkSwiper() {
      if (!window.Swiper) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
        document.head.appendChild(link);

        await new Promise(resolve => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }
    },

    async loadSettings() {
      try {

        // ✅ 1. mall_id 확인
        console.log('🔥 mall_id:', CONFIG.MALL_ID);

        // ✅ 2. 방어 코드
        if (!CONFIG.MALL_ID || CONFIG.MALL_ID === 'default') {
          console.error('❌ mall_id 비정상:', CONFIG.MALL_ID);
          return;
        }

        // ✅ 3. 실제 요청 로그
        const url = `${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`;
        console.log('🔥 API 요청:', url);

        const res = await fetch(url, {
          headers: {
            'apikey': CONFIG.KEY,
            'Authorization': `Bearer ${CONFIG.KEY}`
          }
        });

        const data = await res.json();
        if (data && data[0]) {
          this.settings = { ...this.settings, ...data[0] };
        } else {
          console.log("기본 설정 데이터가 없어 기본값을 사용합니다.");
        }
      } catch (e) {
        console.error("Setting load fail", e);
      }
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();

        const normalize = (url) => {
          if (!url) return '';
          if (url.startsWith('//')) return 'https:' + url;
          if (url.startsWith('/')) return CONFIG.MALL + url;
          return url;
        };

        this.listOrder = list.map(r => String(r.id));
        list.forEach(r => {
          let imgs = Array.isArray(r.image_urls) ? r.image_urls : [];
          const div = document.createElement('div');
          div.innerHTML = r.content;
          const bodyImgs = Array.from(div.querySelectorAll('img')).map(img => img.getAttribute('src'));
          const merged = [...imgs, ...bodyImgs].map(normalize).filter(v => v && v.length > 10);
          r.all_images = [...new Set(merged)];
          if (r.all_images.length === 0) r.all_images = ['https://via.placeholder.com/400x533?text=Review-It'];
          this.data[String(r.id)] = r;
        });
      } catch (e) { console.error("Data fail", e); }
    },

    injectCSS() {
      const style = document.createElement('style');
      style.innerHTML = `
        #rit-widget-root { max-width: 1200px; margin: 60px auto; padding: 0 20px; font-family: 'Pretendard', -apple-system, sans-serif; }
        .rit-header-container { text-align: center; margin-bottom: 50px; }
        .rit-tagline { font-size: 13px; color: #b45309; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 12px; display: block; }
        .rit-title { font-size: clamp(32px, 5vw, 48px); font-weight: 800; color: #111; margin-bottom: 20px; }
        .rit-description { font-size: 15px; color: #666; line-height: 1.6; max-width: 600px; margin: 0 auto; }
        
        .rit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 768px) { .rit-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1024px) { .rit-grid { grid-template-columns: repeat(7, 1fr); } }

        .rit-card { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 3/4; cursor: pointer; background: #eee; }
        .rit-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .rit-card:hover img { transform: scale(1.08); }
        .rit-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%); padding: 15px; display: flex; flex-direction: column; justify-content: flex-end; color: #fff; }
        .rit-overlay .subject { font-size: 13px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rit-overlay .info { font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between; }
        .rit-star-wrap { color: #fbbf24; letter-spacing: -1px; }

        /* Modal Styles */
        #rit-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 999999; display: none; align-items: center; justify-content: center; padding: 20px; }
        #rit-modal.active { display: flex; }
        .rit-modal-container { width: 100%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; position: relative; }
        .rit-outside-nav { display: flex; justify-content: space-between; color: #fff; padding-bottom: 15px; }
        .rit-modal-win { background: #fff; flex: 1; display: flex; overflow: hidden; border-radius: 4px; }
        .rit-modal-left { flex: 1.2; background: #000; display: flex; align-items: center; justify-content: center; position: relative; }
        .rit-modal-right { flex: 0.8; padding: 40px; display: flex; flex-direction: column; overflow-y: auto; }
        @media (max-width: 768px) { .rit-modal-win { flex-direction: column; } .rit-modal-left { min-height: 300px; } }
      `;
      document.head.appendChild(style);
    },

    renderList() {
      const root = document.getElementById('rit-widget-root');
      if (!root) return;

      const headerHTML = `
        <div class="rit-header-container">
          <span class="rit-tagline">${this.settings.tagline}</span>
          <h2 class="rit-title">${this.settings.title}</h2>
          <p class="rit-description">${this.settings.description.replace(/\n/g, '<br>')}</p>
        </div>`;

      if (this.settings.display_type === 'swiper') {
        root.innerHTML = headerHTML + `<div class="swiper rit-main-swiper"><div class="swiper-wrapper">${this.listOrder.map(id => `<div class="swiper-slide">${this.getItemHTML(id)}</div>`).join('')}</div></div>`;
        new Swiper('.rit-main-swiper', { slidesPerView: 2.2, spaceBetween: 12, breakpoints: { 1024: { slidesPerView: 7, spaceBetween: 15 } } });
      } else {
        root.innerHTML = headerHTML + `<div class="rit-grid">${this.listOrder.map(id => this.getItemHTML(id)).join('')}</div>`;
      }

      if (!document.getElementById('rit-modal')) {
        const m = document.createElement('div');
        m.id = 'rit-modal';
        m.onclick = (e) => { if (e.target === m) this.closeModal(); };
        document.body.appendChild(m);
      }
    },

    getItemHTML(id) {
      const rv = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${this.fixImg(rv.all_images[0])}" loading="lazy">
          <div class="rit-overlay">
            <div class="subject">${rv.subject}</div>
            <div class="info">
              ${this.getStarHtml(rv.stars)}
              <span>${this.maskName(rv.writer)}</span>
            </div>
          </div>
        </div>`;
    },

    async openModal(id) {
      const d = this.data[id];
      if (!d) return;
      this.activeId = String(id);
      let displayDate = d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : "방금 전";

      const modal = document.getElementById('rit-modal');
      const idx = this.listOrder.indexOf(String(id));

      modal.innerHTML = `
        <div class="rit-modal-container">
          <div class="rit-outside-nav">
            <div class="rit-nav-label font-bold">${CONFIG.MALL_NAME} REVIEW</div>
            <div class="rit-right-area">
              <button onclick="ReviewApp.closeModal()" style="background:none; border:none; color:#fff; font-size:28px; cursor:pointer;">✕</button>
            </div>
          </div>
          <div class="rit-modal-win">
            <div class="rit-modal-left" id="modalImgContainer"></div>
            <div class="rit-modal-right">
              <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:13px;">
                <b>${this.maskName(d.writer)}</b>
                <span style="color:#999;">${displayDate}</span>
              </div>
              ${this.getStarHtml(d.stars)}
              <h3 style="font-size:20px; font-weight:700; margin: 15px 0;">${d.subject}</h3>
              const safeContent = d.content ? String(d.content).replace(/<img[^>]*>/g, "") : "내용이 없습니다.";

// 그리고 HTML 렌더링 부분에 safeContent 변수를 넣습니다.
<div style="font-size:15px; line-height:1.8; color:#444; flex:1; overflow-y:auto;">${safeContent}</div>
              <div style="margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
                <button onclick="location.href='/product/detail.html?product_no=${d.article_no}'" 
                        style="width:100%; padding:15px; background:#111; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">제품 보러가기</button>
                <p style="font-size:10px; color:#ccc; text-align:center; margin-top:15px;">${CONFIG.COPYRIGHT}</p>
              </div>
            </div>
          </div>
        </div>`;

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.renderModalImages(d);
    },

    renderModalImages(d) {
      const container = document.getElementById('modalImgContainer');
      if (d.all_images.length > 1) {
        container.innerHTML = `<div class="swiper rit-modal-swiper" style="width:100%; height:100%;"><div class="swiper-wrapper">${d.all_images.map(img => `<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center;"><img src="${this.fixImg(img)}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`).join('')}</div><div class="swiper-pagination" style="color:#fff;"></div></div>`;
        new Swiper('.rit-modal-swiper', { pagination: { el: '.swiper-pagination', type: 'fraction' } });
      } else {
        container.innerHTML = `<img src="${this.fixImg(d.all_images[0])}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
      }
    },

    fixImg(url) { return url.startsWith('//') ? 'https:' + url : (url.startsWith('/') ? CONFIG.MALL + url : url); },
    maskName(name) {
      if (!name) return '고객';
      const clean = name.trim().split('(')[0];
      if (clean.length <= 1) return "*";
      return clean[0] + "*".repeat(Math.max(1, clean.length - 2)) + (clean.length > 2 ? clean.slice(-1) : "*");
    },
    getStarHtml(score) { return `<span class="rit-star-wrap">` + '★'.repeat(Math.floor(score || 5)) + '☆'.repeat(5 - Math.floor(score || 5)) + `</span>`; },
    closeModal() {
      document.getElementById('rit-modal').classList.remove('active');
      document.body.style.overflow = '';
    },
    bindSecurity() { document.addEventListener('contextmenu', e => { if (e.target.closest('#rit-modal')) e.preventDefault(); }); }
  };

  window.ReviewApp = ReviewApp;
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})();