/**
 * @Project: Review-It Widget Engine v6.0 (Deep Scan + Grid In-Modal)
 * @Features: 모달 내 GRID VIEW 완벽 구현, 본문 이미지 딥스캔, 스크롤 고정 로직
 */
(function (window) {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: 'ecudemo389879',
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png',
    STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
    ADMIN_KEYWORDS: ['TENUE', '관리자', 'Official'],
    COPYRIGHT: '© TENUE. ALL RIGHTS RESERVED.',
    COPY_MSG: '콘텐츠 보호를 위해 복사 기능이 제한됩니다.'
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    activeId: null,
    modalImgSwiper: null,

    async init() {
      console.log('🚀 [REVIEW-IT] v6.0 가동 (Full UI Sync)');
      this.injectCSS();
      await this.loadReviews();
      this.renderWidget();
    },

    // 상세페이지 딥스캔 (이미지 누락 방지)
    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent');
        return Array.from((contentArea || doc).querySelectorAll('img'))
          .map(img => {
            let src = img.getAttribute('src');
            if (!src || src.includes('icon_') || src.includes('clear.gif')) return null;
            return src.startsWith('//') ? 'https:' + src : src;
          }).filter(src => src !== null);
      } catch (e) { return []; }
    },

    maskName(name) {
      if (!name) return "고객";
      let n = name.trim().split('(')[0].trim();
      if (CONFIG.ADMIN_KEYWORDS.some(k => n.toUpperCase().includes(k.toUpperCase()))) return n;
      if (n.length <= 1) return "*";
      return n[0] + "*".repeat(n.length - 2) + n.slice(-1);
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        this.data = {}; this.listOrder = [];

        await Promise.all(list.map(async (r) => {
          const id = String(r.id);
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.length > 0 ? imgs : [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }));
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error(e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      container.innerHTML = `
        <div class="rit-header-area">
          <span class="rit-sub">Verified Authenticity</span>
          <h2>PEOPLE <span class="font-thin">CHOICE</span></h2>
          <p class="rit-desc">"당신의 선택에 확신을 더하는 기록"<br>실제 구매 고객들이 직접 기록한 트뉘만의 리얼 피드</p>
        </div>
        
        <div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${this.listOrder.map(id => `
              <div class="swiper-slide rit-card" onclick="ReviewApp.openModal('${id}')">
                <img src="${this.data[id].all_images[0]}" class="main-img" onerror="this.src='${CONFIG.DEFAULT_IMG}'">
                <div class="rit-card-info">
                  <div class="rit-card-subject">${this.data[id].subject}</div>
                  <div class="rit-card-meta">
                    <span>${this.maskName(this.data[id].writer)}</span>
                    <span class="rit-bar"></span>
                    <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${this.data[id].stars || 5}.svg"></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div id="reviewModal" class="rit-modal-fixed">
          <div class="rit-modal-overlay" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-wrapper">
            <div class="rit-modal-header">
              <span class="rit-logo-text">TENUE REVIEW</span>
              <div class="rit-header-right">
                <button onclick="ReviewApp.showGrid()" class="rit-btn-grid">
                  <svg viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>
                  GRID VIEW
                </button>
                <button onclick="ReviewApp.closeModal()" class="rit-btn-close">✕</button>
              </div>
            </div>
            
            <div class="rit-modal-body-container">
              <div id="reviewDetailView" class="rit-view-flex">
                <div id="modalImg" class="rit-modal-left"></div>
                <div class="rit-modal-right">
                  <div id="modalMetaArea"></div>
                  <h3 id="modalSubject"></h3>
                  <div id="modalContent"></div>
                  <div id="productCard"></div>
                  <div class="rit-security-foot">
                    <p>${CONFIG.COPYRIGHT}</p>
                    <p>${CONFIG.COPY_MSG}</p>
                  </div>
                </div>
              </div>
              <div id="reviewGridView" class="rit-grid-overlay hidden">
                <div id="gridContainer" class="rit-grid-layout"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      new Swiper('.rit-main-swiper', {
        slidesPerView: 2.2, spaceBetween: 16, autoplay: { delay: 3500 },
        breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 24 } }
      });
    },

    openModal(id) {
      this.activeId = id;
      this.currentScrollY = window.pageYOffset;
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      document.getElementById('reviewModal').style.display = 'flex';
      this.renderDetail(id);
    },

    renderDetail(id) {
      const d = this.data[id];
      document.getElementById('reviewGridView').classList.add('hidden');
      document.getElementById('reviewDetailView').classList.remove('hidden');

      // 이미지 스와이퍼
      document.getElementById('modalImg').innerHTML = `
        <div class="swiper modal-inner-swiper">
          <div class="swiper-wrapper">
            ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
          </div>
          <div class="modal-pagination"></div>
        </div>`;

      this.modalImgSwiper = new Swiper('.modal-inner-swiper', { pagination: { el: '.modal-pagination', type: 'fraction' } });

      // 메타 & 본문
      document.getElementById('modalMetaArea').innerHTML = `
        <div class="rit-meta-row">
          <span class="rit-mw-bold">${this.maskName(d.writer)}</span>
          <span class="rit-bar-gray">|</span>
          <span class="rit-hit">HITS ${d.article_no.slice(-2)}</span>
          <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" style="width:60px;"></div>
        </div>
        <span class="rit-date">${new Date(d.created_at).toLocaleDateString()}</span>`;

      document.getElementById('modalSubject').innerText = d.subject;
      document.getElementById('modalContent').innerHTML = d.content.replace(/<img[^>]*>/g, "");

      // 댓글 로드
      this.loadComments(d.article_no);
    },

    showGrid() {
      const gv = document.getElementById('reviewGridView');
      const gc = document.getElementById('gridContainer');
      gv.classList.remove('hidden');
      gc.innerHTML = this.listOrder.map(id => `
        <div class="rit-grid-item" onclick="ReviewApp.renderDetail('${id}')">
          <img src="${this.data[id].all_images[0]}">
        </div>
      `).join('');
    },

    async loadComments(articleNo) {
      const pCard = document.getElementById('productCard');
      pCard.innerHTML = `<div class="rit-comm-head"><h4>COMMENTS</h4><a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">리뷰 원문보기</a></div><div id="rit-comm-list">Loading...</div>`;
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li');
        const list = document.getElementById('rit-comm-list');
        if (items.length > 0) {
          list.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => wr.includes(k));
            return `<div class="rit-c-card ${isAdmin ? 'admin' : ''}">
              <div class="rit-c-wr">${isAdmin ? 'TENUE Official' : this.maskName(wr)}</div>
              <div class="rit-c-body">${item.querySelector('.comment')?.innerHTML || ""}</div>
            </div>`;
          }).join('');
        } else { list.innerHTML = '<p class="rit-no-comm">등록된 답변이 없습니다.</p>'; }
      } catch (e) { pCard.innerHTML = ''; }
    },

    closeModal() {
      document.getElementById('reviewModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      const css = `
        #rit-widget-container { max-width: 1240px; margin: 80px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header-area { text-align: center; margin-bottom: 50px; }
        .rit-sub { font-size: 11px; color: #b5835a; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; }
        .rit-header-area h2 { font-size: 36px; margin: 15px 0; font-weight: 800; }
        .rit-desc { color: #888; font-size: 14px; line-height: 1.6; }
        
        .rit-card { aspect-ratio: 3/4; border-radius: 15px; overflow: hidden; position: relative; cursor: pointer; }
        .rit-card .main-img { width: 100%; height: 100%; object-fit: cover; transition: 0.5s; }
        .rit-card:hover .main-img { transform: scale(1.1); }
        .rit-card-info { position: absolute; bottom: 0; width: 100%; padding: 25px 20px; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); color: #fff; }
        .rit-card-subject { font-size: 15px; font-weight: 600; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rit-card-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; opacity: 0.8; }
        .rit-bar { width: 1px; height: 10px; background: rgba(255,255,255,0.3); }

        /* 모달 시스템 */
        .rit-modal-fixed { position: fixed; inset: 0; z-index: 10000; display: none; align-items: center; justify-content: center; }
        .rit-modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); }
        .rit-modal-wrapper { position: relative; width: 100%; max-width: 1050px; height: 85vh; background: #fff; z-index: 10002; display: flex; flex-direction: column; overflow: hidden; }
        
        .rit-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #000; color: #fff; }
        .rit-logo-text { font-size: 10px; letter-spacing: 0.2em; opacity: 0.5; }
        .rit-header-right { display: flex; gap: 20px; align-items: center; }
        .rit-btn-grid { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; }
        .rit-btn-grid svg { width: 14px; height: 14px; fill: currentColor; }
        .rit-btn-close { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; }

        .rit-modal-body-container { flex: 1; position: relative; overflow: hidden; }
        .rit-view-flex { display: flex; height: 100%; }
        .rit-modal-left { width: 45%; background: #000; position: relative; }
        .rit-modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .rit-modal-right { width: 55%; padding: 40px; overflow-y: auto; background: #fff; }
        
        /* 그리드 오버레이 (상세 위에 뜸) */
        .rit-grid-overlay { position: absolute; inset: 0; background: #fff; z-index: 50; overflow-y: auto; padding: 30px; }
        .rit-grid-layout { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .rit-grid-item { aspect-ratio: 1/1; cursor: pointer; overflow: hidden; }
        .rit-grid-item img { width: 100%; height: 100%; object-fit: cover; }

        /* 내부 요소 */
        .rit-meta-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .rit-mw-bold { font-weight: 800; font-size: 13px; }
        .rit-bar-gray { color: #eee; }
        .rit-hit { font-size: 11px; color: #999; font-family: monospace; }
        #modalSubject { font-size: 24px; font-weight: 700; margin-bottom: 25px; line-height: 1.3; }
        #modalContent { font-size: 15px; line-height: 1.8; color: #555; margin-bottom: 40px; }
        
        .rit-comm-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .rit-comm-head h4 { font-size: 12px; font-weight: 900; }
        .rit-comm-head a { font-size: 11px; color: #bbb; text-decoration: underline; }
        .rit-c-card { padding: 15px; background: #f9f9f9; border-radius: 10px; margin-bottom: 10px; }
        .rit-c-card.admin { background: #fffaf0; border: 1px solid #f3e5ab; }
        .rit-c-wr { font-size: 11px; font-weight: 800; margin-bottom: 5px; }
        .rit-c-body { font-size: 12px; color: #666; }
        
        .rit-security-foot { text-align: center; margin-top: 50px; opacity: 0.3; font-size: 9px; }
        .modal-pagination { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.5); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 11px; z-index: 10; }
        .hidden { display: none !important; }

        @media (max-width: 768px) {
          .rit-view-flex { flex-direction: column; }
          .rit-modal-left, .rit-modal-right { width: 100%; }
          .rit-grid-layout { grid-template-columns: repeat(2, 1fr); }
        }
      `;
      const s = document.createElement('style'); s.innerHTML = css; document.head.appendChild(s);
    }
  };

  window.ReviewApp = ReviewApp;
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);