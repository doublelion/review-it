/**
 * @Project: Review-It Widget Engine v7.2
 * @Update: SQL 스키마 기반 필드 동기화 및 버튼 레이아웃 최적화
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
    // 불필요한 별점, 아이콘, 트위치 로고 등 필터링
    SPAM_KEYWORDS: /star|icon|btn|twitch|logo|dummy|ec2-common|star_fill|star_empty/i
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    settings: {
      display_type: 'grid',
      title: 'TENUE REVIEW',
      description: '"당신의 선택에 확신을 더하는 기록" 리얼 피드를 확인해보세요.'
    },

    async init() {
      this.injectCSS();
      await this.loadWidgetSettings(); // DB 설정 로드
      await this.loadReviews();        // 리뷰 로드
      this.renderWidget();             // 위젯 생성
    },

    // [1] 관리자 설정 로드 (스키마 기반)
    async loadWidgetSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const s = data[0];
          // 제공해주신 SQL 필드명에 맞춤
          if (s.display_type) this.settings.display_type = s.display_type;
          if (s.title) this.settings.title = s.title;
          if (s.description) this.settings.description = s.description.replace(/\n/g, '<br>');
        }
      } catch (e) { console.error("설정 로드 실패:", e); }
    },

    // [2] 작성자 마스킹 (중복 기호 및 HTML 제거)
    maskName(name) {
      if (!name) return "고객";
      let n = name.replace(/<[^>]*>/g, "").replace(/[*]/g, "").trim().split('(')[0].trim();
      if (CONFIG.ADMIN_KEYWORDS.some(k => n.toUpperCase().includes(k.toUpperCase()))) return "TENUE Official";
      if (n.length <= 1) return "*";
      if (n.length === 2) return n[0] + "*";
      return n[0] + "*".repeat(n.length - 2) + n.slice(-1);
    },

    // [3] 이미지 추출 및 스팸 필터링
    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent');
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
        this.data = {}; this.listOrder = [];

        await Promise.all(list.map(async (r) => {
          const id = String(r.id);
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.filter(src => !CONFIG.SPAM_KEYWORDS.test(src));
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }));
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error(e); }
    },

    // [4] 메인 위젯 렌더링
    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      let html = `
        <div class="rit-header-area">
          <h2>${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
      `;

      if (this.settings.display_type === 'grid') {
        html += `<div class="rit-main-grid-layout">${this.listOrder.map(id => this.getCardHTML(id)).join('')}</div>`;
      } else {
        html += `
          <div class="swiper rit-main-swiper">
            <div class="swiper-wrapper">
              ${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}
            </div>
          </div>
        `;
      }

      // 모달 UI 구조 (닫기/그리드 버튼 정리)
      html += `
        <div id="ritModal" class="rit-modal-container">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
            <div class="rit-modal-header">
              <span class="rit-logo-text">TENUE REVIEW</span>
              <div class="rit-header-buttons">
                <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>
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
                  <div id="ritContent" class="rit-body-text"></div>
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
        new Swiper('.rit-main-swiper', {
          slidesPerView: 2.2, spaceBetween: 15,
          autoplay: { delay: 4000 },
          breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 25 } }
        });
      }
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${d.all_images[0]}" class="rit-card-img" loading="lazy">
          <div class="rit-card-info">
            <div class="rit-card-subject">${d.subject}</div>
            <div class="rit-card-meta">
              <span>${this.maskName(d.writer)}</span>
              <div class="rit-stars-small"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
            </div>
          </div>
        </div>
      `;
    },

    openModal(id) {
      this.currentScrollY = window.pageYOffset;
      document.getElementById('ritModal').style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      this.renderDetail(id);
    },

    renderDetail(id) {
      const d = this.data[id];
      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      document.getElementById('ritModalImg').innerHTML = `
        <div class="swiper rit-modal-swiper">
          <div class="swiper-wrapper">${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}</div>
          <div class="rit-fraction"></div>
        </div>`;
      new Swiper('.rit-modal-swiper', { pagination: { el: '.rit-fraction', type: 'fraction' } });

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-top-meta">
          <span class="rit-name-tag">${this.maskName(d.writer)}</span>
          <span class="rit-divider">|</span>
          <img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" class="rit-star-img">
          <span class="rit-date-tag">${new Date(d.created_at).toLocaleDateString()}</span>
        </div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      document.getElementById('ritContent').innerHTML = d.content.replace(/<img[^>]*>/g, "");
      this.loadComments(d.article_no);
    },

    toggleGrid() {
      const gv = document.getElementById('ritGridView');
      const gi = document.getElementById('ritGridInner');
      if (gv.classList.contains('rit-hidden')) {
        gv.classList.remove('rit-hidden');
        gi.innerHTML = this.listOrder.map(id => `
          <div class="rit-grid-thumb" onclick="ReviewApp.renderDetail('${id}')">
            <img src="${this.data[id].all_images[0]}">
          </div>`).join('');
      } else { gv.classList.add('rit-hidden'); }
    },

    async loadComments(articleNo) {
      const pCard = document.getElementById('ritProductCard');
      pCard.innerHTML = `<div class="rit-comm-head"><span>COMMENTS</span><a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">리뷰 원문보기</a></div><div id="ritCommList"></div>`;
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li');
        const list = document.getElementById('ritCommList');
        if (items.length > 0) {
          list.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "고객";
            const isAdmin = CONFIG.ADMIN_KEYWORDS.some(k => wr.includes(k));
            return `<div class="rit-comm-item ${isAdmin ? 'is-admin' : ''}">
              <div class="rit-comm-name">${isAdmin ? 'TENUE Official' : this.maskName(wr)}</div>
              <div class="rit-comm-body">${item.querySelector('.comment')?.innerHTML || ""}</div>
            </div>`;
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
      const css = `
        #rit-widget-container { max-width: 1300px; margin: 60px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header-area { text-align: center; margin-bottom: 40px; }
        .rit-header-area h2 { font-size: 30px; font-weight: 800; margin: 10px 0; letter-spacing: -0.02em; }
        .rit-line { width: 30px; height: 1px; background: #333; margin: 15px auto; }
        .rit-desc { font-size: 14px; color: #777; line-height: 1.6; }

        .rit-main-grid-layout { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        @media (min-width: 1024px) { .rit-main-grid-layout { grid-template-columns: repeat(5, 1fr); gap: 20px; } }

        .rit-card { aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; background: #f0f0f0; }
        .rit-card-img { width: 100%; height: 100%; object-fit: cover; transition: 0.5s ease; }
        .rit-card:hover .rit-card-img { transform: scale(1.08); }
        .rit-card-info { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%); display: flex; flex-direction: column; justify-content: flex-end; padding: 18px; color: #fff; }
        .rit-card-subject { font-size: 13px; font-weight: 600; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rit-card-meta { display: flex; align-items: center; justify-content: space-between; font-size: 11px; opacity: 0.9; }
        .rit-stars-small img { height: 11px; }

        .rit-modal-container { position: fixed; inset: 0; z-index: 10000; display: none; align-items: center; justify-content: center; }
        .rit-modal-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); }
        .rit-modal-window { position: relative; width: 95%; max-width: 1000px; height: 85vh; background: #fff; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
        
        .rit-modal-header { height: 54px; background: #000; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; color: #fff; }
        .rit-logo-text { font-size: 11px; letter-spacing: 0.1em; opacity: 0.5; }
        .rit-header-buttons { display: flex; align-items: center; gap: 15px; }
        .btn-rit-grid { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-rit-grid:hover { background: #fff; color: #000; }
        .btn-rit-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; }

        .rit-modal-body { flex: 1; position: relative; overflow: hidden; }
        .rit-flex-container { display: flex; height: 100%; }
        .rit-img-side { width: 48%; background: #000; }
        .rit-img-side img { width: 100%; height: 100%; object-fit: contain; }
        @media (min-width: 1024px) { .rit-img-side img { object-fit: cover; } }
        .rit-txt-side { width: 52%; padding: 40px; overflow-y: auto; }

        .rit-top-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .rit-name-tag { font-weight: 800; font-size: 13px; }
        .rit-divider { color: #eee; }
        .rit-star-img { height: 13px; }
        .rit-date-tag { margin-left: auto; color: #ccc; font-size: 11px; }
        #ritSubject { font-size: 22px; font-weight: 800; margin-bottom: 20px; line-height: 1.4; letter-spacing: -0.03em; }
        .rit-body-text { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 30px; }

        .rit-grid-overlay { position: absolute; inset: 0; background: #fff; z-index: 20; overflow-y: auto; padding: 25px; }
        .rit-grid-box-wrap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .rit-grid-thumb { aspect-ratio: 1/1; cursor: pointer; border-radius: 6px; overflow: hidden; }
        .rit-grid-thumb img { width: 100%; height: 100%; object-fit: cover; }

        .rit-comm-head { display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 25px; margin-bottom: 15px; font-size: 12px; font-weight: 800; }
        .rit-comm-head a { color: #bbb; text-decoration: underline; font-weight: 400; }
        .rit-comm-item { padding: 14px; background: #f9f9f9; border-radius: 8px; margin-bottom: 10px; }
        .rit-comm-item.is-admin { background: #fffaf0; border: 1px solid #f3e5ab; }
        .rit-comm-name { font-weight: 800; font-size: 11px; margin-bottom: 5px; }
        .rit-comm-body { color: #666; font-size: 12px; line-height: 1.6; }

        .rit-fraction { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 11px; z-index: 10; }
        .rit-hidden { display: none; }

        @media (max-width: 768px) {
          .rit-flex-container { flex-direction: column; }
          .rit-img-side, .rit-txt-side { width: 100%; }
          .rit-img-side { height: 45%; }
          .rit-grid-box-wrap { grid-template-columns: repeat(2, 1fr); }
          .rit-header-area h2 { font-size: 24px; }
        }
      `;
      const style = document.createElement('style'); style.innerHTML = css; document.head.appendChild(style);
    }
  };

  window.ReviewApp = ReviewApp;
  document.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);