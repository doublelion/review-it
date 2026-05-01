/**
 * @Project: Review-It Universal Widget Engine v9.0
 * @Update: 타이틀 바인딩 버그 수정, 401 에러 방지 정책 통합, v8.5 정밀 로직 계승
 * @Philosophy: "Install & Forget" - 설치 즉시 매출로 연결되는 리뷰 솔루션
 */
(function (window) {
  // [1] 환경 감지 및 설정 자동화
  const getDynamicConfig = () => {
    // 카페24 전역 객체 또는 현재 호스트네임에서 Mall ID를 자동으로 추출합니다.
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : (window.EC_SHOP_FRONT_NEW && window.EC_SHOP_FRONT_NEW.getMallID)
        ? window.EC_SHOP_FRONT_NEW.getMallID()
        : window.location.hostname.split('.')[0];

    const urlParams = new URLSearchParams(window.location.search);
    const productNo = urlParams.get('product_no');
    // 강제 보정 (테스트용: DB와 일치시키기)
    if (mallId.includes('ykinas')) mallId = 'ykinas';

    console.log("[REVIEW-IT] Detected Mall ID:", mallId);
    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // 익명 키 (보안 주의)
      API_ENDPOINT: 'https://review-it-tau.vercel.app/api/reviews',
      MALL_ID: mallId,
      TARGET_ID: 'review-it-widget',
      PRODUCT_NO: productNo,
      BOARD_NO: '4',
      DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/no-img.png',
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자'],
      SPAM_KEYWORDS: /star|icon|btn|twitch|logo|dummy|ec2-common|star_fill|star_empty/i
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    currentScrollY: 0,
    settings: {
      display_type: 'grid',
      tagline: 'REVIEW-IT',
      title: 'REAL PHOTO FEED',
      description: '실제 고객님들의 생생한 후기',
      display_limit: 15,
      grid_rows_desktop: 1,
      grid_rows_mobile: 2
    },

    // [2] 초기화 로직
    async init() {
      this.injectCSS();
      // 1. 서버 설정 로드 (Mall ID 기반)
      await this.loadWidgetSettings();
      // 2. 리뷰 데이터 로드 및 본문 딥스캔
      await this.loadReviews();
      // 3. UI 렌더링
      this.renderWidget();
    },

    // [3] 설정 데이터 로드
    async loadWidgetSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const s = data[0];
          Object.keys(this.settings).forEach(key => {
            if (s[key] !== undefined && s[key] !== null) {
              this.settings[key] = (key === 'description') ? s[key].replace(/\n/g, '<br>') : s[key];
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 설정 로드 실패, 기본값을 사용합니다."); }
    },

    // [4] 데이터 마스킹 및 정제
    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => String(name).includes(k))) return name;
      let n = String(name).split('[')[0].replace(/[*]/g, '').trim();
      if (n.length > 10) return "고객";
      if (n.length <= 1) return n + "*";
      if (n.length === 2) return n[0] + "*";
      return n.substring(0, 2) + "**";
    },

    // [5] 본문 및 이미지 정밀 스캔 (Deep Scan)
    async _fetchFullContent(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail');
        if (!contentArea) return null;
        return contentArea.innerHTML.replace(/<img[^>]*>|<button[^>]*>.*?<\/button>|<script[^>]*>.*?<\/script>/g, "").trim();
      } catch (e) { return null; }
    },

    async _deepScan(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail');
        const imgs = Array.from((contentArea || doc).querySelectorAll('img')).map(img => {
          let src = img.getAttribute('src');
          if (!src || CONFIG.SPAM_KEYWORDS.test(src) || src.includes('.gif')) return null;
          return src.startsWith('//') ? 'https:' + src : src;
        }).filter(src => src !== null);
        return imgs;
      } catch (e) { return []; }
    },

    // [6] 리뷰 데이터 로드 및 매핑
    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        const targetList = list.slice(0, this.settings.display_limit);

        this.data = {};
        this.listOrder = [];

        r.all_images = imgs.filter(src =>
          !CONFIG.SPAM_KEYWORDS.test(src) &&
          !src.includes('icon-star') &&
          !src.includes('.svg')
        );
        
        await Promise.all(targetList.map(async (r) => {
          const id = String(r.id);
          let imgs = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : await this._deepScan(r.article_no);
          r.all_images = imgs.filter(src => !CONFIG.SPAM_KEYWORDS.test(src));
          if (r.all_images.length === 0) r.all_images = [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }));
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) { console.error("[REVIEW-IT] 데이터 로드 오류:", e); }
    },

    // [7] 위젯 렌더링
    renderWidget() {
      const container = document.getElementById(CONFIG.TARGET_ID) || document.getElementById('rit-widget-container');
      if (!container) {
        console.error("[REVIEW-IT] 위젯을 그릴 컨테이너(#review-it-widget)를 찾을 수 없습니다.");
        return;
      }

      const gridClass = `rit-pc-r${this.settings.grid_rows_desktop} rit-mo-r${this.settings.grid_rows_mobile}`;
      let html = `
        <div class="rit-header-area">
          <div class="rit-tagline">${this.settings.tagline}</div>
          <h2 class="rit-main-title">${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
      `;

      if (this.settings.display_type === 'grid') {
        html += `<div class="rit-main-grid-layout ${gridClass}">${this.listOrder.map(id => this.getCardHTML(id)).join('')}</div>`;
      } else {
        html += `<div class="swiper rit-main-swiper"><div class="swiper-wrapper">${this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}</div></div>`;
      }

      // 모달 및 상세 뷰 구조
      html += `
        <div id="ritModal" class="rit-modal-container" style="display:none;">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
            <div class="rit-modal-header">
              <span class="rit-logo-text">${this.settings.title}</span>
              <div class="rit-header-buttons">
                <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="9" rx="1" /><rect x="13" y="2" width="9" height="9" rx="1" /><rect x="2" y="13" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" /></svg>
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
                  <div id="ritContent" class="rit-body-text">불러오는 중...</div>
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

      // 메인 스와이퍼 실행
      if (this.settings.display_type !== 'grid' && window.Swiper) {
        new Swiper('.rit-main-swiper', {
          slidesPerView: 2.2,
          spaceBetween: 15,
          autoplay: { delay: 4000 },
          breakpoints: { 1024: { slidesPerView: 5.2, spaceBetween: 25 } }
        });
      }
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')">
        <img src="${d.all_images[0]}" class="rit-card-img" loading="lazy">
        <div class="rit-card-info">
          <div class="rit-card-subject">${d.subject}</div>
          <div class="rit-card-meta">
            <span>${this.maskName(d.writer)}</span>
            <div class="rit-stars-small"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
          </div>
        </div>
      </div>`;
    },

    // [8] 모달 및 상세 페이지 로직
    async openModal(id) {
      this.currentScrollY = window.pageYOffset;
      document.getElementById('ritModal').style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      await this.renderDetail(id);
    },

    async renderDetail(id) {
      const d = this.data[id];
      const gv = document.getElementById('ritGridView');
      const dv = document.getElementById('ritDetailView');

      gv.classList.add('rit-hidden');
      dv.style.display = 'flex';

      // 상세 이미지 스와이퍼
      document.getElementById('ritModalImg').innerHTML = `
        <div class="swiper rit-modal-swiper">
          <div class="swiper-wrapper">
            ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}"></div>`).join('')}
          </div>
          <div class="rit-fraction"></div>
          <div class="swiper-button-next rit-nav"></div>
          <div class="swiper-button-prev rit-nav"></div>
        </div>`;

      if (window.Swiper) {
        new Swiper('.rit-modal-swiper', {
          pagination: { el: '.rit-fraction', type: 'fraction' },
          navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
        });
      }

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-top-meta">
          <span class="rit-name-tag">${this.maskName(d.writer)}</span>
          <span class="rit-divider">|</span>
          <div class="rit-star-box"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
          <span class="rit-date-tag">${new Date(d.created_at).toLocaleDateString()}</span>
        </div>`;

      document.getElementById('ritSubject').innerText = d.subject;

      // 본문 로드
      const fullContent = await this._fetchFullContent(d.article_no);
      document.getElementById('ritContent').innerHTML = fullContent || d.content.replace(/<[^>]*>?/gm, '');

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
      pCard.innerHTML = `
        <div class="rit-comm-head">
          <span>COMMENTS</span>
          <a href="/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}" target="_blank">리뷰 원문보기</a>
        </div>
        <div id="ritCommList"></div>`;

      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.boardComment li, .commentList li, .replyArea li');
        const list = document.getElementById('ritCommList');

        if (items.length > 0) {
          list.innerHTML = Array.from(items).map(item => {
            const wr = item.querySelector('.name')?.innerText || "운영자";
            const ct = item.querySelector('.comment, .content')?.innerText || "";
            return `<div class="rit-comm-item"><div class="rit-comm-name">${this.maskName(wr)}</div><div class="rit-comm-body">${ct}</div></div>`;
          }).join('');
        } else {
          list.innerHTML = '<p class="rit-no-comm">등록된 답변이 없습니다.</p>';
        }
      } catch (e) { console.warn("댓글 로드 실패"); }
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    // [9] 스타일 및 외부 리소스 주입
    injectCSS() {
      const styleId = 'rit-dynamic-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          #rit-widget-container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 40px 10px; font-family: 'Inter', 'Noto Sans KR', sans-serif; }
          .rit-header-area { text-align: center; margin-bottom: 40px; }
          .rit-tagline { font-size: 11px; letter-spacing: 3px; color: #888; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; }
          .rit-main-title { font-size: 28px; font-weight: 900; color: #000; margin: 0; }
          .rit-line { width: 40px; height: 3px; background: #000; margin: 20px auto; }
          .rit-desc { font-size: 15px; color: #666; font-weight: 400; }
          
          /* 그리드 레이아웃 */
          .rit-main-grid-layout { display: grid; gap: 15px; }
          @media (min-width: 1024px) {
            .rit-main-grid-layout { grid-template-columns: repeat(5, 1fr); }
            .rit-pc-r1 > div:nth-child(n+6) { display: none; }
            .rit-pc-r2 > div:nth-child(n+11) { display: none; }
          }
          @media (max-width: 1023px) {
            .rit-main-grid-layout { grid-template-columns: repeat(2, 1fr); }
            .rit-mo-r1 > div:nth-child(n+3) { display: none; }
            .rit-mo-r2 > div:nth-child(n+5) { display: none; }
          }

          /* 카드 및 이미지 */
          .rit-card { cursor: pointer; border-radius: 4px; overflow: hidden; background: #fff; border: 1px solid #eee; transition: 0.3s; }
          .rit-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
          .rit-card-img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
          .rit-card-info { padding: 15px; text-align: left; }
          .rit-card-subject { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .rit-card-meta { display: flex; justify-content: space-between; align-items: center; }
          .rit-card-meta span { font-size: 12px; color: #999; }
          .rit-stars-small img { height: 11px; }

          /* 모달 스타일 생략(CSS 파일에서 로드 권장하나 구조 유지를 위해 핵심만 포함) */
          .rit-modal-container { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .rit-modal-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); }
          .rit-modal-window { position: relative; background: #fff; width: 100%; max-width: 1000px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px; }
          .rit-modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
          .rit-logo-text { font-weight: 900; letter-spacing: -0.5px; }
          .btn-rit-close { background: none; border: none; font-size: 20px; cursor: pointer; }
          .rit-modal-body { flex: 1; overflow-y: auto; padding: 0; }
          .rit-flex-container { display: flex; flex-wrap: wrap; height: 100%; }
          .rit-img-side { width: 60%; background: #f8f8f8; position: relative; }
          .rit-img-side img { width: 100%; height: 100%; object-fit: contain; }
          .rit-txt-side { width: 40%; padding: 30px; text-align: left; border-left: 1px solid #eee; overflow-y: auto; }
          @media (max-width: 768px) { .rit-img-side, .rit-txt-side { width: 100%; } .rit-txt-side { border-left: none; } }
          
          /* 댓글 스타일 */
          .rit-comm-head { margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; }
          .rit-comm-item { margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 4px; }
          .rit-comm-name { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 4px; }
          .rit-comm-body { font-size: 12px; color: #666; line-height: 1.5; }
        `;
        document.head.appendChild(style);
      }

      // 외부 CSS 리소스 로드
      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }
    }
  };

  window.ReviewApp = ReviewApp;
  // DOM 완료 후 초기화
  if (document.readyState === 'complete') { ReviewApp.init(); }
  else { window.addEventListener('DOMContentLoaded', () => ReviewApp.init()); }

})(window);