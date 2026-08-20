/**
 * @Project: Review-It Detail Engine (Production Master v1.9.5 - Final Sync)
 * @Feature: Thumbnail CSS Restored, Pre-parsing Images for Grid/Thumb Sync
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Production Engine Master Loaded!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

  // 기존 위젯 클린업
  document.querySelectorAll('.rit-oy-summary-wrap, .rit-thumb-wrap, .rit-detail-container, #ritDtlModal').forEach(el => el.remove());

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
    isFallbackDemo: false,

    async init() {
      this.injectCSS();
      this.hideDefaultReviews();
      if (!productNo) return;

      await this.loadSettings();
      await this.loadReviewsAndParse();

      this.initModal();

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
        this.settings = { detail_display_type: 'grid', is_detail_summary_enabled: true, is_detail_gallery_enabled: true, is_detail_main_enabled: true };
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

    async _fetchAndSeparateContent(articleNo, boardNo = '4') {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const readArea = doc.querySelector('.xans-board-read-4, .xans-board-read, #board_read');
        let extractedDate = null, extractedWriter = null, extractedSubject = null;

        if (readArea) {
          const titleEl = readArea.querySelector('.head h3, .head h2, .title h3, .title h2, .title p, .boardView .title, td.subject');
          if (titleEl) {
            let tempTitle = titleEl.innerText.replace(/^제목\s*:?\s*/i, '').trim();
            extractedSubject = tempTitle.split('\n')[0].replace(/\s+/g, ' ').trim();
          }

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

        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail');
        const extractedImages = [];
        const uniqueSet = new Set();

        const processImage = (src, elToRemove = null) => {
          if (!src || CONFIG.spamKeywords.test(src) || src.includes('.gif') || src.includes('blank')) {
            if (elToRemove) elToRemove.remove();
            return;
          }
          let finalSrc = src.replace(/\/(tiny|small|medium)\//gi, '/big/');
          finalSrc = finalSrc.startsWith('//') ? 'https:' + finalSrc : (finalSrc.startsWith('/') ? window.location.origin + finalSrc : finalSrc);
          if (!uniqueSet.has(finalSrc)) { uniqueSet.add(finalSrc); extractedImages.push(finalSrc); }
          if (elToRemove) elToRemove.remove();
        };

        if (contentArea) {
          contentArea.querySelectorAll('img').forEach(img => processImage(img.getAttribute('src'), img));
          contentArea.querySelectorAll('div[style*="background-image"]').forEach(div => {
            const match = div.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
            if (match && match[1]) {
              processImage(match[1]);
              div.style.backgroundImage = 'none';
            }
          });
        }

        let cleanText = contentArea ? contentArea.innerHTML.trim() : "";
        if (cleanText === "" && extractedImages.length > 0) cleanText = "포토 리뷰입니다.";

        return { images: extractedImages, text: cleanText, date: extractedDate, writer: extractedWriter, subject: extractedSubject };
      } catch (e) { return null; }
    },

    async loadReviewsAndParse() {
      try {
        const baseUrl = `${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true`;
        let res = await fetch(`${baseUrl}&product_no=eq.${productNo}&order=created_at.desc`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
        let list = await res.json();

        if (!list || list.length === 0) {
          this.isFallbackDemo = true;
          const fbRes = await fetch(`${baseUrl}&order=created_at.desc&limit=15`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
          list = await fbRes.json();
        }

        this.data = {};
        this.listOrder = [];
        this.photoReviews = [];

        // 💡 [핵심 픽스] 리스트/메인 위젯처럼 렌더링 전 사전 파싱(Pre-parsing)을 수행하여 이미지 유실 원천 차단
        await Promise.all(list.slice(0, 15).map(async (r) => {
          const scraped = await this._fetchAndSeparateContent(r.article_no, r.board_no);
          if (scraped) {
            r.clean_text_body = scraped.text || r.content || "리뷰 본문이 없습니다.";
            r.all_images = (scraped.images && scraped.images.length > 0) ? scraped.images : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg]);
            if (scraped.date) r.original_date = scraped.date;
            if (scraped.writer) r.author_name = scraped.writer;
            if (scraped.subject) r.subject = scraped.subject;
          } else {
            r.clean_text_body = r.content || "리뷰 본문이 없습니다.";
            r.all_images = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [CONFIG.defaultImg];
          }
          r.is_parsed = true;

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
      galleryContainer.className = 'rit-thumb-wrap cboth';
      let photosHtml = '';
      const realPhotos = this.isFallbackDemo ? 0 : this.photoReviews.length;

      const writeUrl = productNo ? `/board/product/write.html?board_no=4&product_no=${productNo}` : `/board/product/write.html?board_no=4`;

      if (this.isFallbackDemo || realPhotos === 0) {
        const dummyArr = [1, 2, 3, 4, 5];
        photosHtml = dummyArr.map((num, index) => `
          <div class="rit-thumb-item rit-dummy-item" onclick="window.location.href='${writeUrl}'">
            <img src="${CONFIG.defaultImg}" alt="sample">
            ${index === 2 ? `<div class="rit-dummy-text">첫 포토 리뷰를<br>기다려요!</div>` : ''}
          </div>
        `).join('');
      } else {
        const photos = this.photoReviews.slice(0, 5);
        const hasMore = realPhotos > 5;
        photosHtml = photos.map((r, index) => {
          const isLast = index === 4;
          return `
            <div class="rit-thumb-item" onclick="if(window.ReviewDetailApp) window.ReviewDetailApp.openModal('${r.id}')">
              <img src="${r.all_images[0]}" alt="review" onerror="this.src='${CONFIG.defaultImg}'">
              ${isLast && hasMore ? `<div class="rit-thumb-more"><span>${realPhotos}<br>더보기</span></div>` : ''}
            </div>
          `;
        }).join('');
      }

      galleryContainer.innerHTML = `
        <div class="rit-thumb-header">
          <span class="rit-thumb-title">포토리뷰 <span class="rit-count">(${realPhotos}건)</span></span>
          <span class="rit-thumb-view-all" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">전체보기</span>
        </div>
        <div class="rit-thumb-list">${photosHtml}</div>
      `;
      targetEl.parentNode.insertBefore(galleryContainer, targetEl.nextSibling);
    },

    renderMainDetailBoard() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-detail-container cboth';

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

      const writeUrl = productNo ? `/board/product/write.html?board_no=4&product_no=${productNo}` : `/board/product/write.html?board_no=4`;

      const dashboardHtml = `
        <div class="rit-dashboard-card" style="margin-top:20px;">
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
        contentHtml += `
          <div class="rit-empty-state" style="margin-bottom: 50px;">
            <div class="rit-empty-icon">✨</div>
            <h3 class="rit-empty-title">이 상품의 첫 번째 리뷰어가 되어주세요!</h3>
            <p class="rit-empty-desc">아직 작성된 리뷰가 없습니다.<br>지금 첫 포토 리뷰를 남겨주시면 <strong>특별한 혜택</strong>을 드립니다!</p>
            <a href="${writeUrl}" class="rit-btn-write">첫 리뷰 작성하고 혜택 받기</a>
          </div>
          <div class="rit-header-area" style="text-align:left; margin-bottom:20px;">
            <h2 class="rit-main-title" style="margin:0; font-size:20px;">다른 고객들의 베스트 리뷰</h2>
            <p class="rit-desc" style="font-size:13px; color:#71717a; margin-top:5px;">현재 상품의 리뷰를 기다리는 동안, 다른 구매자들의 생생한 후기를 먼저 확인해보세요!</p>
          </div>
        `;
      }

      const isSwiper = this.settings.detail_display_type === 'swiper';
      contentHtml += `<div id="rit-main-grid" class="${isSwiper ? 'swiper rit-main-swiper' : 'rit-main-grid-layout'}">${isSwiper ? '<div class="swiper-wrapper"></div>' : ''}</div>`;

      container.innerHTML = `
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
      const thumb = d.all_images[0] || CONFIG.defaultImg;
      const rawName = (d.author_name ? d.author_name : (d.writer || '고객')).trim();

      const isMallOwner = (CONFIG.mallName && (rawName === CONFIG.mallName.trim() || rawName.includes(CONFIG.mallName))) || CONFIG.adminKeywords.some(k => rawName.toLowerCase().includes(k.toLowerCase()));
      const displayName = isMallOwner ? rawName : this.maskName(rawName);
      const avgScore = d.stars || 5;

      const rawDate = d.original_date ? d.original_date : (d.created_at ? d.created_at.split('T')[0] : '');
      let formattedDate = rawDate;
      if (rawDate) {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj)) {
          const yy = String(dateObj.getFullYear()).slice(-2);
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${yy}.${mm}.${dd} 작성`;
        }
      }

      const verifiedBadgeHtml = !isMallOwner ? `
      <span style="position: absolute; right: 8px; bottom: 8px; background: rgba(255,255,255,0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: #3f3f46; padding: 4px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: -0.5px; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">구매 인증</span>
      ` : '';

      const actualProductName = '상품 보기';
      const actualProductImg = d.product_img || thumb;
      const productLink = productNo ? `/product/detail.html?product_no=${productNo}` : '';

      const productChipHtml = `
        <div class="rit-product-chip" 
             ${productLink ? `onclick="event.stopPropagation(); window.location.href='${productLink}';"` : ''} 
             onmouseover="this.style.background='#f1f5f9'" 
             onmouseout="this.style.background='#f8fafc'"
             style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 6px 10px; border-radius: 6px; margin-bottom: 12px; transition: background 0.2s; cursor: pointer;">
          <img src="${actualProductImg}" style="width: 22px; height: 22px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" alt="product" onerror="this.src='${CONFIG.defaultImg}'">
          <span style="font-size: 11px; color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${actualProductName}</span>
        </div>
      `;

      return `
      <div class="rit-card" onclick="if(window.ReviewDetailApp) window.ReviewDetailApp.openModal('${id}')" style="position: relative; overflow: hidden; display: flex; flex-direction: column; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background:#fff; height: 100%; aspect-ratio: auto !important; cursor:pointer;">
        <div class="rit-card-img-container" style="position: relative; width: 100%; aspect-ratio: 1/1; flex-shrink: 0; display: flex; align-items: center; justify-content: center; z-index: 2; overflow: hidden; background: rgba(0,0,0,0.02);">
          <img src="${thumb}" class="rit-card-img" loading="lazy" 
              onerror="this.onerror=null; this.src='${CONFIG.defaultImg}';"
              style="max-width: 100%; max-height: 100%; object-fit: cover; width: 100%; height: 100%; transition: transform 0.3s ease;">
          ${verifiedBadgeHtml}
        </div>
        
        <div class="rit-card-info" style="position: relative; z-index: 3; background: #fff; padding: 16px 14px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:5px; margin-bottom:8px; font-size:11px; font-weight:700; color:#52525b;">
             <span style="color:#fbbf24;">★</span>
             <span>${Number(avgScore).toFixed(1)}</span>
          </div>
          <div class="rit-card-subject line-clamp-2 break-keep" style="font-size: 13px; line-height: 1.4; height: 2.8em; color: #222; margin-bottom: 12px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${d.subject || d.clean_text_body || ''}</div>
          ${productChipHtml}
          <div class="rit-card-meta" style="border-top: 1px solid #f4f4f5; padding-top: 10px; margin-top: auto;">
            <div style="display: flex; align-items: center; gap: 6px; width: 100%; overflow: hidden;">
              <span style="font-size: 11px; color: #71717a; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">${displayName}</span>
              <span style="font-size: 10px; color: #e4e4e7; flex-shrink: 0;">|</span>
              <span style="font-size: 11px; color: #a1a1aa; flex-shrink: 0; white-space: nowrap;">${formattedDate}</span>
            </div>
          </div>
        </div>
      </div>`;
    },

    initMasonry() {
      const grid = document.getElementById('rit-main-grid');
      if (!grid) return;

      const pcCols = 5;
      const moCols = 2;
      grid.style.setProperty('--pc-cols', pcCols);
      grid.style.setProperty('--mo-cols', moCols);

      grid.innerHTML = this.listOrder.map(id => this.getCardHTML(id)).join('');
    },

    initSwiper() {
      const wrapper = document.querySelector('.rit-main-swiper .swiper-wrapper');
      if (!wrapper) return;
      wrapper.innerHTML = this.listOrder.map(id => `<div class="swiper-slide">${this.getCardHTML(id)}</div>`).join('');
      if (typeof Swiper !== 'undefined') new Swiper('.rit-main-swiper', { slidesPerView: 'auto', spaceBetween: 16, freeMode: true, grabCursor: true });
    },

    initModal() {
      let modalContainer = document.getElementById('ritDtlModal');
      if (modalContainer) return;

      modalContainer = document.createElement('div');
      modalContainer.id = 'ritDtlModal';
      modalContainer.className = 'rit-modal-container';
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = `
      <div class="rit-modal-bg" onclick="ReviewDetailApp.closeModal()"></div>
      
      <button class="rit-nav-btn rit-nav-prev" onclick="ReviewDetailApp.navigateReview(-1)" style="position:fixed; left:3%; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:60px; cursor:pointer; color:#fff; z-index:9999; text-shadow: 0 4px 10px rgba(0,0,0,0.4);">&#10094;</button>
      <button class="rit-nav-btn rit-nav-next" onclick="ReviewDetailApp.navigateReview(1)" style="position:fixed; right:3%; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:60px; cursor:pointer; color:#fff; z-index:9999; text-shadow: 0 4px 10px rgba(0,0,0,0.4);">&#10095;</button>

      <div class="rit-modal-window">
        <div class="rit-modal-header">
            <span class="rit-logo-text">${CONFIG.mallName}</span>
            <div class="rit-header-buttons">
              <button onclick="ReviewDetailApp.closeModal()" class="btn-rit-close">✕</button>
            </div>
        </div>
        <div class="rit-modal-body">
            <div id="ritDtlDetailView" class="rit-flex-container">
              <div id="ritDtlModalImg" class="rit-img-side"></div>
              <div class="rit-txt-side">
                <div id="ritDtlMetaArea"></div>
                <h3 id="ritDtlSubject" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; word-break: keep-all; margin-bottom: 15px;"></h3>
                <div id="ritDtlContent" class="rit-body-text"></div>
                <div id="ritDtlCommList"></div>
              </div>
            </div>
        </div>
      </div>
      `;
      document.body.appendChild(modalContainer);
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
      const subjectSide = document.getElementById('ritDtlSubject');

      const rawDisplayName = (d.author_name ? d.author_name : (d.writer || '고객')).trim();
      const isMallOwner = CONFIG.mallName && (rawDisplayName === CONFIG.mallName.trim() || CONFIG.mallName.includes(rawDisplayName));
      const updatedDisplayName = isMallOwner ? rawDisplayName : this.maskName(rawDisplayName);

      contentSide.innerHTML = '<div class="rit-loading">리뷰를 불러오는 중입니다...</div>';

      const validImages = d.all_images.filter(img => img && !img.includes('rit_noimg.jpg'));

      if (validImages.length > 0) {
        const swiperControls = validImages.length > 1 ? `
          <div class="rit-fraction"></div>
          <div class="swiper-button-next"></div><div class="swiper-button-prev"></div>
        ` : '';

        imgSide.innerHTML = `
      <div class="swiper rit-modal-swiper" style="width:100%; height:100%;">
        <div class="swiper-wrapper">
          ${validImages.map(img => `
            <div class="swiper-slide" style="position: relative; overflow: hidden; background: #000; display:flex; align-items:center; justify-content:center; width: 100% !important; box-sizing: border-box;">
              <div style="position: absolute; inset: -20px; background-image: url('${img}'); background-size: cover; background-position: center; filter: blur(20px); opacity: 0.4; pointer-events: none;"></div>
              <img src="${img}" alt="review" 
                   onerror="this.onerror=null; document.getElementById('ritDtlModalImg').innerHTML = \`<div class='rit-no-image'><span>REVIEW-IT</span></div>\`;"
                   style="position: relative; max-width: 100%; max-height: 100%; object-fit: contain; z-index: 1;">
            </div>
          `).join('')}
        </div>
        ${swiperControls}
      </div>`;

        if (window.Swiper) {
          if (window.ritDtlActiveModalSwiper) window.ritDtlActiveModalSwiper.destroy(false, false);
          setTimeout(() => {
            window.ritDtlActiveModalSwiper = new Swiper('.rit-modal-swiper', {
              pagination: validImages.length > 1 ? { el: '.rit-fraction', type: 'fraction' } : false,
              navigation: validImages.length > 1 ? { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' } : false,
              centeredSlides: true, loop: validImages.length > 1, observer: true, observeParents: true
            });
          }, 50);
        }
      } else {
        imgSide.innerHTML = `<div class="rit-no-image"><span>REVIEW-IT</span></div>`;
      }

      const displayDate = d.original_date ? d.original_date : (d.created_at ? d.created_at.split('T')[0] : '');

      document.getElementById('ritDtlMetaArea').innerHTML = `
        <div class="rit-meta-container">
          <div class="rit-meta-top">
            <span class="rit-author">${updatedDisplayName}</span> 
            <span class="rit-date">${displayDate.replace(/-/g, '.')}</span>
            <div class="rit-stars-gold"><img src="${CONFIG.starPath}${d.stars || 5}.svg" class="rit-star-img"></div>
          </div>
        </div>`;

      subjectSide.innerText = d.subject || '';
      contentSide.innerHTML = this.cleanEditorText(d.clean_text_body || "본문 내용이 없습니다.");

      this.loadComments(d.article_no, d.board_no);
    },

    async loadComments(articleNo, boardNo) {
      const commContainer = document.getElementById('ritDtlCommList');
      if (!commContainer) return;
      commContainer.innerHTML = '<div style="padding:15px; text-align:center; font-size:12px; color:#999; border-top:1px solid #eee; margin-top:20px;">댓글 연결 중...</div>';

      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const commentRows = doc.querySelectorAll('.xans-board-commentlist li, .boardComment li, .commentList li, .replyArea li, [class*="comment"] li');

        const comments = Array.from(commentRows).map(el => {
          let writer = (el.querySelector('.name, .writer, strong')?.innerText || "고객").trim();
          let isOfficial = false;

          const isAdminBadge = el.querySelector('img[src*="admin"], img[src*="staff"]');
          if (isAdminBadge || CONFIG.adminKeywords.some(k => writer.includes(k)) || writer.includes(CONFIG.mallName)) {
            isOfficial = true;
          } else {
            writer = this.maskName(writer);
          }

          const content = (el.querySelector('.comment, .content, span[id^="comment_"]')?.innerText || "").trim();
          const date = (el.querySelector('.date')?.innerText || "").trim();
          return { writer, content, date, isOfficial };
        }).filter(c => c.content.length > 0 && !c.content.includes('비밀번호'));

        this.renderComments(comments);
      } catch (e) { commContainer.innerHTML = ''; }
    },

    renderComments(comments) {
      const container = document.getElementById('ritDtlCommList');
      if (!container) return;

      const headerHtml = `
        <div class="rit-comm-head" style="margin-top:25px; border-top:1px solid #eee; padding-top:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#111; margin:0;">Comments <span style="color:#999; font-weight:normal;">(${comments.length})</span></h4>
        </div>
      `;

      if (comments.length === 0) {
        container.innerHTML = headerHtml + `
        <div class="rit-no-comm" style="margin-top:10px; padding:20px; text-align:center;">
          <p style="font-size:12px; color:#bbb; font-weight:400; margin:0; letter-spacing:-0.5px;">
            운영자가 소식 확인 중입니다.<br>정성스러운 답변으로 곧 찾아뵐게요!
          </p>
        </div>`;
        return;
      }

      container.innerHTML = headerHtml + comments.map(c => {
        const fontColor = c.isOfficial ? '#000' : '#111';
        const bgStyle = c.isOfficial ? 'background:#f0f4f8; border:1px solid #e2e8f0;' : 'background:#f9f9f9; border:1px solid transparent;';

        return `
        <div class="rit-comm-item" style="margin-bottom:10px; ${bgStyle} padding:14px; border-radius:10px; font-size:12px;">
          <div style="font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:${fontColor};">${c.writer} ${c.isOfficial ? '<span style="color:#3b82f6; margin-left:2px;">✓</span>' : ''}</span>
            <span style="font-weight:400; color:#bbb; font-size:11px;">${c.date}</span>
          </div>
          <div style="color:#444; font-weight:400; line-height:1.5;">${c.content}</div>
        </div>
      `;
      }).join('');
    },

    injectCSS() {
      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }

      if (document.getElementById('rit-dtl-sub-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-dtl-sub-css';

      // 💡 [핵심 픽스] 상단 썸네일 전용 CSS 완전 복구 삽입!
      style.innerHTML = `
        .cboth { clear: both !important; display: block !important; }
        
        .rit-thumb-wrap, .rit-oy-summary-wrap, .rit-detail-container { font-family: 'Pretendard', sans-serif !important; font-size: 13px !important; box-sizing: border-box !important; }
        
        /* Thumbnail CSS Restore */
        .rit-thumb-wrap { margin: 25px 0 20px !important; padding-top: 15px !important; border-top: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-thumb-header { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-bottom: 10px !important; }
        .rit-thumb-title { font-size: 14px !important; font-weight: 800 !important; color: #111 !important; }
        .rit-count { color: #94a3b8 !important; font-weight: 500 !important; font-size: 12px !important; }
        .rit-thumb-view-all { font-size: 12px !important; color: #64748b !important; cursor: pointer !important; text-decoration: underline !important; text-underline-offset: 3px !important; }
        .rit-thumb-list { display: flex !important; gap: 8px !important; width: 100% !important; overflow: hidden !important; justify-content: flex-start !important; }
        .rit-thumb-item { position: relative !important; width: calc(20% - 6.4px) !important; max-width: 72px !important; aspect-ratio: 1/1 !important; border-radius: 6px !important; overflow: hidden !important; background: #f8fafc !important; cursor: pointer !important; border: 1px solid #e2e8f0 !important; flex-shrink: 0 !important; }
        .rit-thumb-item img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }
        .rit-thumb-more { position: absolute !important; inset: 0 !important; background: rgba(0,0,0,0.55) !important; color: #fff !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; }
        .rit-thumb-more span { font-size: 12px !important; font-weight: 700 !important; line-height: 1.2 !important; }
        .rit-dummy-item { background: #f8fafc !important; border: 1px dashed #cbd5e1 !important; }
        .rit-dummy-item img { opacity: 0.1 !important; filter: grayscale(100%) !important; }
        .rit-dummy-text { position: absolute !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; font-size: 10px !important; font-weight: 700 !important; color: #64748b !important; line-height: 1.3 !important; }

        /* Top Summary */
        .rit-oy-summary-wrap { margin: 15px 0 !important; padding: 12px 16px !important; background: #f8fafc !important; border-radius: 8px !important; cursor: pointer !important; border: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-oy-content { display: flex !important; justify-content: space-between !important; align-items: center !important; }
        .rit-oy-left { display: flex !important; align-items: center !important; gap: 8px !important; }
        .rit-oy-star { font-size: 14px !important; font-weight: 800 !important; color: #18181b !important; }
        .rit-oy-count { font-size: 12px !important; color: #71717a !important; border-left: 1px solid #e4e4e7 !important; padding-left: 8px !important; }
        
        /* Dashboard Container */
        .rit-detail-container { width: 100% !important; max-width: 1600px !important; margin: 30px auto 60px !important; padding: 0 16px !important; }
        .rit-dashboard-card { background: #fff !important; border: 1px solid #f0f0f0 !important; border-radius: 12px !important; padding: 24px !important; display: flex !important; flex-direction: column !important; gap: 20px !important; width: 100% !important; margin-bottom: 30px !important;}
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
      `;
      document.head.appendChild(style);
    }
  };

  window.ReviewDetailApp = ReviewDetailApp;
  ReviewDetailApp.init();
})();