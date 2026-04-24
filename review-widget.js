/**
 * @Project: Review-It Widget Engine v4.0 (Path Fixed)
 */
(function () {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL: window.location.origin,
    MALL_ID: window.location.hostname.split('.')[0],
    MALL_NAME: document.title.split('-')[0].trim() || 'SHOP',
    BOARD_NO: '4',
    DEFAULT_IMG: 'https://ecudemo389879.cafe24.com/web/upload/no-img.png', // 기본 이미지 주소
    ADMIN_KEYWORDS: ['관리자', 'CS', 'TENUE', '운영자', 'Official'],
    COPYRIGHT: `© ${new Date().getFullYear()} ${window.location.hostname.split('.')[0].toUpperCase()}. ALL RIGHTS RESERVED.`
  };

  const ReviewApp = {
    // ... (init, checkSwiper, loadSettings, injectCSS는 기존과 동일) ...

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();

        // 데이터 보정 로직 추가: image_urls가 없거나 비어있으면 기본 이미지 삽입
        const validList = list.map(r => {
          const imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [CONFIG.DEFAULT_IMG];
          return { ...r, processed_images: imgs };
        });

        this.listOrder = validList.map(r => String(r.id));
        validList.forEach(r => { this.data[String(r.id)] = r; });
      } catch (e) { console.error("리뷰 로드 실패", e); }
    },

    getItemHTML(id) {
      const rv = this.data[id];
      // 주석: rv.processed_images[0]를 사용하여 엑박 방지
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${this.fixImg(rv.processed_images[0])}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_IMG}'">
          <div class="rit-overlay">
            <div class="subject">${rv.subject || '리뷰'}</div>
            <div class="info">
              ${this.getStarHtml(rv.stars)}
              <span>${this.maskName(rv.writer)}</span>
            </div>
          </div>
        </div>`;
    },

    renderModalImages(d) {
      const container = document.getElementById('modalImgContainer');
      const imgs = d.processed_images;

      if (imgs.length > 1 && imgs[0] !== CONFIG.DEFAULT_IMG) {
        container.innerHTML = `<div class="swiper rit-modal-swiper" style="width:100%; height:100%;"><div class="swiper-wrapper">${imgs.map(img => `<div class="swiper-slide" style="display:flex; align-items:center; justify-content:center;"><img src="${this.fixImg(img)}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`).join('')}</div><div class="swiper-pagination" style="color:#fff;"></div></div>`;
        new Swiper('.rit-modal-swiper', { pagination: { el: '.swiper-pagination', type: 'fraction' } });
      } else {
        container.innerHTML = `<img src="${this.fixImg(imgs[0])}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.src='${CONFIG.DEFAULT_IMG}'">`;
      }
    },

    fixImg(url) {
      if (!url) return CONFIG.DEFAULT_IMG;
      if (url.startsWith('//')) return 'https:' + url;
      if (url.startsWith('/')) return CONFIG.MALL + url;
      return url;
    },

    maskName(name) {
      if (!name || name === '고객') return '익명';
      let clean = name.trim().split('(')[0].trim();
      const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => clean.toUpperCase().includes(k.toUpperCase()));
      if (isAdmin) return clean;

      // 마스킹 로직 개선 (성*형태 또는 이*훈 형태)
      if (clean.length <= 1) return "*";
      if (clean.length === 2) return clean[0] + "*";
      return clean[0] + "*" + clean.slice(-1);
    },

    async openModal(id) {
      const d = this.data[id];
      if (!d) return;

      // v3.9 스크롤 잠금 적용
      this.currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      document.body.style.cssText = `position: fixed; top: -${this.currentScrollY}px; width: 100%; overflow: hidden;`;

      const modal = document.getElementById('rit-modal');
      modal.innerHTML = `...[생략: 상세 모달 HTML]...`; // 기존 모달 구조 유지
      modal.classList.add('active');

      this.loadComments(d.article_no); // v3.9 실시간 댓글 로딩

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
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .xans-board-commentlist li, .view_comment_list li');


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
      // 스크롤 원복
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