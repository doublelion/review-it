/**
 * @Project: Review-It Widget Engine v4.1 (Production Ready)
 * @Description: Supabase 연결 및 카페24 이미지 경로 최적화 버전
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: 'ecudemo389879', // 몰 아이디 고정
    MALL_ORIGIN: window.location.origin,
    BOARD_NO: '4', // 상품후기 게시판 번호
    ADMIN_KEYWORDS: ['관리자', 'CS', '운영자', 'Official'],
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png'
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,

    async init() {
      console.log('🚀 [REVIEW-IT] 위젯 로딩 중...');
      this.injectCSS();
      await this.loadReviews();
      this.renderWidget();
      this.bindEvents();
    },

    injectCSS() {
      const css = `
        #rit-widget-container { width: 100%; max-width: 1200px; margin: 50px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; }
        .rit-header h2 { font-size: 24px; font-weight: 800; margin: 0; color: #111; }
        .rit-card { cursor: pointer; border-radius: 12px; overflow: hidden; position: relative; aspect-ratio: 1/1; background: #f4f4f4; }
        .rit-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .rit-card:hover img { transform: scale(1.08); }
        .rit-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: #fff; }
        .rit-overlay .subject { font-size: 14px; font-weight: 600; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rit-star-wrap { color: #ffb800; font-size: 12px; margin-right: 5px; }
        
        /* 모달 스타일 */
        #rit-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; z-index: 10000; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
        #rit-modal.active { display: flex; }
        .rit-modal-container { width: 90%; max-width: 1000px; height: 80vh; background: #fff; display: flex; border-radius: 16px; overflow: hidden; position: relative; }
        .rit-modal-left { flex: 1.2; background: #000; display: flex; align-items: center; justify-content: center; }
        .rit-modal-right { flex: 1; padding: 40px; display: flex; flex-direction: column; overflow-y: auto; background: #fff; }
        .rit-close { position: absolute; top: 20px; right: 20px; font-size: 30px; color: #fff; cursor: pointer; z-index: 10001; }
        
        @media (max-width: 768px) {
          .rit-modal-container { flex-direction: column; height: 90vh; overflow-y: auto; }
          .rit-modal-left { min-height: 350px; }
        }
      `;
      const style = document.createElement('style');
      style.innerHTML = css;
      document.head.appendChild(style);
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc&limit=10`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        this.listOrder = list.map(r => String(r.id));
        list.forEach(r => { this.data[String(r.id)] = r; });
      } catch (e) { console.error("데이터 로드 실패", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      let html = `
        <div class="rit-header">
          <h2>REAL REVIEW</h2>
          <span style="font-size:14px; color:#666;">전체보기 ></span>
        </div>
        <div class="swiper rit-swiper">
          <div class="swiper-wrapper">
            ${this.listOrder.map(id => `
              <div class="swiper-slide">${this.getItemHTML(id)}</div>
            `).join('')}
          </div>
        </div>
        <div id="rit-modal" onclick="if(event.target === this) ReviewApp.closeModal()">
           <span class="rit-close" onclick="ReviewApp.closeModal()">✕</span>
           <div id="rit-modal-content"></div>
        </div>
      `;
      container.innerHTML = html;

      new Swiper('.rit-swiper', {
        slidesPerView: 1.5,
        spaceBetween: 15,
        breakpoints: {
          768: { slidesPerView: 3, spaceBetween: 20 },
          1024: { slidesPerView: 4, spaceBetween: 25 }
        }
      });
    },

    getItemHTML(id) {
      const rv = this.data[id];
      const firstImg = (rv.image_urls && rv.image_urls.length > 0) ? rv.image_urls[0] : CONFIG.DEFAULT_IMG;
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${this.fixImg(firstImg)}" onerror="this.src='${CONFIG.DEFAULT_IMG}'" loading="lazy">
          <div class="rit-overlay">
            <div class="subject">${rv.subject || '리뷰 내용'}</div>
            <div style="font-size:12px; display:flex; align-items:center;">
              ${this.getStarHtml(rv.stars)}
              <span style="opacity:0.8; margin-left:5px;">${this.maskName(rv.writer)}</span>
            </div>
          </div>
        </div>`;
    },

    async openModal(id) {
      const d = this.data[id];
      if (!d) return;

      // 스크롤 잠금
      this.currentScrollY = window.pageYOffset;
      document.body.style.cssText = `overflow:hidden; position:fixed; top:-${this.currentScrollY}px; width:100%;`;

      const modalContainer = document.getElementById('rit-modal');
      const content = document.getElementById('rit-modal-content');
      
      content.innerHTML = `
        <div class="rit-modal-container">
          <div class="rit-modal-left" id="modalImgContainer">
             <img src="${this.fixImg(d.image_urls[0] || CONFIG.DEFAULT_IMG)}" style="max-width:100%; max-height:100%; object-fit:contain;">
          </div>
          <div class="rit-modal-right">
            <div style="margin-bottom:15px;">${this.getStarHtml(d.stars)}</div>
            <h3 style="font-size:22px; margin-bottom:10px;">${d.subject}</h3>
            <p style="color:#666; font-size:14px; line-height:1.8; flex:1; white-space:pre-wrap;">${d.content === '리스트 수집 데이터' ? '구매해 주셔서 감사합니다. 정성스러운 후기가 쇼핑에 큰 도움이 됩니다.' : d.content}</p>
            <div style="margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
              <p style="font-size:13px; font-weight:bold;">${this.maskName(d.writer)}님</p>
              <button onclick="location.href='/product/detail.html?product_no=${d.article_no}'" 
                      style="width:100%; margin-top:15px; padding:15px; background:#111; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:700;">상품 상세 보기</button>
            </div>
          </div>
        </div>`;

      modalContainer.classList.add('active');
    },

    closeModal() {
      document.getElementById('rit-modal').classList.remove('active');
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    fixImg(url) {
      if (!url) return CONFIG.DEFAULT_IMG;
      if (url.startsWith('//')) return 'https:' + url;
      if (url.startsWith('/')) return CONFIG.MALL_ORIGIN + url;
      return url;
    },

    maskName(name) {
      if (!name || name === '고객') return '익명';
      let clean = name.trim();
      if (clean.length <= 1) return "*";
      if (clean.length === 2) return clean[0] + "*";
      return clean[0] + "*" + clean.slice(-1);
    },

    getStarHtml(score) {
      return `<span class="rit-star-wrap">` + '★'.repeat(Math.floor(score || 5)) + '☆'.repeat(5 - Math.floor(score || 5)) + `</span>`;
    },

    bindEvents() {
      // 보안: 우클릭 및 드래그 방지
      document.addEventListener('contextmenu', e => { if (e.target.closest('.rit-modal-container')) e.preventDefault(); });
    }
  };

  window.ReviewApp = ReviewApp;
  ReviewApp.init();
})();