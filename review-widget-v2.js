/**
 * @Project: Review-It Widget Engine v5.8
 * @Update: 이미지 딥스캔(본문 직접 파싱), 쇼그리드(Grid View) 로직 통합
 */
(function (window) {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: 'ecudemo389879',
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png',
    SKIP_IMGS: ['img_product_medium.gif', 'no-img.png', 'icon_', 'clear.gif', 'editor_with'],
    STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
    ADMIN_KEYWORDS: ['TENUE', '관리자', 'CS', 'Official'],
    COPY_MSG: '콘텐츠 보호를 위해 복사 기능이 제한됩니다.',
    COPYRIGHT: '© TENUE. ALL RIGHTS RESERVED.'
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    modalImgSwiper: null,
    activeArticleNo: null,

    async init() {
      console.log('🚀 [REVIEW-IT] v5.8 Deep-Scan Engine 가동...');
      this.injectCSS();
      await this.loadReviews();
      this.renderWidget();
    },

    // [중요] 상세 페이지에서 이미지를 직접 긁어오는 딥스캔 로직
    async _deepScanImages(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // 게시글 본문 영역(Cafe24 표준 클래스) 내의 이미지 추출
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent');
        const imgs = Array.from((contentArea || doc).querySelectorAll('img')).map(img => {
          let src = img.getAttribute('src');
          if (!src || CONFIG.SKIP_IMGS.some(skip => src.includes(skip))) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        }).filter(src => src !== null);
        return imgs;
      } catch (e) { return []; }
    },

    maskName(name) {
      if (!name) return "고객";
      let n = name.trim().split('(')[0].trim();
      if (CONFIG.ADMIN_KEYWORDS.some(key => n.toUpperCase().includes(key.toUpperCase()))) return n;
      if (n.length <= 1) return "*";
      if (n.length === 2) return n[0] + "*";
      return n[0] + "*".repeat(n.length - 2) + n.slice(-1);
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();

        this.data = {};
        this.listOrder = [];

        // 병렬 처리를 위해 Promise.all 사용 (속도 개선)
        await Promise.all(list.map(async (r) => {
          const id = String(r.id);
          // 1차: 본문 HTML 파싱, 2차: 상세페이지 딥스캔 (이미지가 없을 경우)
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [];
          if (imgs.length === 0) imgs = await this._deepScanImages(r.article_no);

          r.all_images = imgs.length > 0 ? imgs : [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }));

        // 순서 재정렬 (비동기 완료 후 created_at 기준)
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error("❌ 로딩 에러", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      container.innerHTML = `
        <div class="rit-header">
          <h2>REAL REVIEW</h2>
          <div class="rit-header-btns">
             <button onclick="ReviewApp.showGrid()" class="rit-grid-btn">GRID VIEW</button>
             <a href="/board/product/list.html?board_no=${CONFIG.BOARD_NO}" class="rit-all-view">전체보기 ></a>
          </div>
        </div>
        <div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${this.listOrder.map(id => `<div class="swiper-slide">${this.getItemHTML(id)}</div>`).join('')}
          </div>
        </div>
        <div id="rit-modal">
           <div id="rit-modal-container">
              <span class="rit-close" onclick="ReviewApp.closeModal()">✕</span>
              <div id="rit-grid-view" class="hidden">
                 <div class="grid-header"><h3>ALL REVIEWS</h3></div>
                 <div id="rit-grid-container"></div>
              </div>
              <div id="rit-detail-view">
                 <div id="rit-modal-content"></div>
              </div>
           </div>
        </div>
      `;

      new Swiper('.rit-main-swiper', {
        slidesPerView: 2.2, spaceBetween: 16, autoplay: { delay: 3500 },
        breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 24 } }
      });
    },

    getItemHTML(id) {
      const rv = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${rv.all_images[0]}" onerror="this.src='${CONFIG.DEFAULT_IMG}'">
          <div class="rit-overlay">
            <div class="subject">${rv.subject}</div>
            <div class="meta-line">
               <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${rv.stars || 5}.svg"></div>
               <span class="writer">${this.maskName(rv.writer)}</span>
            </div>
          </div>
        </div>`;
    },

    openModal(id) {
      const d = this.data[id];
      if (!d) return;
      this.activeArticleNo = d.article_no;
      this.currentScrollY = window.pageYOffset;

      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      document.getElementById('rit-modal').style.display = 'flex';
      this.showDetail(id);
    },

    showDetail(id) {
      const d = this.data[id];
      document.getElementById('rit-grid-view').classList.add('hidden');
      document.getElementById('rit-detail-view').classList.remove('hidden');

      const content = document.getElementById('rit-modal-content');
      content.innerHTML = `
        <div class="modal-layout">
          <div class="modal-left">
            <div class="swiper rit-modal-swiper h-full">
              <div class="swiper-wrapper">
                ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
              </div>
              <div class="rit-pagination"></div>
            </div>
          </div>
          <div class="modal-right">
            <div class="modal-top">
              <div class="meta-info">
                <span class="writer-bold">${this.maskName(d.writer)}</span>
                <span class="divider">|</span>
                <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" style="width:70px;"></div>
              </div>
              <span class="date-mono">${new Date(d.created_at).toLocaleDateString()}</span>
            </div>
            <h3 class="modal-title">${d.subject}</h3>
            <div class="modal-body">${d.content.replace(/<img[^>]*>/g, "")}</div>
            <div class="modal-footer">
              <div class="comment-section">
                <div class="comment-header">
                   <h4>COMMENTS</h4>
                   <a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${d.article_no}" target="_blank">리뷰 원문보기</a>
                </div>
                <div id="rit-comment-list" class="comment-list">Loading...</div>
              </div>
              <div class="security-notice">
                <p>${CONFIG.COPYRIGHT}</p>
                <p>${CONFIG.COPY_MSG}</p>
              </div>
            </div>
          </div>
        </div>
      `;
      this.modalImgSwiper = new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-pagination', type: 'fraction' } });
      this.loadComments(d.article_no);
    },

    showGrid() {
      const modal = document.getElementById('rit-modal');
      this.currentScrollY = window.pageYOffset;
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      modal.style.display = 'flex';

      document.getElementById('rit-detail-view').classList.add('hidden');
      document.getElementById('rit-grid-view').classList.remove('hidden');

      const gridContainer = document.getElementById('rit-grid-container');
      gridContainer.innerHTML = this.listOrder.map(id => `
        <div class="grid-item" onclick="ReviewApp.showDetail('${id}')">
           <img src="${this.data[id].all_images[0]}" onerror="this.src='${CONFIG.DEFAULT_IMG}'">
        </div>
      `).join('');
    },

    async loadComments(articleNo) {
      const container = document.getElementById('rit-comment-list');
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .xans-board-commentlist li');

        if (items.length > 0) {
          container.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => wr.includes(k));
            const date = item.querySelector('.date')?.innerText || "";
            return `
              <div class="comment-card ${isAdmin ? 'admin' : ''}">
                <div class="c-head">
                   <span class="c-writer">${isAdmin ? 'TENUE Official' : this.maskName(wr)}</span>
                   <span class="c-date">${date}</span>
                </div>
                <div class="c-body">${item.querySelector('.comment')?.innerHTML || ""}</div>
              </div>`;
          }).join('');
        } else {
          container.innerHTML = '<div class="no-comment">등록된 답변이 없습니다.</div>';
        }
      } catch (e) { container.innerHTML = ''; }
    },

    closeModal() {
      document.getElementById('rit-modal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
      if (this.modalImgSwiper) this.modalImgSwiper.destroy();
    },

    injectCSS() {
      const css = `
        #rit-widget-container { max-width: 1240px; margin: 60px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; }
        .rit-header h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .rit-grid-btn { background: #000; color: #fff; border: none; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer; border-radius: 4px; margin-right: 15px; }
        .rit-card { position: relative; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; cursor: pointer; background: #f4f4f4; }
        .rit-card img { width: 100%; height: 100%; object-fit: cover; }
        .rit-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); color: #fff; }
        
        #rit-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 99999; display: none; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        #rit-modal-container { width: 90%; max-width: 1150px; height: 85vh; background: #fff; border-radius: 20px; position: relative; overflow: hidden; }
        .rit-close { position: absolute; top: 20px; right: 25px; font-size: 24px; cursor: pointer; z-index: 101; color: #333; }
        
        /* Grid View 스타일 */
        #rit-grid-view { height: 100%; padding: 60px 40px; overflow-y: auto; }
        #rit-grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
        .grid-item { aspect-ratio: 1/1; cursor: pointer; overflow: hidden; border-radius: 8px; }
        .grid-item img { width: 100%; height: 100%; object-fit: cover; transition: 0.3s; }
        .grid-item:hover img { transform: scale(1.05); }

        /* Detail View 스타일 */
        .modal-layout { display: flex; height: 100%; }
        .modal-left { flex: 1.2; background: #000; position: relative; }
        .modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .modal-right { flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; }
        .rit-pagination { position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%); color: #fff; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 20px; font-size: 11px; z-index: 10; }
        
        .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .writer-bold { font-weight: 800; font-size: 13px; text-transform: uppercase; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 15px; }
        .modal-body { font-size: 14px; line-height: 1.7; color: #555; margin-bottom: 30px; }
        
        .comment-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
        .comment-header h4 { font-size: 12px; font-weight: 800; }
        .comment-card { padding: 12px; background: #f8f8f8; border-radius: 8px; margin-bottom: 10px; font-size: 12px; }
        .comment-card.admin { background: #fffaf0; border: 1px solid #f3e5ab; }
        .c-head { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; font-weight: 700; }
        .c-date { color: #bbb; font-weight: 400; }
        
        .security-notice { text-align: center; margin-top: 40px; border-top: 1px solid #f4f4f4; padding-top: 20px; }
        .security-notice p { font-size: 10px; color: #ccc; }
        .hidden { display: none !important; }
      `;
      const s = document.createElement('style'); s.innerHTML = css; document.head.appendChild(s);
    }
  };

  window.ReviewApp = ReviewApp;
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);