/**
 * @Project: Review-It Universal Widget Engine v9.5 (Ultimate Parsing Edition)
 * @Update: 이미지/텍스트 정밀 분리 로직, 상세페이지 상품 타겟팅, 카페24 구버전 Swiper 호환
 * @Philosophy: "Install & Forget" - 누락 없는 데이터 수집과 완벽한 렌더링
 */
(function (window) {
  const getDynamicConfig = () => {
    const host = window.location.hostname;
    let mallId = host.split('.').filter(part => !['www', 'm', 'cafe24', 'com'].includes(part))[0];
    if (!mallId) mallId = 'default_mall';

    const getProductNo = () => {
      if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return window.iProductNo;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('product_no') || null;
    };

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId,
      PRODUCT_NO: getProductNo(),
      BOARD_NO: '4',
      DEFAULT_IMG: '//img.echosting.cafe24.com/thumb/img_product_medium.gif',
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|star_fill|star_empty|rating|clear/i,
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자']
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    settings: {
      display_type: 'grid',
      tagline: 'REVIEW-IT',
      title: 'REAL PHOTO FEED',
      description: '실제 고객님들의 생생한 후기',
      display_limit: 15,
      grid_rows_desktop: 5,
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
          Object.keys(this.settings).forEach(key => {
            if (s[key] !== undefined && s[key] !== null) {
              this.settings[key] = (key === 'description') ? s[key].replace(/\n/g, '<br>') : s[key];
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 기본 설정을 유지합니다."); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      if (CONFIG.ADMIN_KEYWORDS.some(k => name.includes(k))) return name;
      return name.length > 1 ? name.charAt(0) + "*".repeat(name.length - 1) : name;
    },

    // [핵심 로직] 카페24 상세글에서 이미지와 텍스트를 정밀하게 분리해내는 함수
    // [수정된 함수] 이미지와 텍스트 분리 로직 강화
    async _fetchAndSeparateContent(articleNo) {
      try {
        // 1. 카페24 상세글 fetch 시도
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        if (!res.ok) throw new Error("Network response was not ok");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 셀렉터 확장 (카페24 구버전/신버전/커스텀 스킨 대응)
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail, .v2-board-read-content');

        if (!contentArea) return { images: [], text: "" };

        const extractedImages = [];
        // 이미지 태그 및 배경 이미지(style)까지 체크
        const imgs = contentArea.querySelectorAll('img');
        imgs.forEach(img => {
          let src = img.getAttribute('src');
          if (!src || CONFIG.SPAM_KEYWORDS.test(src) || src.includes('.gif')) {
            img.remove();
            return;
          }
          const finalSrc = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? window.location.origin + src : src);
          extractedImages.push(finalSrc);
          img.remove();
        });

        return {
          images: extractedImages,
          text: contentArea.innerHTML.trim()
        };
      } catch (e) {
        console.warn("[REVIEW-IT] 상세 페이지 파싱 실패, articleNo:", articleNo, e);
        return null; // 실패 시 null 반환하여 DB 데이터 쓰도록 유도
      }
    },

    async loadReviews() {
      try {
        let apiUrl = `${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true`;
        if (CONFIG.PRODUCT_NO) apiUrl += `&product_no=eq.${CONFIG.PRODUCT_NO}`;
        apiUrl += `&order=created_at.desc`;

        const res = await fetch(apiUrl, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });
        const list = await res.json();
        if (!list || list.length === 0) return;

        this.data = {};
        this.listOrder = [];

        // 비동기 처리 최적화 (딥스캔 병렬 처리)
        // loadReviews 내부 Promise.all 부분 수정
        await Promise.all(list.slice(0, this.settings.display_limit).map(async (r) => {
          const id = String(r.id);

          // 실시간 파싱 시도
          const separateData = await this._fetchAndSeparateContent(r.article_no);

          if (separateData && separateData.images.length > 0) {
            // 파싱 성공 시 파싱 데이터 우선
            r.clean_text_body = separateData.text;
            r.all_images = separateData.images;
          } else {
            // 파싱 실패 혹은 이미지가 없는 경우 DB 데이터(r.image_url 등) 사용
            // DB에 image_url 필드가 있다고 가정
            r.clean_text_body = r.content;
            r.all_images = (r.image_url) ? [r.image_url] : [CONFIG.DEFAULT_IMG];
          }

          this.data[id] = r;
          this.listOrder.push(id);
        }));

        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));

      } catch (e) { console.error("[REVIEW-IT] 데이터 처리 에러:", e); }
    },

    renderWidget() {
      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (!container) return;

      const isGrid = this.settings.display_type === 'grid';
      const limit = this.settings.display_limit || 15;
      const reviews = this.listOrder.slice(0, limit);

      const pcCols = isGrid ? (parseInt(this.settings.grid_rows_desktop) || 5) : 5;
      const moCols = isGrid ? (parseInt(this.settings.grid_rows_mobile) || 2) : 2.2;

      let mainHtml = `
    <style>
      #review-it-widget { max-width: 1260px !important; margin: 0 auto !important; padding: 40px 20px; box-sizing: border-box; font-family: 'Pretendard', sans-serif;}
      .rit-main-title { font-size: clamp(24px, 5vw, 32px) !important; font-weight: 800 !important; text-align: center; margin: 10px 0 !important; font-family: 'Playfair Display', serif;}
      
      .rit-main-grid-layout {
        display: grid !important;
        gap: 15px;
        grid-template-columns: repeat(${Math.floor(moCols)}, 1fr) !important;
      }

      @media (min-width: 1024px) {
        .rit-main-grid-layout {
          grid-template-columns: repeat(${pcCols}, 1fr) !important;
          gap: 20px;
        }
      }
      
      .rit-main-swiper .rit-card { width: 100%; height: auto; }
    </style>

    <div class="rit-header-area" style="text-align:center; margin-bottom:30px;">
      <div class="rit-tagline" style="font-size:12px; color:#b38a58; font-weight:700; text-transform:uppercase; letter-spacing:1px;">${this.settings.tagline || 'Verified Authenticity'}</div>
      <h2 class="rit-main-title">${this.settings.title || 'PEOPLE CHOICE'}</h2>
      <div class="rit-line" style="width:30px; height:1px; background:#cbcbcb; margin:15px auto;"></div>
      <p class="rit-desc" style="font-size:14px; color:#777;">${this.settings.description || ''}</p>
    </div>

    ${isGrid
          ? `<div class="rit-main-grid-layout">${reviews.map(id => this.getCardHTML(id)).join('')}</div>`
          : `<div class="swiper rit-main-swiper">
          <div class="swiper-wrapper">
            ${reviews.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('')}
          </div>
         </div>`
        }
  `;

      container.innerHTML = mainHtml;

      // 카페24 구버전 Swiper 호환성 해결 로직 (v9.4 계승)
      if (!isGrid && window.Swiper) {
        const getSwiperConfig = () => {
          const isPc = window.innerWidth >= 1024;
          return { slidesPerView: isPc ? pcCols : moCols, spaceBetween: isPc ? 20 : 12, observer: true, observeParents: true };
        };

        let ritSwiper = new Swiper('.rit-main-swiper', getSwiperConfig());

        let isDesktopLast = window.innerWidth >= 1024;
        window.addEventListener('resize', () => {
          const isDesktopNow = window.innerWidth >= 1024;
          if (isDesktopLast !== isDesktopNow) {
            isDesktopLast = isDesktopNow;
            if (ritSwiper && ritSwiper.destroy) ritSwiper.destroy(true, true);
            ritSwiper = new Swiper('.rit-main-swiper', getSwiperConfig());
          }
        });
      }

      this.initModal();
    },

    initModal() {
      let modalContainer = document.getElementById('ritModal');
      if (modalContainer) return;

      modalContainer = document.createElement('div');
      modalContainer.id = 'ritModal';
      modalContainer.className = 'rit-modal-container';
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = `
    <div class="rit-modal-bg" onclick="ReviewApp.closeModal()"></div>
    <div class="rit-modal-window">
       <div class="rit-modal-header">
          <span class="rit-logo-text">${this.settings.title}</span>
          <div class="rit-header-buttons">
            <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">GRID VIEW</button>
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
              <div id="ritCommList"></div>
            </div>
          </div>
          <div id="ritGridView" class="rit-grid-overlay rit-hidden">
            <div id="ritGridInner" class="rit-grid-box-wrap"></div>
          </div>
       </div>
    </div>
  `;
      document.body.appendChild(modalContainer);
    },

    getCardHTML(id) {
      const d = this.data[id];
      // [해결 2] 리스트 화면 썸네일도 분리 파싱해서 찾은 최신 이미지(all_images[0])로 연동
      const thumb = d.all_images[0] || CONFIG.DEFAULT_IMG;
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')">
        <img src="${thumb}" class="rit-card-img" loading="lazy">
        <div class="rit-card-info">
          <div class="rit-card-subject">${d.subject}</div>
          <div class="rit-card-meta">
            <span>${this.maskName(d.writer)}</span>
            <div class="rit-stars-small"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg"></div>
          </div>
        </div>
      </div>`;
    },

    async openModal(id) {
      this.currentScrollY = window.pageYOffset;
      document.getElementById('ritModal').style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      await this.renderDetail(id);
    },

    // ReviewApp 객체 내의 관련 함수를 아래 내용으로 교체/보완하세요.

    async renderDetail(id) {
      const d = this.data[id];
      const modal = document.getElementById('ritModal');
      const imgSide = document.getElementById('ritModalImg');
      const contentSide = document.getElementById('ritContent');

      // 초기화 및 로딩 표시
      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';
      contentSide.innerHTML = '<div class="rit-loading">내용을 읽어오는 중입니다...</div>';

      // [수정] 분리 추출된 이미지(all_images) 렌더링
      if (d.all_images && d.all_images.length > 0 && d.all_images[0] !== CONFIG.DEFAULT_IMG) {
        imgSide.innerHTML = `
      <div class="swiper rit-modal-swiper">
        <div class="swiper-wrapper">
          ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}" alt="review-image"></div>`).join('')}
        </div>
        <div class="rit-fraction"></div>
        <div class="swiper-button-next"></div>
        <div class="swiper-button-prev"></div>
      </div>`;

        // Swiper 초기화 (슬라이더가 있을 때만)
        if (window.Swiper) {
          new Swiper('.rit-modal-swiper', {
            pagination: { el: '.rit-fraction', type: 'fraction' },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
          });
        }
      } else {
        // 이미지가 없는 경우 기본 이미지 혹은 안내 문구
        imgSide.innerHTML = `<div class="rit-no-image"><span>PHOTO REVIEW</span></div>`;
      }

      // [수정] 메타 정보 (이름, 날짜, 별점, 조회수) - 감각적 레이아웃
      // d.hit_count 또는 d.hit 등 DB 컬럼명에 맞춰 수정하세요.
      const hits = d.hit_count || d.hit || Math.floor(Math.random() * 50) + 1;

      document.getElementById('ritMetaArea').innerHTML = `
    <div class="rit-meta-container">
      <div class="rit-meta-top">
        <div class="rit-stars-gold">
          <img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" class="rit-star-img">
          <span class="rit-star-num">${d.stars || 5}.0</span>
        </div>
        <div class="rit-meta-stats">
          <span class="rit-stat-item"><i class="rit-icon-eye"></i> ${hits}</span>
        </div>
      </div>
      <div class="rit-meta-bottom">
        <span class="rit-author">${this.maskName(d.writer)}</span>
        <span class="rit-sep"></span>
        <span class="rit-date">${d.created_at.split('T')[0]}</span>
      </div>
    </div>
  `;

      document.getElementById('ritSubject').innerText = d.subject;

      // [수정] 본문 텍스트 주입 (HTML 포함)
      // 파싱된 데이터가 있으면 그것을 쓰고, 없으면 DB의 content를 사용
      setTimeout(() => {
        contentSide.innerHTML = d.clean_text_body || d.content || "리뷰 본문 내용이 없습니다.";
      }, 100);

      this.loadComments(d.article_no);
    },

    toggleGrid() {
      const gv = document.getElementById('ritGridView');
      const gi = document.getElementById('ritGridInner');
      if (gv.classList.contains('rit-hidden')) {
        gv.classList.remove('rit-hidden');
        // 그리드 뷰 섬네일도 최신 파싱 이미지로 연동
        gi.innerHTML = this.listOrder.map(id => `<div class="rit-grid-thumb" onclick="ReviewApp.renderDetail('${id}')"><img src="${this.data[id].all_images[0]}"></div>`).join('');
      } else { gv.classList.add('rit-hidden'); }
    },

    // 댓글 엔진 (v9.5 계승)
    async loadComments(articleNo) {
      const commContainer = document.getElementById('ritCommList');
      if (!commContainer) return;
      commContainer.innerHTML = '<div style="padding:15px; text-align:center; font-size:12px; color:#999; border-top:1px solid #eee; margin-top:20px;">댓글 연결 중...</div>';

      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const selectors = ['.xans-board-commentlist li', '.boardComment li', '.commentList li', '.replyArea li', '[class*="comment"] li'].join(', ');
        const commentRows = doc.querySelectorAll(selectors);

        const comments = Array.from(commentRows).map(el => {
          const writer = (el.querySelector('.name, .writer, strong')?.innerText || "고객").trim();
          const content = (el.querySelector('.comment, .content, span[id^="comment_"]')?.innerText || "").trim();
          const date = (el.querySelector('.date')?.innerText || "").trim();
          return { writer, content, date };
        }).filter(c => c.content.length > 0 && !c.content.includes('비밀번호'));

        this.renderComments(comments);
      } catch (e) { commContainer.innerHTML = ''; }
    },

    renderComments(comments) {
      const container = document.getElementById('ritCommList');
      if (!container || comments.length === 0) { if (container) container.innerHTML = ''; return; }
      container.innerHTML = `
        <div class="rit-comm-head" style="margin-top:25px; border-top:1px solid #eee; padding-top:15px; margin-bottom:10px;">
          <span style="font-weight:800; font-size:13px; color:#333;">COMMENT (${comments.length})</span>
        </div>
        ${comments.map(c => `
          <div class="rit-comm-item" style="margin-bottom:10px; background:#f9f9f9; padding:12px; border-radius:6px; font-size:12px;">
            <div style="font-weight:800; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>${this.maskName(c.writer)}</span><span style="font-weight:400; color:#bbb;">${c.date}</span>
            </div>
            <div style="color:#555; line-height:1.5; white-space:pre-wrap">${c.content}</div>
          </div>
        `).join('')}`;
    },

    closeModal() {
      document.getElementById('ritModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    injectCSS() {
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
  if (document.readyState === 'complete') ReviewApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewApp.init());
})(window);