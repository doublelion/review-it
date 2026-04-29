/**
 * @Project: Review-It Widget Engine v5.1 (Ultimate)
 * @Integrates: ykinas Review System v3.8 Logic & TENUE Design
 * @Author: Gemini AI (for REVIEW-IT)
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: CAFE24API.MALL_ID || 'ecudemo389879',
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png',
    ADMIN_KEYWORDS: ['TENUE', '관리자', 'CS', 'Official'],
    STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
    COPY_MSG: '콘텐츠 보호를 위해 복사 기능이 제한됩니다.',
    COPYRIGHT: '© TENUE. ALL RIGHTS RESERVED.'
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    modalImgSwiper: null,

    async init() {
      console.log('🚀 [REVIEW-IT] v5.1 통합 로직 가동...');
      this.injectCSS();
      await this.loadReviews();
      this.renderWidget();
      this.bindGlobalSecurity();
    },

    // [ykinas 로직 이식] 이미지 정밀 파싱
    _extractImages(html) {
      if (!html) return [];
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return Array.from(tempDiv.querySelectorAll('img'))
        .map(img => {
          let src = img.getAttribute('src');
          if (!src || src.length < 15 || src.includes('///') || src.includes('icon_')) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        })
        .filter(src => src !== null);
    },

    // [ykinas 로직 이식] 이름 마스킹 및 관리자 처리
    maskName(name) {
      if (!name) return "고객";
      let n = name.trim().split('(')[0].trim();
      const isAdmin = CONFIG.ADMIN_KEYWORDS.some(key => n.toUpperCase().includes(key.toUpperCase()));
      if (isAdmin) return n;
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

        list.forEach(r => {
          const extracted = this._extractImages(r.content);
          r.all_images = [...(r.image_urls || []), ...extracted];
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];

          this.data[String(r.id)] = r;
          this.listOrder.push(String(r.id));
        });
      } catch (e) { console.error("❌ 데이터 로드 실패", e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      container.innerHTML = `
        <div class="rit-header">
          <h2>REAL REVIEW</h2>
          <a href="/board/product/list.html?board_no=${CONFIG.BOARD_NO}" class="rit-all-view">전체보기 ></a>
        </div>
        <div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${this.listOrder.map(id => `<div class="swiper-slide">${this.getItemHTML(id)}</div>`).join('')}
          </div>
        </div>
        <div id="rit-modal" onclick="if(event.target === this) ReviewApp.closeModal()">
           <div id="rit-modal-content"></div>
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
          <img src="${rv.all_images[0]}" onerror="this.src='${CONFIG.DEFAULT_IMG}'" loading="lazy">
          <div class="rit-overlay">
            <div class="subject">${rv.subject}</div>
            <div class="meta-line">
               <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${rv.stars || 5}.svg" style="width:60px; height:auto;"></div>
               <span class="writer">${this.maskName(rv.writer)}</span>
            </div>
          </div>
        </div>`;
    },

    async openModal(id) {
      const d = this.data[id];
      this.currentScrollY = window.pageYOffset;
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;

      const modal = document.getElementById('rit-modal');
      const content = document.getElementById('rit-modal-content');

      content.innerHTML = `
        <div class="rit-modal-container">
          <span class="rit-close" onclick="ReviewApp.closeModal()">✕</span>
          <div class="rit-modal-left">
            <div class="swiper rit-modal-swiper h-full">
              <div class="swiper-wrapper">
                ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
              </div>
              <div class="rit-pagination"></div>
            </div>
          </div>
          <div class="rit-modal-right">
            <div class="modal-top">
              <div class="meta-info">
                <span class="writer-bold">${this.maskName(d.writer)}</span>
                <span class="divider">|</span>
                <span class="hits">HITS ${d.hit || 0}</span>
                <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" style="width:70px;"></div>
              </div>
              <span class="date-mono">${new Date(d.created_at).toLocaleDateString()}</span>
            </div>
            <h3 class="modal-title">${d.subject}</h3>
            <div id="rit-modal-body" class="modal-body">${d.content}</div>
            
            <div class="modal-footer">
              <div class="comment-section">
                <div class="comment-title-bar">
                  <h4>COMMENTS</h4>
                  <a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${d.article_no}" target="_blank">리뷰 원문보기</a>
                </div>
                <div id="rit-comment-list" class="comment-list-area">Loading...</div>
              </div>
              <div class="security-notice">
                <p>${CONFIG.COPYRIGHT}</p>
                <p>${CONFIG.COPY_MSG}</p>
              </div>
            </div>
          </div>
        </div>
      `;

      // 본문 내 이미지 제거 (슬라이더에서 이미 보여주므로)
      const bBody = document.getElementById('rit-modal-body');
      bBody.querySelectorAll('img').forEach(i => i.remove());

      modal.style.display = 'flex';
      this.modalImgSwiper = new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-pagination', type: 'fraction' } });
      this.loadCafe24Comments(d.article_no);
    },

    async loadCafe24Comments(articleNo) {
      const container = document.getElementById('rit-comment-list');
      try {
        const url = `/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}&_t=${Date.now()}`;
        const res = await fetch(url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .xans-board-commentlist li');

        if (items.length > 0) {
          container.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => wr.includes(k));
            const con = item.querySelector('.comment span[id^="comment_contents"], .comment')?.innerHTML || "";
            const date = item.querySelector('.date')?.innerText || "";
            return `
              <div class="comment-card ${isAdmin ? 'admin' : ''}">
                <div class="c-head">
                  <span class="c-writer">${isAdmin ? 'TENUE Official' : this.maskName(wr)}</span>
                  <span class="c-date">${date}</span>
                </div>
                <div class="c-body">${con}</div>
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

    bindGlobalSecurity() {
      // ykinas 보안 로직 이식
      document.addEventListener('contextmenu', e => {
        if (e.target.closest('.rit-modal-container')) {
          alert(CONFIG.COPY_MSG);
          e.preventDefault();
        }
      });
      document.addEventListener('selectstart', e => {
        if (e.target.closest('.rit-modal-container')) e.preventDefault();
      });
    },

    injectCSS() {
      const css = `
        #rit-widget-container { max-width: 1240px; margin: 60px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; }
        .rit-header h2 { font-size: 24px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
        .rit-all-view { font-size: 13px; color: #666; text-decoration: none; border-bottom: 1px solid #ccc; }
        
        .rit-card { position: relative; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; cursor: pointer; background: #f8f8f8; }
        .rit-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1); }
        .rit-card:hover img { transform: scale(1.1); }
        .rit-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); color: #fff; }
        .rit-overlay .subject { font-size: 14px; font-weight: 500; margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta-line { display: flex; align-items: center; justify-content: space-between; opacity: 0.9; }
        .writer { font-size: 11px; font-weight: 300; letter-spacing: 1px; }

        #rit-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 99999; display: none; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
        .rit-modal-container { width: 95%; max-width: 1100px; height: 85vh; background: #fff; display: flex; border-radius: 20px; overflow: hidden; position: relative; animation: ritFadeUp 0.4s ease; }
        @keyframes ritFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .rit-modal-left { flex: 1.3; background: #000; position: relative; }
        .rit-modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .rit-pagination { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 10; background: rgba(0,0,0,0.5); color: #fff; padding: 4px 12px; rounded-radius: 20px; font-size: 11px; font-family: monospace; }
        
        .rit-modal-right { flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; background: #fff; }
        .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .meta-info { display: flex; align-items: center; gap: 10px; }
        .writer-bold { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
        .divider { color: #eee; font-size: 10px; }
        .hits { font-size: 10px; color: #999; font-family: monospace; }
        .date-mono { font-size: 11px; color: #bbb; font-family: monospace; }
        
        .modal-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #111; line-height: 1.3; }
        .modal-body { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 40px; white-space: pre-wrap; }
        
        .comment-section { border-top: 1px solid #f4f4f4; padding-top: 30px; }
        .comment-title-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
        .comment-title-bar h4 { font-size: 12px; font-weight: 900; letter-spacing: 2px; color: #000; }
        .comment-title-bar a { font-size: 11px; color: #999; text-decoration: underline; text-underline-offset: 4px; }
        
        .comment-card { padding: 15px; background: #f9f9f9; border-radius: 10px; margin-bottom: 12px; border: 1px solid #f0f0f0; }
        .comment-card.admin { background: #fffaf0; border-color: #f3e5ab; }
        .c-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .c-writer { font-size: 11px; font-weight: 700; }
        .admin .c-writer { color: #8b5e3c; }
        .c-date { font-size: 9px; color: #bbb; }
        .c-body { font-size: 12px; color: #555; line-height: 1.5; }
        
        .security-notice { margin-top: 50px; padding: 30px 0; border-top: 1px solid #f9f9f9; text-align: center; }
        .security-notice p:first-child { font-size: 10px; color: #ccc; letter-spacing: 2px; margin-bottom: 5px; }
        .security-notice p:last-child { font-size: 9px; color: #eee; }

        .rit-close { position: absolute; top: 25px; right: 25px; font-size: 24px; color: #333; cursor: pointer; z-index: 100; transition: transform 0.3s; }
        .rit-close:hover { transform: rotate(90deg); }

        @media (max-width: 768px) {
          .rit-modal-container { flex-direction: column; height: 90vh; }
          .rit-modal-left { flex: none; height: 45%; }
          .rit-modal-right { padding: 25px; }
          .modal-title { font-size: 18px; }
        }
      `;
      const s = document.createElement('style'); s.innerHTML = css; document.head.appendChild(s);
    }
  };

  ReviewApp.init();
})();