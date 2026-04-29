/**
 * @Project: Review-It Widget Engine v5.0 (Enterprise)
 * @Integrates: ykinas Review System Module
 * @Features: 본문 이미지 추출, 실시간 댓글 로드, 모달 스와이퍼 적용
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: CAFE24API.MALL_ID || 'ecudemo389879',
    MALL_ORIGIN: window.location.origin,
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png',
    STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating'
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    modalSwiper: null,

    async init() {
      console.log('🚀 [REVIEW-IT] 통합 엔진 가동...');
      this.injectCSS();
      await this.loadReviews();
      this.renderWidget();
      this.bindGlobalEvents();
    },

    // [로직] 본문 HTML에서 실제 이미지 URL들을 추출하는 함수 (YKINAS 핵심 로직)
    _extractImages(html) {
      if (!html) return [];
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return Array.from(tempDiv.querySelectorAll('img'))
        .map(img => {
          let src = img.getAttribute('src');
          if (!src || src.length < 15 || src.includes('icon_')) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        })
        .filter(src => src !== null);
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();

        list.forEach(r => {
          // 본문에서 이미지 추출 시도
          const extracted = this._extractImages(r.content);
          // DB 이미지와 본문 추출 이미지를 합침
          r.all_images = [...(r.image_urls || []), ...extracted];
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];

          this.data[String(r.id)] = r;
          this.listOrder.push(String(r.id));
        });
      } catch (e) { console.error("❌ 로드 실패", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      container.innerHTML = `
        <div class="rit-header">
          <h2>REAL REVIEW</h2>
          <a href="/board/product/list.html?board_no=${CONFIG.BOARD_NO}" style="font-size:13px; color:#999; text-decoration:none;">전체보기 ></a>
        </div>
        <div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${this.listOrder.map(id => `<div class="swiper-slide">${this.getItemHTML(id)}</div>`).join('')}
          </div>
        </div>
        <div id="rit-modal"><div id="rit-modal-content"></div></div>
      `;

      new Swiper('.rit-main-swiper', {
        slidesPerView: 2.2, spaceBetween: 15,
        breakpoints: { 1024: { slidesPerView: 5, spaceBetween: 20 } }
      });
    },

    getItemHTML(id) {
      const rv = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${rv.all_images[0]}" onerror="this.src='${CONFIG.DEFAULT_IMG}'">
          <div class="rit-overlay">
            <div class="subject">${rv.subject}</div>
            <div class="meta">${this.getStarHtml(rv.stars)} <span>${this.maskName(rv.writer)}</span></div>
          </div>
        </div>`;
    },

    async openModal(id) {
      const d = this.data[id];
      this.currentScrollY = window.pageYOffset;
      document.body.style.cssText = `overflow:hidden; position:fixed; top:-${this.currentScrollY}px; width:100%;`;

      const modal = document.getElementById('rit-modal');
      const content = document.getElementById('rit-modal-content');

      content.innerHTML = `
        <div class="rit-modal-container">
          <span class="rit-close" onclick="ReviewApp.closeModal()">✕</span>
          <div class="rit-modal-left">
            <div class="swiper rit-modal-swiper">
              <div class="swiper-wrapper">
                ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
              </div>
              <div class="swiper-pagination"></div>
            </div>
          </div>
          <div class="rit-modal-right">
            <div class="modal-meta">
               <div class="stars">${this.getStarHtml(d.stars)}</div>
               <div class="writer">${this.maskName(d.writer)} | ${new Date(d.created_at).toLocaleDateString()}</div>
            </div>
            <h3 class="modal-title">${d.subject}</h3>
            <div class="modal-body">${d.content}</div>
            
            <div class="modal-comments">
              <div class="comment-head">
                <span>Comments</span>
                <a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${d.article_no}" target="_blank">리뷰 원문보기</a>
              </div>
              <div id="rit-comment-list" class="comment-list">Loading...</div>
            </div>
          </div>
        </div>
      `;

      modal.style.display = 'flex';
      new Swiper('.rit-modal-swiper', { pagination: { el: '.swiper-pagination', type: 'fraction' } });
      this.loadCafe24Comments(d.article_no);
    },

    // [로직] 카페24 게시글에서 댓글을 실시간으로 긁어오는 함수
    async loadCafe24Comments(articleNo) {
      const container = document.getElementById('rit-comment-list');
      try {
        const url = `/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`;
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const comments = doc.querySelectorAll('.boardComment li, .commentList li');

        if (comments.length > 0) {
          container.innerHTML = Array.from(comments).map(c => {
            const writer = c.querySelector('.name')?.innerText || "고객";
            const content = c.querySelector('.comment')?.innerHTML || "";
            return `<div class="comment-item"><strong>${writer}</strong><p>${content}</p></div>`;
          }).join('');
        } else {
          container.innerHTML = `<p class="no-data">등록된 댓글이 없습니다.</p>`;
        }
      } catch (e) { container.innerHTML = ""; }
    },

    closeModal() {
      document.getElementById('rit-modal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    maskName: name => (name === '고객' ? '익명' : name.length > 2 ? name[0] + "*" + name.slice(-1) : name[0] + "*"),
    getStarHtml: score => `<span class="stars-gold">` + '★'.repeat(score) + '☆'.repeat(5 - score) + `</span>`,

    injectCSS() {
      const css = `
        #rit-widget-container { max-width: 1200px; margin: 40px auto; padding: 0 15px; }
        .rit-card { position: relative; aspect-ratio: 1/1; border-radius: 8px; overflow: hidden; cursor: pointer; background: #eee; }
        .rit-card img { width: 100%; height: 100%; object-fit: cover; }
        .rit-overlay { position: absolute; bottom: 0; left:0; right:0; padding: 15px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: #fff; }
        .rit-overlay .subject { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stars-gold { color: #ffb800; font-size: 12px; }
        
        #rit-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: none; align-items: center; justify-content: center; }
        .rit-modal-container { width: 95%; max-width: 1100px; height: 85vh; background: #fff; display: flex; border-radius: 12px; overflow: hidden; position: relative; }
        .rit-modal-left { flex: 1.2; background: #000; position: relative; }
        .rit-modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .rit-modal-right { flex: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; }
        .modal-title { font-size: 20px; margin: 15px 0; font-weight: 700; }
        .modal-body { font-size: 14px; line-height: 1.6; color: #444; margin-bottom: 30px; }
        .modal-comments { border-top: 1px solid #eee; padding-top: 20px; }
        .comment-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
        .comment-item { background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 12px; }
        .rit-close { position: absolute; top: 15px; right: 20px; color: #fff; font-size: 24px; cursor: pointer; z-index: 10; }
        
        @media (max-width: 768px) {
          .rit-modal-container { flex-direction: column; height: 95vh; }
          .rit-modal-left { height: 40%; flex: none; }
        }
      `;
      const s = document.createElement('style'); s.innerHTML = css; document.head.appendChild(s);
    },

    bindGlobalEvents() {
      // 보안 로직: 모달 내 우클릭 방지
      document.addEventListener('contextmenu', e => {
        if (e.target.closest('.rit-modal-container')) e.preventDefault();
      });
    }
  };

  ReviewApp.init();
})();