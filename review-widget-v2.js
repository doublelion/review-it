/**
 * @Project: Review-It Widget Engine v7.0
 * @Features: 
 * 1. Supabase 관리자 설정(Grid/Swiper, 문구) 실시간 동기화
 * 2. Deep Scan + 정밀 필터링 (별점/아이콘/GIF 제거)
 * 3. 모달 내부 GRID VIEW 오버레이 및 Swiper 슬라이드
 * 4. 반응형 레이아웃 최적화
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
    // 필터링 키워드 (별점 이미지, 아이콘 등 제외)
    SPAM_KEYWORDS: /star|icon|btn|twitch|logo|dummy|ec2-common|star_fill|star_empty/i
  };

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    modalImgSwiper: null,
    settings: {
      display_type: 'grid', // 기본값
      tagline: 'TENUE LIVE',
      title: 'TENUE REVIEW',
      description: '"당신의 선택에 확신을 더하는 기록"<br>실제 구매 고객들이 직접 기록한 트뉘만의 리얼 피드'
    },

    async init() {
      this.injectCSS();
      await this.loadWidgetSettings(); // 1. 관리자 설정 로드
      await this.loadReviews();        // 2. 리뷰 데이터 로드
      this.renderWidget();             // 3. 위젯 렌더링
    },

    // [관리자 설정 로드] Supabase widget_settings 테이블 참조
    async loadWidgetSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const s = data[0];
          if (s.display_type) this.settings.display_type = s.display_type;
          if (s.tagline) this.settings.tagline = s.tagline;
          if (s.title) this.settings.title = s.title;
          if (s.description) this.settings.description = s.description.replace(/\n/g, '<br>');
        }
      } catch (e) { console.error("위젯 세팅 로드 실패", e); }
    },

    // [Deep Scan & Filtering] 불필요한 이미지(별점 등) 제거 로직 포함
    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent');

        const imgs = Array.from((contentArea || doc).querySelectorAll('img')).map(img => {
          let src = img.getAttribute('src');
          if (!src) return null;

          // 별점, 아이콘, GIF 파일 필터링
          if (CONFIG.SPAM_KEYWORDS.test(src) || src.toLowerCase().includes('.gif')) return null;

          return src.startsWith('//') ? 'https:' + src : src;
        }).filter(src => src !== null);

        return imgs;
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
          // DB에 이미지가 있으면 사용, 없으면 딥스캔 실행
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);

          // 딥스캔 후에도 별점 이미지가 섞여있을 수 있으므로 재필터링
          r.all_images = imgs.filter(src => !CONFIG.SPAM_KEYWORDS.test(src) && !src.includes('.gif'));
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];

          this.data[id] = r;
          this.listOrder.push(id);
        }));
        // 최신순 정렬
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error(e); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      // 상단 헤더 (관리자 설정 반영)
      let html = `
        <div class="rit-header-area">
          <span class="rit-sub">${this.settings.tagline}</span>
          <h2>${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
      `;

      // 레이아웃 타입 결정 (Grid vs Swiper)
      if (this.settings.display_type === 'grid') {
        html += `
          <div class="rit-main-grid-layout">
            ${this.listOrder.map(id => this.getCardHTML(id)).join('')}
          </div>
        `;
      } else {
        html += `
          <div class="swiper rit-main-swiper">
            <div class="swiper-wrapper">
              ${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}
            </div>
          </div>
        `;
      }

      // 공통 모달 구조
      html += `
        <div id="ritModal" class="rit-modal-container">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
            <div class="rit-modal-header">
              <span class="rit-logo">TENUE REVIEW</span>
              <div class="rit-header-right">
                <button onclick="ReviewApp.toggleGrid()" class="rit-grid-toggle">
                  <svg viewBox="0 0 24 24" width="14" height="14"><rect x="2" y="2" width="9" height="9" rx="1" fill="currentColor"/><rect x="13" y="2" width="9" height="9" rx="1" fill="currentColor"/><rect x="2" y="13" width="9" height="9" rx="1" fill="currentColor"/><rect x="13" y="13" width="9" height="9" rx="1" fill="currentColor"/></svg>
                  GRID VIEW
                </button>
                <button onclick="ReviewApp.closeModal()" class="rit-modal-close">✕</button>
              </div>
            </div>
            <div class="rit-modal-content-wrap">
              <div id="ritDetailView" class="rit-detail-flex">
                <div id="ritModalImg" class="rit-modal-left"></div>
                <div class="rit-modal-right">
                  <div id="ritMetaArea"></div>
                  <h3 id="ritSubject"></h3>
                  <div id="ritContent" class="rit-content-body"></div>
                  <div id="ritProductCard"></div>
                </div>
              </div>
              <div id="ritGridView" class="rit-grid-overlay rit-hidden">
                <div id="ritGridInner" class="rit-grid-layout"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Swiper 활성화 (필요한 경우만)
      if (this.settings.display_type !== 'grid') {
        new Swiper('.rit-main-swiper', {
          slidesPerView: 2.2, spaceBetween: 16,
          autoplay: { delay: 3500 },
          breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 24 } }
        });
      }
    },

    getCardHTML(id) {
      const item = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <img src="${item.all_images[0]}" class="rit-main-img">
          <div class="rit-card-overlay">
            <div class="rit-subject">${item.subject}</div>
            <div class="rit-meta">
              <span>${this.maskName(item.writer)}</span>
              <span class="rit-bar"></span>
              <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${item.stars || 5}.svg"></div>
            </div>
          </div>
        </div>
      `;
    },

    openModal(id) {
      this.currentScrollY = window.pageYOffset;
      const modal = document.getElementById('ritModal');
      modal.style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      this.renderDetail(id);
    },

    renderDetail(id) {
      const d = this.data[id];
      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      // 모달 이미지 슬라이더
      document.getElementById('ritModalImg').innerHTML = `
        <div class="swiper rit-inner-swiper">
          <div class="swiper-wrapper">
            ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
          </div>
          <div class="rit-pagination"></div>
        </div>`;
      this.modalImgSwiper = new Swiper('.rit-inner-swiper', { pagination: { el: '.rit-pagination', type: 'fraction' } });

      // 모달 텍스트 정보
      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-meta-line">
          <span class="rit-writer">${this.maskName(d.writer)}</span>
          <span class="rit-bar-v">|</span>
          <div class="rit-stars"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" width="60"></div>
          <span class="rit-date">${new Date(d.created_at).toLocaleDateString()}</span>
        </div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      // 본문 이미지 태그 제거 (이미 왼쪽 슬라이더에 노출되므로)
      document.getElementById('ritContent').innerHTML = d.content.replace(/<img[^>]*>/g, "");

      this.loadComments(d.article_no);
    },

    toggleGrid() {
      const gv = document.getElementById('ritGridView');
      const gi = document.getElementById('ritGridInner');
      if (gv.classList.contains('rit-hidden')) {
        gv.classList.remove('rit-hidden');
        gi.innerHTML = this.listOrder.map(id => `
          <div class="rit-grid-box" onclick="ReviewApp.renderDetail('${id}')">
            <img src="${this.data[id].all_images[0]}">
          </div>`).join('');
      } else {
        gv.classList.add('rit-hidden');
      }
    },

    async loadComments(articleNo) {
      const pCard = document.getElementById('ritProductCard');
      pCard.innerHTML = `<div class="rit-c-header"><h4>COMMENTS</h4><a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">리뷰 원문보기</a></div><div id="ritCommList">Loading...</div>`;
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
            return `<div class="rit-c-item ${isAdmin ? 'admin' : ''}">
              <div class="rit-c-name">${isAdmin ? 'TENUE Official' : this.maskName(wr)}</div>
              <div class="rit-c-con">${item.querySelector('.comment')?.innerHTML || ""}</div>
            </div>`;
          }).join('');
        } else { list.innerHTML = '<p class="rit-empty">등록된 답변이 없습니다.</p>'; }
      } catch (e) { pCard.innerHTML = ''; }
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      const css = `
        #rit-widget-container { max-width: 1240px; margin: 80px auto; padding: 0 20px; font-family: 'Pretendard', sans-serif; }
        .rit-header-area { text-align: center; margin-bottom: 50px; }
        .rit-sub { font-size: 11px; color: #b5835a; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; }
        .rit-header-area h2 { font-size: 38px; font-weight: 800; margin: 15px 0; }
        .rit-line { width: 40px; height: 1px; background: #eee; margin: 20px auto; }
        .rit-desc { font-size: 14px; color: #888; line-height: 1.6; font-weight: 300; }

        .rit-main-grid-layout { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (min-width: 1024px) { .rit-main-grid-layout { grid-template-columns: repeat(5, 1fr); gap: 24px; } }

        .rit-card { aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; background: #f4f4f4; }
        .rit-main-img { width: 100%; height: 100%; object-fit: cover; transition: 0.6s; }
        .rit-card:hover .rit-main-img { transform: scale(1.1); }
        .rit-card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%); display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; color: #fff; }
        .rit-subject { font-size: 14px; font-weight: 600; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rit-meta { display: flex; align-items: center; gap: 8px; font-size: 10px; opacity: 0.7; }
        .rit-bar { width: 1px; height: 8px; background: #fff; }

        .rit-modal-container { position: fixed; inset: 0; z-index: 100000; display: none; align-items: center; justify-content: center; }
        .rit-modal-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); }
        .rit-modal-window { position: relative; width: 95%; max-width: 1100px; height: 85vh; background: #fff; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
        .rit-modal-header { height: 60px; background: #000; display: flex; justify-content: space-between; align-items: center; padding: 0 25px; color: #fff; }
        .rit-logo { font-size: 10px; letter-spacing: 0.2em; opacity: 0.4; }
        .rit-grid-toggle { background: none; border: none; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .rit-modal-close { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }

        .rit-modal-content-wrap { flex: 1; position: relative; overflow: hidden; }
        .rit-detail-flex { display: flex; height: 100%; }
        .rit-modal-left { width: 45%; background: #000; display: flex; align-items: center; }
        .rit-modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .rit-modal-right { width: 55%; padding: 40px; overflow-y: auto; }
        
        /* 모달 이미지 핏 픽스 */
        @media (min-width: 768px) { .rit-modal-left img { object-fit: cover !important; } }

        .rit-grid-overlay { position: absolute; inset: 0; background: #fff; z-index: 100; overflow-y: auto; padding: 30px; }
        .rit-grid-layout { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .rit-grid-box { aspect-ratio: 1/1; cursor: pointer; border-radius: 4px; overflow: hidden; }
        .rit-grid-box img { width: 100%; height: 100%; object-fit: cover; }

        .rit-meta-line { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .rit-writer { font-weight: 800; font-size: 13px; }
        .rit-date { color: #ccc; font-size: 11px; margin-left: auto; }
        #ritSubject { font-size: 24px; font-weight: 700; margin-bottom: 25px; }
        .rit-content-body { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 40px; }
        
        .rit-c-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .rit-c-header h4 { font-size: 12px; font-weight: 900; }
        .rit-c-header a { font-size: 11px; color: #bbb; text-decoration: underline; }
        .rit-c-item { padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 8px; }
        .rit-c-item.admin { background: #fffaf0; border: 1px solid #f3e5ab; }
        .rit-c-name { font-size: 11px; font-weight: 800; margin-bottom: 4px; }
        .rit-c-con { font-size: 12px; color: #666; }
        
        .rit-pagination { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 11px; z-index: 10; }
        .rit-hidden { display: none; }

        @media (max-width: 768px) {
          .rit-detail-flex { flex-direction: column; }
          .rit-modal-left, .rit-modal-right { width: 100%; }
          .rit-modal-left { height: 45%; }
          .rit-grid-layout { grid-template-columns: repeat(2, 1fr); }
          .rit-header-area h2 { font-size: 28px; }
        }
      `;
      const s = document.createElement('style'); s.innerHTML = css; document.head.appendChild(s);
    }
  };

  window.ReviewApp = ReviewApp;
  ReviewApp.init(); // 즉시 실행
})(window);