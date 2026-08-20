/**
 * @Project: Review-It Detail Engine (Production Master v1.7.0)
 * @Feature: Independent Modal Popup, 0-Review Global Demo Fallback, Strict Class Isolation
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Production Engine Master Loaded!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

  // 기존 위젯 클린업
  document.querySelectorAll('.rit-oy-summary-wrap, .rit-detail-thumb-wrap, .rit-detail-container, #rit-detail-css, #ritDtlModal').forEach(el => el.remove());

  const getProductNo = () => {
    if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return String(window.iProductNo);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('product_no')) return urlParams.get('product_no');
    const pathMatches = window.location.pathname.match(/\/product\/(?:[^\/]+\/)?(\d+)/i);
    if (pathMatches && pathMatches[1]) return pathMatches[1];
    const metaPrd = document.querySelector('meta[property="product:productId"], meta[name="product_no"]');
    if (metaPrd && metaPrd.content) return metaPrd.content;
    return null;
  };

  const getMallName = () => {
    if (window.iMallName && window.iMallName !== "") return window.iMallName;
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) return ogSiteName.content.trim();
    let title = document.title || "";
    if (title.includes('-')) title = title.split('-').pop().trim();
    else if (title.includes(':')) title = title.split(':')[0].trim();
    title = title.replace(/공식몰|공식홈페이지|온라인스토어/g, "").trim();
    return title.length > 15 ? title.substring(0, 15) + '...' : (title || "REVIEW-IT");
  };

  const productNo = getProductNo();
  const mallId = (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) || window.location.hostname.split('.')[0];

  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    starPath: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
    spamKeywords: /star|icon|btn|logo|dummy|ec2-common|star_fill|star_empty|rating|clear/i,
    adminKeywords: ['관리자', 'official', '운영자', 'admin', '대표', '주인장', 'md', '스토어', '스태프', 'staff', '엘보라'],
    mallId: mallId,
    mallName: getMallName()
  };

  const ReviewDetailApp = {
    settings: {},
    data: {},
    listOrder: [],
    photoReviews: [],
    isFallbackDemo: false, // 💡 리뷰 0개 시 데모 화면 작동 여부 플래그

    async init() {
      this.injectCSS();
      this.hideDefaultReviews();
      if (!productNo) return;

      await this.loadSettings();
      await this.loadReviewsAndParse(); // 💡 팝업을 위해 HTML 파싱까지 포함된 로드

      this.initModal(); // 💡 독립된 팝업 레이어 초기화

      if (this.settings.is_detail_summary_enabled !== false) this.renderTopSummary();
      if (this.settings.is_detail_gallery_enabled !== false) this.renderUnderThumbGallery();
      if (this.settings.is_detail_main_enabled !== false) this.renderMainDetailBoard();
    },

    async loadSettings() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` }
        });
        const data = await res.json();
        if (data && data.length > 0) this.settings = data[0];
      } catch (e) {
        this.settings = { detail_display_type: 'masonry', is_detail_summary_enabled: true, is_detail_gallery_enabled: true, is_detail_main_enabled: true };
      }
    },

    cleanEditorText(text) {
      if (!text) return "";
      return String(text).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/p\.p1\s*\{[^}]*\}/gi, '').replace(/span\.s1\s*\{[^}]*\}/gi, '').replace(/&nbsp;/gi, ' ').trim();
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      name = name.trim();
      if (name.length <= 2) return name.charAt(0) + '*';
      if (name.length === 3) return name.charAt(0) + '*' + name.charAt(2);
      return name.substring(0, 2) + '**';
    },

    // 💡 위젯 엔진의 본문/이미지 스크래핑 로직 이식 (팝업 고화질 이미지용)
    async _fetchAndSeparateContent(articleNo, boardNo = '4') {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const readArea = doc.querySelector('.xans-board-read-4, .xans-board-read, #board_read');
        let extractedDate = null, extractedWriter = null;

        if (readArea) {
          const dateEl = readArea.querySelector('.date, .write-date, td.date, .info .date');
          if (dateEl) {
            const match = dateEl.innerText.trim().match(/\d{4}\s*[-./]\s*\d{2}\s*[-./]\s*\d{2}/);
            if (match) extractedDate = match[0].replace(/\s/g, '').replace(/[\./]/g, '-');
          }
          const writerEl = readArea.querySelector('.description .name, .head .name, .xans-board-read .name');
          if (writerEl) {
            const clone = writerEl.cloneNode(true);
            const hidden = clone.querySelector('.displaynone');
            if (hidden) hidden.remove();
            extractedWriter = clone.innerText.replace(/\(ip:.*\)/gi, '').trim();
          }
        }

        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content');
        const extractedImages = [];
        const uniqueSet = new Set();

        const processImg = (src) => {
          if (!src || CONFIG.spamKeywords.test(src) || src.includes('.gif')) return;
          let finalSrc = src.replace(/\/(tiny|small|medium)\//gi, '/big/');
          finalSrc = finalSrc.startsWith('//') ? 'https:' + finalSrc : (finalSrc.startsWith('/') ? window.location.origin + finalSrc : finalSrc);
          if (!uniqueSet.has(finalSrc)) { uniqueSet.add(finalSrc); extractedImages.push(finalSrc); }
        };

        if (contentArea) {
          contentArea.querySelectorAll('img').forEach(img => { processImg(img.getAttribute('src')); img.remove(); });
        }

        return { images: extractedImages, text: contentArea ? contentArea.innerHTML.trim() : "", date: extractedDate, writer: extractedWriter };
      } catch (e) { return null; }
    },

    // 💡 리뷰 로드 및 0건일 시 데모(전체) 데이터 로드 로직
    async loadReviewsAndParse() {
      try {
        const baseUrl = `${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true`;
        let res = await fetch(`${baseUrl}&product_no=eq.${productNo}&order=created_at.desc`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
        let list = await res.json();

        if (!list || list.length === 0) {
          // 💡 [Zero-Review 데모] 리뷰가 없으면 몰 전체 리뷰 15개를 불러옵니다.
          this.isFallbackDemo = true;
          const fbRes = await fetch(`${baseUrl}&order=created_at.desc&limit=15`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
          list = await fbRes.json();
        }

        this.data = {};
        this.listOrder = [];
        this.photoReviews = [];

        // 빠른 로딩을 위해 15개까지만 처리
        await Promise.all(list.slice(0, 15).map(async (r) => {
          const parsed = await this._fetchAndSeparateContent(r.article_no, r.board_no);
          r.clean_text_body = parsed ? this.cleanEditorText(parsed.text || r.content) : this.cleanEditorText(r.content);
          r.all_images = (parsed && parsed.images.length > 0) ? parsed.images : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg]);
          if (parsed && parsed.date) r.original_date = parsed.date;
          if (parsed && parsed.writer) r.author_name = parsed.writer;

          this.data[r.id] = r;
          this.listOrder.push(r.id);
          if (r.all_images[0] !== CONFIG.defaultImg) this.photoReviews.push(r);
        }));
        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
      } catch (e) {
        console.error("Review load failed", e);
      }
    },

    hideDefaultReviews() {
      const selectors = ['.xans-product-review', 'a[name="use_review"]', '#prdReview > table', '#prdReview > .board'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => { if (el) el.style.setProperty('display', 'none', 'important'); });
    },

    injectToBoard(container) {
      const prdReview = document.querySelector('#prdReview');
      const additional = document.querySelector('.xans-product-additional');
      const prdDetail = document.querySelector('#prdDetail, .xans-product-detail');
      if (prdReview) prdReview.appendChild(container);
      else if (additional) additional.appendChild(container);
      else if (prdDetail) prdDetail.appendChild(container);
      else document.body.appendChild(container);
    },

    renderTopSummary() {
      let infoArea = document.querySelector('.xans-product-info, .infoArea, .prdInfo, .product-info-section');
      if (!infoArea) return;

      const realCount = this.isFallbackDemo ? 0 : this.listOrder.length;
      let avgScore = '5.0';

      if (realCount > 0) {
        let totalStars = 0;
        this.listOrder.forEach(id => totalStars += (this.data[id].stars || 5));
        avgScore = (totalStars / realCount).toFixed(1);
      }

      const avatarPhotos = this.isFallbackDemo ? [] : this.photoReviews.slice(0, 2);
      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'rit-oy-summary-wrap cboth';
      summaryContainer.innerHTML = `
        <div class="rit-oy-content" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">
          <div class="rit-oy-left">
            <span class="rit-oy-star">★ ${avgScore}</span>
            <span class="rit-oy-count">리뷰 ${realCount}건</span>
          </div>
          <div class="rit-oy-avatars">
            ${realCount > 0 && avatarPhotos.length > 0
          ? avatarPhotos.map(r => `<img src="${r.all_images[0]}" class="rit-oy-avatar">`).join('') + `<div class="rit-oy-avatar-more">+</div>`
          : `<span style="font-size:11px; color:#94a3b8; font-weight:500;">첫 리뷰 작성 시 혜택 지급 ✨</span>`
        }
          </div>
        </div>
      `;
      const productNameEl = infoArea.querySelector('.name, .prd-name, h2, h3, .headingArea');
      if (productNameEl) productNameEl.parentNode.insertBefore(summaryContainer, productNameEl.nextSibling);
      else infoArea.insertBefore(summaryContainer, infoArea.firstChild);
    },

    renderUnderThumbGallery() {
      let targetEl = document.querySelector('.detailArea') || document.querySelector('.xans-product-image') || document.querySelector('.imgArea');
      if (!targetEl || !targetEl.parentNode) return;

      const galleryContainer = document.createElement('div');
      galleryContainer.className = 'rit-detail-thumb-wrap cboth';
      let photosHtml = '';
      const realPhotos = this.isFallbackDemo ? 0 : this.photoReviews.length;

      // 💡 데모 모드이거나 실제 사진이 없으면 더미 5구 렌더링 (클릭 시 작성 폼으로 이동)
      if (this.isFallbackDemo || realPhotos === 0) {
        const dummyArr = [1, 2, 3, 4, 5];
        photosHtml = dummyArr.map((num, index) => `
          <div class="rit-detail-thumb-item rit-detail-dummy-item" onclick="window.location.href='/board/product/write.html?board_no=4&product_no=${productNo}'">
            <img src="${CONFIG.defaultImg}" alt="sample">
            ${index === 2 ? `<div class="rit-detail-dummy-text">첫 포토 리뷰를<br>기다려요!</div>` : ''}
          </div>
        `).join('');
      } else {
        const photos = this.photoReviews.slice(0, 5);
        const hasMore = realPhotos > 5;
        photosHtml = photos.map((r, index) => {
          const isLast = index === 4;
          return `
            <div class="rit-detail-thumb-item" onclick="if(window.ReviewDetailApp) window.ReviewDetailApp.openModal('${r.id}')">
              <img src="${r.all_images[0]}" alt="review" onerror="this.src='${CONFIG.defaultImg}'">
              ${isLast && hasMore ? `<div class="rit-detail-thumb-more"><span>${realPhotos}<br>더보기</span></div>` : ''}
            </div>
          `;
        }).join('');
      }

      galleryContainer.innerHTML = `
        <div class="rit-detail-thumb-header">
          <span class="rit-detail-thumb-title">포토리뷰 <span class="rit-detail-count">(${realPhotos}건)</span></span>
          <span class="rit-detail-thumb-view-all" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">전체보기</span>
        </div>
        <div class="rit-detail-thumb-list">${photosHtml}</div>
      `;
      targetEl.parentNode.insertBefore(galleryContainer, targetEl.nextSibling);
    },

    renderMainDetailBoard() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-detail-container cboth';

      // 대시보드는 이 상품의 '진짜' 스코어를 보여줘야 함
      const realCount = this.isFallbackDemo ? 0 : this.listOrder.length;
      const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let avgScore = '0.0';

      if (realCount > 0) {
        let totalStars = 0;
        this.listOrder.forEach(id => {
          const star = this.data[id].stars || 5;
          totalStars += star;
          starCounts[star]++;
        });
        avgScore = (totalStars / realCount).toFixed(1);
      }

      const dashboardHtml = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score">${avgScore}</div> 
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars" style="color:${realCount === 0 ? '#e4e4e7' : '#f59e0b'}; font-size:16px;">★★★★★</div>
                <div class="rit-dash-count-text">총 <strong>${realCount}개</strong>의 리뷰</div>
              </div>
            </div>
          </div>
          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
        const pct = realCount === 0 ? 0 : Math.round((starCounts[star] / realCount) * 100);
        return `
                <div class="rit-gauge-row">
                  <span class="rit-gauge-label">${star}점</span>
                  <div class="rit-gauge-bg"><div class="rit-gauge-fill" style="width: ${pct}%;"></div></div>
                  <span class="rit-gauge-percent">${pct}%</span>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;

      let contentHtml = '';
      if (this.isFallbackDemo) {
        // 💡 0건일 때: 빈 상태 배너 + 데모 데이터(전체 리뷰) 렌더링
        contentHtml += `
          <div class="rit-empty-state" style="margin-bottom: 50px;">
            <div class="rit-empty-icon">✨</div>
            <h3 class="rit-empty-title">이 상품의 첫 번째 리뷰어가 되어주세요!</h3>
            <p class="rit-empty-desc">아직 작성된 리뷰가 없습니다.<br>지금 첫 포토 리뷰를 남겨주시면 <strong>특별한 혜택</strong>을 드립니다!</p>
            <a href="/board/product/write.html?board_no=4&product_no=${productNo}" class="rit-btn-write">첫 리뷰 작성하고 혜택 받기</a>
          </div>
          <div class="rit-detail-header">
            <h2 class="rit-detail-title">다른 고객들의 베스트 리뷰</h2>
            <p style="font-size:13px; color:#71717a; margin-top:5px;">현재 상품의 리뷰를 기다리는 동안, 다른 구매자들의 생생한 후기를 먼저 확인해보세요!</p>
          </div>
        `;
      }

      // 리뷰가 있든(isFallback=false) 없든(isFallback=true) 데모/실제 데이터가 listOrder에 있으므로 공통 렌더링
      const isSwiper = this.settings.detail_display_type === 'swiper';
      contentHtml += `<div id="rit-detail-grid" class="${isSwiper ? 'swiper rit-detail-swiper' : 'rit-masonry-grid'}">${isSwiper ? '<div class="swiper-wrapper"></div>' : ''}</div>`;

      container.innerHTML = `
        <div class="rit-detail-header" style="margin-top: 60px;">
          <h2 class="rit-detail-title">${this.settings.title || 'Product Reviews'}</h2>
        </div>
        ${dashboardHtml}
        ${contentHtml}
      `;

      this.injectToBoard(container);

      if (this.listOrder.length > 0) {
        if (isSwiper) this.initSwiper();
        else this.initMasonry();
      }
    },

    getCardHTML(id) {
      const d = this.data[id];
      const rawName = (d.author_name ? d.author_name : (d.writer || '고객')).trim();
      const isMallOwner = CONFIG.adminKeywords.some(k => rawName.toLowerCase().includes(k.toLowerCase())) || rawName.includes(CONFIG.mallName);
      const displayName = isMallOwner ? rawName : this.maskName(rawName);

      let formattedDate = d.original_date || (d.created_at ? d.created_at.split('T')[0] : '');
      if (formattedDate) formattedDate = formattedDate.replace(/-/g, '.');

      const imgUrl = d.all_images[0];
      return `
        <div class="rit-masonry-item" onclick="if(window.ReviewDetailApp) window.ReviewDetailApp.openModal('${id}')" style="cursor:pointer; height:100%;">
          <div style="position:relative; width:100%; overflow:hidden; background:#f4f4f5;"><img src="${imgUrl}" class="rit-masonry-img" onerror="this.src='${CONFIG.defaultImg}'"></div>
          <div class="rit-masonry-info">
            <div style="font-size:11px; font-weight:700; color:#52525b; margin-bottom:5px;">★ ${d.stars || 5}.0</div>
            <div class="rit-masonry-subject">${d.subject || ''}</div>
            <div class="rit-masonry-desc">${d.clean_text_body || ''}</div>
            <div class="rit-masonry-meta"><span style="font-weight:600; color:#71717a;">${displayName}</span><span style="color:#a1a1aa;">${formattedDate}</span></div>
          </div>
        </div>
      `;
    },

    initMasonry() {
      const grid = document.getElementById('rit-detail-grid');
      if (!grid) return;
      let cols = window.innerWidth >= 1024 ? 4 : (window.innerWidth >= 768 ? 3 : 2);
      if (this.listOrder.length < cols) cols = this.listOrder.length;
      const columnDOMs = Array.from({ length: cols }, () => []);
      this.listOrder.forEach((id, i) => columnDOMs[i % cols].push(this.getCardHTML(id)));
      grid.innerHTML = columnDOMs.map(col => `<div class="rit-masonry-column">${col.join('')}</div>`).join('');
    },

    initSwiper() {
      const wrapper = document.querySelector('.rit-detail-swiper .swiper-wrapper');
      if (!wrapper) return;
      wrapper.innerHTML = this.listOrder.map(id => `<div class="swiper-slide" style="width:260px; height:auto;">${this.getCardHTML(id)}</div>`).join('');
      if (typeof Swiper !== 'undefined') new Swiper('.rit-detail-swiper', { slidesPerView: 'auto', spaceBetween: 16, freeMode: true, grabCursor: true });
    },

    // ==========================================
    // 💡 [독립 모달 레이어 구현부]
    // ==========================================
    initModal() {
      if (document.getElementById('ritDtlModal')) return;
      const m = document.createElement('div');
      m.id = 'ritDtlModal';
      m.className = 'rit-dtl-modal-container';
      m.style.display = 'none';
      m.innerHTML = `
        <div class="rit-dtl-modal-bg" onclick="ReviewDetailApp.closeModal()"></div>
        <button class="rit-dtl-nav-btn rit-dtl-prev" onclick="ReviewDetailApp.navigateReview(-1)">&#10094;</button>
        <button class="rit-dtl-nav-btn rit-dtl-next" onclick="ReviewDetailApp.navigateReview(1)">&#10095;</button>
        <div class="rit-dtl-modal-window">
          <div class="rit-dtl-modal-header">
              <span class="rit-dtl-logo">${CONFIG.mallName}</span>
              <button onclick="ReviewDetailApp.closeModal()" class="rit-dtl-close">✕</button>
          </div>
          <div class="rit-dtl-modal-body">
              <div class="rit-dtl-flex-container">
                <div id="ritDtlModalImg" class="rit-dtl-img-side"></div>
                <div class="rit-dtl-txt-side">
                  <div id="ritDtlMetaArea"></div>
                  <h3 id="ritDtlSubject" class="rit-dtl-subject"></h3>
                  <div id="ritDtlContent" class="rit-dtl-body-text"></div>
                  <div id="ritDtlCommList"></div>
                </div>
              </div>
          </div>
        </div>
      `;
      document.body.appendChild(m);
    },

    openModal(id) {
      this.currentScrollY = window.pageYOffset;
      document.getElementById('ritDtlModal').style.display = 'flex';
      document.body.style.cssText = `position:fixed; top:-${this.currentScrollY}px; width:100%; overflow:hidden;`;
      this.renderDetail(id);
    },

    closeModal() {
      document.getElementById('ritDtlModal').style.display = 'none';
      document.body.style.cssText = "";
      window.scrollTo(0, this.currentScrollY);
    },

    navigateReview(direction) {
      const currentIndex = this.listOrder.indexOf(this.currentReviewId);
      if (currentIndex === -1) return;
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = this.listOrder.length - 1;
      if (nextIndex >= this.listOrder.length) nextIndex = 0;
      this.renderDetail(this.listOrder[nextIndex]);
    },

    async renderDetail(id) {
      this.currentReviewId = id;
      const d = this.data[id];
      const imgSide = document.getElementById('ritDtlModalImg');
      const contentSide = document.getElementById('ritDtlContent');

      const rawName = (d.author_name ? d.author_name : (d.writer || '고객')).trim();
      const isMallOwner = CONFIG.adminKeywords.some(k => rawName.toLowerCase().includes(k.toLowerCase())) || rawName.includes(CONFIG.mallName);
      const displayName = isMallOwner ? rawName : this.maskName(rawName);

      const validImages = d.all_images.filter(img => img && !img.includes('rit_noimg.jpg'));

      if (validImages.length > 0) {
        const swiperControls = validImages.length > 1 ? `<div class="rit-dtl-fraction"></div><div class="swiper-button-next"></div><div class="swiper-button-prev"></div>` : '';
        imgSide.innerHTML = `
          <div class="swiper rit-dtl-modal-swiper" style="width:100%; height:100%;">
            <div class="swiper-wrapper">
              ${validImages.map(img => `
                <div class="swiper-slide" style="position:relative; background:#000; display:flex; align-items:center; justify-content:center; width:100%;">
                  <div style="position:absolute; inset:-20px; background-image:url('${img}'); background-size:cover; filter:blur(20px); opacity:0.4;"></div>
                  <img src="${img}" onerror="this.src='${CONFIG.defaultImg}'" style="position:relative; max-width:100%; max-height:100%; object-fit:contain; z-index:1;">
                </div>`).join('')}
            </div>
            ${swiperControls}
          </div>`;

        if (window.Swiper) {
          if (window.ritDtlActiveSwiper) window.ritDtlActiveSwiper.destroy(false, false);
          setTimeout(() => {
            window.ritDtlActiveSwiper = new Swiper('.rit-dtl-modal-swiper', {
              pagination: validImages.length > 1 ? { el: '.rit-dtl-fraction', type: 'fraction' } : false,
              navigation: validImages.length > 1 ? { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' } : false,
              loop: validImages.length > 1, observer: true, observeParents: true
            });
          }, 50);
        }
      } else {
        imgSide.innerHTML = `<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#555; background:#111;">No Image</div>`;
      }

      let fDate = d.original_date || (d.created_at ? d.created_at.split('T')[0] : '');
      document.getElementById('ritDtlMetaArea').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
          <div><span style="font-weight:800; font-size:14px;">${displayName}</span> <span style="color:#aaa; font-size:12px; margin-left:8px;">${fDate.replace(/-/g, '.')}</span></div>
          <div style="color:#f59e0b; font-size:14px; letter-spacing:2px;">${'★'.repeat(d.stars || 5)}</div>
        </div>`;
      document.getElementById('ritDtlSubject').innerText = d.subject;
      contentSide.innerHTML = d.clean_text_body || "본문 내용이 없습니다.";
      this.loadComments(d.article_no, d.board_no);
    },

    async loadComments(articleNo, boardNo) {
      const commContainer = document.getElementById('ritDtlCommList');
      if (!commContainer) return;
      commContainer.innerHTML = '<div style="padding:15px; text-align:center; font-size:12px; color:#999; border-top:1px solid #eee; margin-top:20px;">댓글 확인 중...</div>';
      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const commentRows = doc.querySelectorAll('.xans-board-commentlist li, .boardComment li, .commentList li');

        const comments = Array.from(commentRows).map(el => {
          let writer = (el.querySelector('.name, .writer')?.innerText || "고객").trim();
          let isOfficial = CONFIG.adminKeywords.some(k => writer.includes(k)) || writer.includes(CONFIG.mallName);
          const content = (el.querySelector('.comment, .content')?.innerText || "").trim();
          const date = (el.querySelector('.date')?.innerText || "").trim();
          return { writer: isOfficial ? writer : this.maskName(writer), content, date, isOfficial };
        }).filter(c => c.content && !c.content.includes('비밀번호'));

        if (comments.length === 0) {
          commContainer.innerHTML = `<div style="margin-top:20px; padding:20px; text-align:center; border-top:1px solid #eee; font-size:12px; color:#bbb;">담당자가 확인 중입니다 :)</div>`;
          return;
        }

        commContainer.innerHTML = `<div style="margin-top:25px; border-top:1px solid #eee; padding-top:15px; font-weight:800; font-size:12px;">Comments (${comments.length})</div>` +
          comments.map(c => `
          <div style="margin-top:10px; padding:12px; border-radius:8px; font-size:12px; background:${c.isOfficial ? '#f0f4f8' : '#f9f9f9'};">
            <div style="font-weight:700; display:flex; justify-content:space-between; margin-bottom:5px;">
              <span>${c.writer} ${c.isOfficial ? '<span style="color:#3b82f6;">✓</span>' : ''}</span>
              <span style="color:#aaa; font-weight:400;">${c.date}</span>
            </div>
            <div style="color:#444; line-height:1.4;">${c.content}</div>
          </div>`).join('');
      } catch (e) { commContainer.innerHTML = ''; }
    },

    injectCSS() {
      if (document.getElementById('rit-detail-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-detail-css';
      style.innerHTML = `
        .cboth { clear: both !important; display: block !important; }
        .rit-detail-thumb-wrap, .rit-oy-summary-wrap, .rit-detail-container { font-size: 13px !important; line-height: normal !important; box-sizing: border-box !important; }
        .rit-detail-header { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-bottom: 20px !important; }
        .rit-detail-title { font-size: 20px !important; font-weight: 800 !important; color: #111 !important; margin: 0 !important; }

        .rit-detail-thumb-wrap { margin: 25px 0 20px !important; padding-top: 15px !important; border-top: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-detail-thumb-header { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-bottom: 10px !important; }
        .rit-detail-thumb-title { font-size: 14px !important; font-weight: 800 !important; color: #111 !important; }
        .rit-detail-count { color: #94a3b8 !important; font-weight: 500 !important; font-size: 12px !important; }
        .rit-detail-thumb-view-all { font-size: 12px !important; color: #64748b !important; cursor: pointer !important; text-decoration: underline !important; text-underline-offset: 3px !important; }
        .rit-detail-thumb-list { display: flex !important; gap: 8px !important; width: 100% !important; overflow: hidden !important; justify-content: flex-start !important; }
        .rit-detail-thumb-item { position: relative !important; width: calc(20% - 6.4px) !important; max-width: 72px !important; aspect-ratio: 1/1 !important; border-radius: 6px !important; overflow: hidden !important; background: #f8fafc !important; cursor: pointer !important; border: 1px solid #e2e8f0 !important; flex-shrink: 0 !important; }
        .rit-detail-thumb-item img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }
        .rit-detail-thumb-more { position: absolute !important; inset: 0 !important; background: rgba(0,0,0,0.55) !important; color: #fff !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; }
        .rit-detail-thumb-more span { font-size: 12px !important; font-weight: 700 !important; line-height: 1.2 !important; }
        .rit-detail-dummy-item { background: #f8fafc !important; border: 1px dashed #cbd5e1 !important; }
        .rit-detail-dummy-item img { opacity: 0.1 !important; filter: grayscale(100%) !important; }
        .rit-detail-dummy-text { position: absolute !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; font-size: 10px !important; font-weight: 700 !important; color: #64748b !important; line-height: 1.3 !important; }

        .rit-oy-summary-wrap { margin: 15px 0 !important; padding: 12px 16px !important; background: #f8fafc !important; border-radius: 8px !important; cursor: pointer !important; border: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-oy-content { display: flex !important; justify-content: space-between !important; align-items: center !important; }
        .rit-oy-left { display: flex !important; align-items: center !important; gap: 8px !important; }
        .rit-oy-star { font-size: 14px !important; font-weight: 800 !important; color: #18181b !important; }
        .rit-oy-count { font-size: 12px !important; color: #71717a !important; border-left: 1px solid #e4e4e7 !important; padding-left: 8px !important; }
        .rit-oy-avatars { display: flex !important; align-items: center !important; }
        .rit-oy-avatar { width: 24px !important; height: 24px !important; border-radius: 50% !important; object-fit: cover !important; border: 1.5px solid #ff425c !important; margin-left: -8px !important; position: relative !important; z-index: 2 !important; }
        .rit-oy-avatar:first-child { margin-left: 0 !important; z-index: 3 !important; }
        .rit-oy-avatar-more { width: 24px !important; height: 24px !important; border-radius: 50% !important; background: #e4e4e7 !important; color: #52525b !important; font-size: 10px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; margin-left: -8px !important; border: 1.5px solid #fff !important; }

        .rit-detail-container { width: 100% !important; max-width: 1600px !important; margin: 30px auto 60px !important; padding: 0 16px !important; }
        .rit-empty-state { background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%) !important; border: 1px dashed #cbd5e1 !important; border-radius: 12px !important; padding: 60px 20px !important; text-align: center !important; width: 100% !important; }
        .rit-empty-icon { font-size: 40px !important; margin-bottom: 15px !important; animation: bounce 2s infinite !important; }
        .rit-empty-title { font-size: 18px !important; font-weight: 800 !important; color: #1e293b !important; margin-bottom: 10px !important; }
        .rit-empty-desc { font-size: 14px !important; color: #64748b !important; line-height: 1.6 !important; margin-bottom: 25px !important; }
        .rit-btn-write { display: inline-block !important; background: #18181b !important; color: #fff !important; padding: 14px 28px !important; border-radius: 8px !important; font-weight: 700 !important; font-size: 14px !important; text-decoration: none !important; }

        .rit-dashboard-card { background: #fff !important; border: 1px solid #f0f0f0 !important; border-radius: 12px !important; padding: 24px !important; display: flex !important; flex-direction: column !important; gap: 20px !important; width: 100% !important; margin-bottom: 20px !important;}
        @media (min-width: 768px) { .rit-dashboard-card { flex-direction: row !important; align-items: center !important; justify-content: space-between !important; } }
        .rit-dash-left { display: flex !important; gap: 15px !important; flex: 1 !important; }
        .rit-dash-score-box { display: flex !important; align-items: center !important; gap: 15px !important; }
        .rit-dash-big-score { font-size: 36px !important; font-weight: 800 !important; color: #111 !important; line-height: 1 !important; }
        .rit-dash-count-text { font-size: 12px !important; color: #666 !important; font-weight: 500 !important; }
        .rit-dash-gauge-box { flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 6px !important; }
        @media (min-width: 768px) { .rit-dash-gauge-box { border-left: 1px solid #f3f3f3 !important; padding-left: 24px !important; } }
        .rit-gauge-row { display: flex !important; align-items: center !important; gap: 10px !important; font-size: 11px !important; color: #888 !important; }
        .rit-gauge-label { width: 24px !important; font-weight: 600 !important; color: #52525b !important; }
        .rit-gauge-bg { flex: 1 !important; height: 8px !important; background: #f1f5f9 !important; border-radius: 4px !important; overflow: hidden !important; }
        .rit-gauge-fill { height: 100% !important; background: #f59e0b !important; border-radius: 4px !important; }
        .rit-gauge-percent { width: 28px !important; text-align: right !important; font-weight: 600 !important; }
        
        .rit-masonry-grid { display: flex !important; flex-direction: row !important; align-items: flex-start !important; gap: 16px !important; width: 100% !important; margin-top: 20px !important; }
        .rit-masonry-column { display: flex !important; flex-direction: column !important; flex: 1 !important; min-width: 0 !important; gap: 16px !important; }
        .rit-masonry-item { background: #fff !important; border: 1px solid #f0f0f0 !important; border-radius: 12px !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; transition: transform 0.2s; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100% !important; height: auto !important; display: block !important; object-fit: cover !important; }
        .rit-masonry-info { padding: 15px !important; display: flex !important; flex-direction: column !important; }
        .rit-masonry-subject { font-size: 13px !important; font-weight: 700 !important; color: #111 !important; margin-bottom: 6px !important; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;}
        .rit-masonry-desc { font-size: 12px !important; color: #666 !important; line-height: 1.5 !important; margin-bottom: 12px !important; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
        .rit-masonry-meta { display: flex !important; justify-content: space-between !important; font-size: 11px !important; border-top: 1px solid #eee !important; padding-top: 10px !important; margin-top: auto !important; }
        
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

        /* 💡 독립된 팝업 모달 CSS (메인 위젯과 100% 분리) */
        .rit-dtl-modal-container { position:fixed; inset:0; z-index:999999; display:flex; align-items:center; justify-content:center; }
        .rit-dtl-modal-bg { position:absolute; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); }
        .rit-dtl-modal-window { position:relative; width:90%; max-width:900px; height:85vh; background:#fff; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; z-index:2; box-shadow:0 10px 40px rgba(0,0,0,0.3); }
        .rit-dtl-modal-header { padding:15px 20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; background:#fff; z-index:10; }
        .rit-dtl-logo { font-weight:900; font-size:16px; color:#111; letter-spacing:-0.5px; }
        .rit-dtl-close { background:none; border:none; font-size:20px; cursor:pointer; color:#666; }
        .rit-dtl-modal-body { flex:1; overflow:hidden; display:flex; }
        .rit-dtl-flex-container { display:flex; width:100%; height:100%; flex-direction:column; }
        .rit-dtl-img-side { flex:1.2; background:#000; position:relative; overflow:hidden; }
        .rit-dtl-txt-side { flex:1; background:#fff; padding:30px; overflow-y:auto; display:flex; flex-direction:column; }
        .rit-dtl-subject { font-size:18px; font-weight:800; color:#111; margin-bottom:15px; line-height:1.4; word-break:keep-all; }
        .rit-dtl-body-text { font-size:14px; color:#444; line-height:1.6; word-break:keep-all; }
        .rit-dtl-nav-btn { position:fixed; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:60px; cursor:pointer; color:#fff; z-index:9999999; text-shadow:0 4px 10px rgba(0,0,0,0.4); }
        .rit-dtl-prev { left:2%; } .rit-dtl-next { right:2%; }

        @media (min-width: 768px) {
          .rit-dtl-flex-container { flex-direction:row; }
          .rit-dtl-modal-window { overflow:visible !important; }
          .rit-dtl-modal-header { position:absolute !important; top:-50px !important; left:0; right:0; background:transparent !important; border:none !important; }
          .rit-dtl-logo { color:#fff !important; font-size:14px !important; }
          .rit-dtl-close { color:#fff !important; }
        }
        @media (max-width: 767px) {
          .rit-dtl-img-side { height:40vh; flex:none; }
          .rit-dtl-nav-btn { font-size:40px; }
          .rit-dtl-prev { left:1%; } .rit-dtl-next { right:1%; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  window.ReviewDetailApp = ReviewDetailApp;
  ReviewDetailApp.init();
})();