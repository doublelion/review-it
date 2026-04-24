/**
 * @Project: Review-It Widget Engine (SaaS & Multi-Tenant Edition)
 * @Description: 댓글 수집, 스크롤 잠금, 관리자 마스킹 예외 등 v3.9 기능 완벽 이식
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL: window.location.origin,
    MALL_ID: window.location.hostname.split('.')[0],
    MALL_NAME: document.title.split('-')[0].trim() || 'SHOP',
    BOARD_NO: '4', // 카페24 리뷰 게시판 번호 (댓글 수집용)
    ADMIN_KEYWORDS: ['관리자', 'CS', 'TENUE', '운영자', 'Official'], // 마스킹 예외 키워드
    COPYRIGHT: `© ${new Date().getFullYear()} ${window.location.hostname.split('.')[0].toUpperCase()}. ALL RIGHTS RESERVED.`
  };

  const ReviewApp = {
    settings: {
      display_type: 'grid',
      tagline: 'Verified Authenticity',
      title: 'Customer Real Feed',
      description: '실제 구매 고객들이 직접 경험하고 기록한 생생한 리얼 피드'
    },
    data: {},
    listOrder: [],
    activeId: null,
    modalImgSwiper: null,
    currentScrollY: 0, // 스크롤 잠금용 위치 저장

    async init() {
      console.log(`🎨 [Review-it] Widget active for: ${CONFIG.MALL_ID}`);
      await this.checkSwiper();
      this.injectCSS();
      await Promise.all([this.loadSettings(), this.loadReviews()]);
      this.renderList();
      this.bindSecurity();
    },

    async checkSwiper() {
      if (!window.Swiper) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'; document.head.appendChild(link);
        await new Promise(res => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'; script.onload = res; document.head.appendChild(script); });
      }
    },

    async loadSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data[0]) this.settings = { ...this.settings, ...data[0] };
      } catch (e) { console.error("Setting load fail", e); }
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
          // 내용에서 이미지만 추출하여 배열에 합치기
          const div = document.createElement('div');
          div.innerHTML = r.content;
          const bodyImgs = Array.from(div.querySelectorAll('img')).map(img => img.getAttribute('src'));
          const merged = [...imgs, ...bodyImgs].map(normalize).filter(v => v && v.length > 10);
          r.all_images = [...new Set(merged)];
          if (r.all_images.length === 0) r.all_images = ['https://via.placeholder.com/400x533?text=No+Image'];

          // 본문에서 이미지 태그 제거 (텍스트만 남기기)
          div.querySelectorAll('img').forEach(img => img.remove());
          r.clean_content = div.innerText.trim();

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
        @media (max-width: 768px) { .rit-modal-win { flex-direction: column; } .rit-modal-left { min-height: 300px; } .rit-modal-right { padding: 20px; } }
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

      // 스크롤 잠금 (v3.9 방식 적용)
      this.currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      document.body.style.cssText = `position: fixed; top: -${this.currentScrollY}px; width: 100%; overflow: hidden;`;

      const modal = document.getElementById('rit-modal');
      const safeContent = d.clean_content || "내용이 없습니다.";

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
              <div style="font-size:14px; line-height:1.8; color:#444; flex:1; overflow-y:auto; margin-bottom:20px;">${safeContent}</div>
              
              <div id="rit-comments-container"></div>

              <div style="margin-top:20px; border-top:1px solid #eee; padding-top:20px;">
                <button onclick="location.href='/product/detail.html?product_no=${d.article_no}'" 
                        style="width:100%; padding:15px; background:#111; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">제품 보러가기</button>
                <p style="font-size:10px; color:#ccc; text-align:center; margin-top:15px; letter-spacing: 1px;">${CONFIG.COPYRIGHT}</p>
              </div>
            </div>
          </div>
        </div>`;

      modal.classList.add('active');
      this.renderModalImages(d);

      // 댓글 로딩 호출
      this.loadComments(d.article_no);
    },

    async loadComments(articleNo) {
      const container = document.getElementById('rit-comments-container');
      if (!container) return;

      try {
        const url = `/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}&_t=${Date.now()}`;
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .xans-board-commentlist li');

        if (items.length > 0) {
          let cHtml = "";
          items.forEach(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => wr.toUpperCase().includes(k.toUpperCase()));
            const con = item.querySelector('.comment span[id^="comment_contents"], .comment')?.innerText || "";
            const date = item.querySelector('.date')?.innerText || "";

            cHtml += `
                        <div style="padding:15px; border-radius:8px; margin-bottom:10px; background:${isAdmin ? '#fcfaf5' : '#f9fafb'}; border: 1px solid ${isAdmin ? '#eaddca' : '#f3f4f6'};">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="font-size:11px; font-weight:bold; color:${isAdmin ? '#8b5e3c' : '#111'};">${isAdmin ? 'Official' : this.maskName(wr)}</span>
                                <span style="font-size:10px; color:#999;">${date}</span>
                            </div>
                            <div style="font-size:12px; color:#555; line-height:1.5;">${con}</div>
                        </div>`;
          });
          container.innerHTML = cHtml;
        }
      } catch (e) {
        console.warn("댓글 로드 실패", e);
      }
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
      let clean = name.trim().split('(')[0].trim();
      // 관리자 예외 처리 (마스킹 안 함)
      const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => clean.toUpperCase().includes(k.toUpperCase()));
      if (isAdmin) return clean;

      if (clean.length <= 1) return "*";
      if (clean.length === 2) return clean[0] + "*";
      return clean[0] + "*".repeat(clean.length - 2) + clean.slice(-1);
    },

    getStarHtml(score) { return `<span class="rit-star-wrap">` + '★'.repeat(Math.floor(score || 5)) + '☆'.repeat(5 - Math.floor(score || 5)) + `</span>`; },

    closeModal() {
      const modal = document.getElementById('rit-modal');
      modal.classList.remove('active');
      // 스크롤 원상복구 (v3.9 방식 적용)
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    bindSecurity() {
      document.addEventListener('contextmenu', e => { if (e.target.closest('#rit-modal')) e.preventDefault(); });
      document.addEventListener('selectstart', e => { if (e.target.closest('#rit-modal')) e.preventDefault(); }); // 드래그 방지 추가
    }
  };

  window.ReviewApp = ReviewApp;
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})();