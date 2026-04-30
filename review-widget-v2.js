/**
 * @Project: Review-It Universal Widget Engine v9.1
 * @Author: YKINAS Digital Assets Group
 * @Description: 카드 스타일 최적화 및 텍스트 바인딩 완벽 보완 버전
 */
(function (window) {
  const getDynamicConfig = () => {
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0];

    return {
      URL: 'https://ozxnynnntkjjyzbms.supabase.co', // 예시 URL 유지
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId,
      BOARD_NO: '4',
      DEFAULT_IMG: `${window.location.origin}/web/upload/no-img.png`,
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
      tagline: '!',
      title: 'REAL PHOTO FEED',
      description: '실제 고객님들의 생생한 후기',
      display_limit: 15,
      grid_rows_desktop: 3,
      grid_rows_mobile: 2
    },

    async init() {
      this.injectCSS();
      await this.loadWidgetSettings();
      await this.loadReviews();
      this.renderWidget();
    },

    async loadWidgetSettings() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/widget_settings?mall_id=eq.${CONFIG.MALL_ID}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const s = data[0];
          const isValid = (val) => val && val !== 'EMPTY' && val !== '' && val !== '예: 리얼 포토 피드';

          // 관리자 페이지 설정값 매핑
          if (isValid(s.tagline)) this.settings.tagline = s.tagline;
          if (isValid(s.title)) this.settings.title = s.title;
          if (isValid(s.description)) this.settings.description = s.description.replace(/\n/g, '<br>');

          this.settings.display_type = s.display_type || 'grid';
          this.settings.grid_rows_desktop = s.grid_rows_desktop || 3;
          this.settings.grid_rows_mobile = s.grid_rows_mobile || 2;
          this.settings.display_limit = s.display_limit || 15;
        }
      } catch (e) { console.warn("[REVIEW-IT] 설정 로드 실패"); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => String(name).includes(k))) return name;
      let n = String(name).split('[')[0].replace(/[*]/g, '').trim();
      return n.length <= 1 ? n + "*" : n.substring(0, 1) + "*" + (n.length > 2 ? n.substring(2) : "");
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true&order=created_at.desc&limit=${this.settings.display_limit}`, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        this.data = {}; this.listOrder = [];
        for (const r of list) {
          const id = String(r.id);
          r.all_images = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [CONFIG.DEFAULT_IMG];
          this.data[id] = r;
          this.listOrder.push(id);
        }
      } catch (e) { console.error("[REVIEW-IT] 로드 에러"); }
    },

    renderWidget() {
      const container = document.getElementById('rit-widget-container');
      if (!container) return;

      const gridCols = `rit-pc-cols-${this.settings.grid_rows_desktop} rit-mo-cols-${this.settings.grid_rows_mobile}`;

      let html = `
        <div class="rit-header-area">
          <div class="rit-tagline">${this.settings.tagline}</div>
          <h2 class="rit-main-title">${this.settings.title}</h2>
          <div class="rit-line"></div>
          <p class="rit-desc">${this.settings.description}</p>
        </div>
        <div class="rit-main-grid-layout ${gridCols}">
          ${this.listOrder.map(id => this.getCardHTML(id)).join('')}
        </div>
        <div id="ritModal" class="rit-modal-container" style="display:none;">
          <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
          <div class="rit-modal-window">
             <div class="rit-modal-header">
                <span class="rit-modal-logo">${this.settings.title}</span>
                <button onclick="ReviewApp.closeModal()" class="rit-close-btn">✕</button>
             </div>
             <div id="ritDetailView" class="rit-modal-flex">
                <div id="ritModalImg" class="rit-modal-img-side"></div>
                <div class="rit-modal-txt-side">
                   <div id="ritMetaArea"></div>
                   <h3 id="ritSubject" class="rit-modal-subject"></h3>
                   <div id="ritContent" class="rit-modal-content"></div>
                   <div id="ritProductCard"></div>
                </div>
             </div>
          </div>
        </div>
      `;
      container.innerHTML = html;
    },

    getCardHTML(id) {
      const d = this.data[id];
      return `
        <div class="rit-card" onclick="ReviewApp.openModal('${id}')">
          <div class="rit-img-box">
            <img src="${d.all_images[0]}" class="rit-thumb" loading="lazy">
          </div>
          <div class="rit-info-box">
            <div class="rit-card-subject">${d.subject}</div>
            <div class="rit-card-footer">
              <span class="rit-card-writer">${this.maskName(d.writer)}</span>
              <div class="rit-card-stars"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
            </div>
          </div>
        </div>`;
    },

    async openModal(id) {
      this.currentScrollY = window.pageYOffset;
      const d = this.data[id];
      const modal = document.getElementById('ritModal');
      modal.style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;

      document.getElementById('ritModalImg').innerHTML = `<img src="${d.all_images[0]}" style="width:100%; height:100%; object-fit:cover;">`;
      document.getElementById('ritMetaArea').innerHTML = `<div class="rit-meta-info">${this.maskName(d.writer)} | ${new Date(d.created_at).toLocaleDateString()}</div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      document.getElementById('ritContent').innerText = d.content;

      // 코멘트/원문보기 등 추가 로직 생략(v9.0 기반 유지)
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
      const style = document.createElement('style');
      style.innerHTML = `
        #rit-widget-container { padding: 80px 20px; max-width: 1200px; margin: 0 auto; font-family: 'Inter', 'Noto Sans KR', sans-serif; }
        .rit-header-area { text-align: center; margin-bottom: 60px; }
        .rit-tagline { font-size: 14px; letter-spacing: 4px; color: #aaa; margin-bottom: 12px; }
        .rit-main-title { font-size: 36px; font-weight: 800; color: #000; margin: 0; }
        .rit-line { width: 40px; height: 1px; background: #000; margin: 25px auto; }
        .rit-desc { color: #888; font-size: 16px; }

        /* 리스트 그리드 레이아웃 */
        .rit-main-grid-layout { display: grid; gap: 20px; }
        .rit-pc-cols-3 { grid-template-columns: repeat(3, 1fr); }
        .rit-mo-cols-2 { grid-template-columns: repeat(2, 1fr); }

        /* 카드 디자인: 이미지와 텍스트 분리 */
        .rit-card { cursor: pointer; background: #fff; border-radius: 12px; overflow: hidden; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); border: 1px solid #f0f0f0; }
        .rit-card:hover { transform: translateY(-8px); box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
        .rit-img-box { width: 100%; aspect-ratio: 1/1; overflow: hidden; background: #f9f9f9; }
        .rit-thumb { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s; }
        .rit-card:hover .rit-thumb { transform: scale(1.08); }

        .rit-info-box { padding: 20px; text-align: left; background: #fff; }
        .rit-card-subject { font-size: 15px; font-weight: 600; color: #222; margin-bottom: 12px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; height: 2.8em; }
        .rit-card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f5f5f5; pt: 12px; padding-top: 12px; }
        .rit-card-writer { font-size: 13px; color: #999; }
        .rit-card-stars img { height: 12px; }

        /* 모달 스타일 수정 */
        .rit-modal-container { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .rit-modal-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); }
        .rit-modal-window { position: relative; width: 100%; max-width: 1000px; background: #fff; border-radius: 0; overflow: hidden; display: flex; flex-direction: column; }
        .rit-modal-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .rit-modal-logo { font-weight: 900; letter-spacing: 1px; font-size: 14px; }
        .rit-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; }
        .rit-modal-flex { display: flex; height: 600px; }
        .rit-modal-img-side { flex: 1.2; background: #f9f9f9; }
        .rit-modal-txt-side { flex: 1; padding: 40px; overflow-y: auto; text-align: left; }
        .rit-modal-subject { font-size: 20px; font-weight: 700; margin: 20px 0; line-height: 1.4; }
        .rit-modal-content { font-size: 15px; line-height: 1.8; color: #555; }

        @media (max-width: 1023px) {
          .rit-main-grid-layout { grid-template-columns: repeat(2, 1fr); }
          .rit-modal-flex { flex-direction: column; height: auto; max-height: 90vh; }
          .rit-modal-img-side { aspect-ratio: 1/1; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  window.ReviewApp = ReviewApp;
  ReviewApp.init();
})(window);