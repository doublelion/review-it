/**
 * @Project: Review-It Detail Engine (Production Master v1.6.0)
 * @Feature: 3-Area Independent Control, Theme Style Reset Override, 0-Review Dummy Support
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Production Engine Master Loaded!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

  // 기존 위젯 클린업
  document.querySelectorAll('.rit-oy-summary-wrap, .rit-under-thumb-wrap, #rit-detail-main-board, #rit-detail-css').forEach(el => el.remove());

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

  const productNo = getProductNo();
  const mallId = (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) || window.location.hostname.split('.')[0];

  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    mallId: mallId
  };

  const ReviewDetailApp = {
    settings: {},
    reviews: [],
    photoReviews: [],

    async init() {
      this.injectCSS();
      this.hideDefaultReviews();
      if (!productNo) return;

      await Promise.all([this.loadSettings(), this.loadReviews()]);

      // 💡 [3대 영역 개별 토글 제어]
      // 1. 상단 평점 요약 (OliveYoung Summary)
      if (this.settings.is_detail_summary_enabled !== false) {
        this.renderTopSummary();
      }

      // 2. 썸네일 하단 포토 갤러리 (Under Thumbnail Gallery)
      if (this.settings.is_detail_gallery_enabled !== false) {
        this.renderUnderThumbGallery();
      }

      // 3. 하단 메인 리뷰 영역 (Main Review Board & Dashboard)
      if (this.settings.is_detail_main_enabled !== false) {
        this.renderMainDetailBoard();
      }
    },

    async loadSettings() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}`, { 
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } 
        });
        const data = await res.json();
        if (data && data.length > 0) this.settings = data[0];
      } catch (e) {
        this.settings = { 
          detail_display_type: 'masonry', 
          is_detail_summary_enabled: true, 
          is_detail_gallery_enabled: true,
          is_detail_main_enabled: true 
        };
      }
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&product_no=eq.${productNo}&is_visible=eq.true&order=created_at.desc`, { 
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } 
        });
        this.reviews = await res.json();
        this.photoReviews = this.reviews.filter(r => r.image_urls && r.image_urls.length > 0 && r.image_urls[0] !== CONFIG.defaultImg);
      } catch (e) {
        this.reviews = [];
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
      if (!infoArea) {
        const buyBtn = document.querySelector('.xans-product-action, #totalProducts');
        if (buyBtn) infoArea = buyBtn.parentNode;
      }
      if (!infoArea) return;

      const totalCount = this.reviews.length;
      let avgScore = '5.0';
      if (totalCount > 0) {
        let totalStars = 0;
        this.reviews.forEach(r => totalStars += (r.stars || 5));
        avgScore = (totalStars / totalCount).toFixed(1);
      }

      const avatarPhotos = this.photoReviews.slice(0, 2);
      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'rit-oy-summary-wrap cboth';
      summaryContainer.innerHTML = `
        <div class="rit-oy-content" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">
          <div class="rit-oy-left">
            <span class="rit-oy-star">★ ${totalCount === 0 ? '5.0' : avgScore}</span>
            <span class="rit-oy-count">리뷰 ${totalCount}건</span>
          </div>
          <div class="rit-oy-avatars">
            ${totalCount > 0 && avatarPhotos.length > 0
              ? avatarPhotos.map(r => `<img src="${r.image_urls[0]}" class="rit-oy-avatar">`).join('') + `<div class="rit-oy-avatar-more">+</div>`
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
      let targetEl = document.querySelector('.detailArea') || 
                     document.querySelector('.xans-product-image') || 
                     document.querySelector('.imgArea');
      if (!targetEl || !targetEl.parentNode) return;

      const galleryContainer = document.createElement('div');
      galleryContainer.className = 'rit-under-thumb-wrap cboth';

      const totalPhotos = this.photoReviews.length;
      let photosHtml = '';

      if (totalPhotos > 0) {
        const photos = this.photoReviews.slice(0, 5);
        const hasMore = totalPhotos > 5;
        photosHtml = photos.map((r, index) => {
          const isLast = index === 4;
          return `
            <div class="rit-thumb-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
              <img src="${r.image_urls[0]}" alt="review" onerror="this.src='${CONFIG.defaultImg}'">
              ${isLast && hasMore ? `<div class="rit-thumb-more">+${totalPhotos - 5}</div>` : ''}
            </div>
          `;
        }).join('');
      } else {
        const dummyArr = [1, 2, 3, 4, 5];
        photosHtml = dummyArr.map((num, index) => `
          <div class="rit-thumb-item rit-dummy-item">
            <img src="${CONFIG.defaultImg}" alt="sample">
            ${index === 2 ? `<div class="rit-dummy-text">첫 포토 리뷰를<br>기다려요!</div>` : ''}
          </div>
        `).join('');
      }

      galleryContainer.innerHTML = `
        <div class="rit-thumb-header">
          <span class="rit-thumb-title">포토리뷰 <span class="rit-count">(${totalPhotos}건)</span></span>
          <span class="rit-thumb-view-all" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">전체보기</span>
        </div>
        <div class="rit-thumb-list">${photosHtml}</div>
      `;

      targetEl.parentNode.insertBefore(galleryContainer, targetEl.nextSibling);
    },

    renderMainDetailBoard() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-list-container cboth';

      const totalCount = this.reviews.length;
      const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let avgScore = '0.0';

      if (totalCount > 0) {
        let totalStars = 0;
        this.reviews.forEach(r => {
          const star = r.stars || 5;
          totalStars += star;
          starCounts[star]++;
        });
        avgScore = (totalStars / totalCount).toFixed(1);
      }

      const dashboardHtml = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score">${totalCount === 0 ? '0.0' : avgScore}</div> 
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars" style="color:${totalCount === 0 ? '#e4e4e7' : '#f59e0b'}; font-size:16px;">★★★★★</div>
                <div class="rit-dash-count-text">총 <strong>${totalCount}개</strong>의 리뷰</div>
              </div>
            </div>
          </div>
          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
              const pct = totalCount === 0 ? 0 : Math.round((starCounts[star] / totalCount) * 100);
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
      if (totalCount === 0) {
        contentHtml = `
          <div class="rit-empty-state">
            <div class="rit-empty-icon">✨</div>
            <h3 class="rit-empty-title">이 상품의 첫 번째 리뷰어가 되어주세요!</h3>
            <p class="rit-empty-desc">아직 작성된 리뷰가 없습니다.<br>지금 첫 포토 리뷰를 남겨주시면 <strong>특별한 혜택</strong>을 드립니다!</p>
            <a href="/board/product/write.html?board_no=4&product_no=${productNo}" class="rit-btn-write">첫 리뷰 작성하고 혜택 받기</a>
          </div>
        `;
      } else {
        const isSwiper = this.settings.detail_display_type === 'swiper';
        contentHtml = `<div id="rit-detail-grid" class="${isSwiper ? 'swiper rit-detail-swiper' : 'rit-masonry-grid'}">${isSwiper ? '<div class="swiper-wrapper"></div>' : ''}</div>`;
      }

      container.innerHTML = `
        <div class="rit-universal-header" style="margin-top: 60px;">
          <h2 class="rit-universal-title">${this.settings.title || 'Product Reviews'}</h2>
        </div>
        ${dashboardHtml}
        ${contentHtml}
      `;

      this.injectToBoard(container);

      if (totalCount > 0) {
        if (this.settings.detail_display_type === 'swiper') this.initSwiper();
        else this.initMasonry();
      }
    },

    getCardHTML(r) {
      return `
        <div class="rit-masonry-item" style="height:100%;">
          <div style="position:relative; width:100%; overflow:hidden; background:#f4f4f5;"><img src="${r.image_urls?.[0] || CONFIG.defaultImg}" class="rit-masonry-img" onerror="this.src='${CONFIG.defaultImg}'"></div>
          <div class="rit-masonry-info">
            <div style="font-size:11px; font-weight:700; color:#52525b; margin-bottom:5px;">★ ${r.stars || 5}.0</div>
            <div class="rit-masonry-subject">${r.subject || ''}</div>
            <div class="rit-masonry-desc">${r.clean_text_body || r.content || ''}</div>
            <div class="rit-masonry-meta"><span style="font-weight:600; color:#71717a;">${r.author_name || '고객'}</span><span style="color:#a1a1aa;">${r.created_at ? r.created_at.split('T')[0].replace(/-/g, '.') : ''}</span></div>
          </div>
        </div>
      `;
    },

    initMasonry() {
      const grid = document.getElementById('rit-detail-grid');
      if (!grid) return;
      let cols = window.innerWidth >= 1024 ? (this.settings.grid_rows_desktop || 4) : (this.settings.grid_rows_mobile || 2);
      if (this.reviews.length < cols) cols = this.reviews.length;
      const columnDOMs = Array.from({ length: cols }, () => []);
      this.reviews.forEach((r, i) => columnDOMs[i % cols].push(this.getCardHTML(r)));
      grid.innerHTML = columnDOMs.map(col => `<div class="rit-masonry-column">${col.join('')}</div>`).join('');
    },

    initSwiper() {
      const wrapper = document.querySelector('.rit-detail-swiper .swiper-wrapper');
      if (!wrapper) return;
      wrapper.innerHTML = this.reviews.map(r => `<div class="swiper-slide" style="width:260px; height:auto;">${this.getCardHTML(r)}</div>`).join('');
      if (typeof Swiper !== 'undefined') new Swiper('.rit-detail-swiper', { slidesPerView: 'auto', spaceBetween: 16, freeMode: true, grabCursor: true });
    },

    injectCSS() {
      if (document.getElementById('rit-detail-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-detail-css';
      style.innerHTML = `
        /* 💡 테마 리셋 방어용 베이스 스타일 */
        .cboth { clear: both !important; display: block !important; }
        .rit-under-thumb-wrap, .rit-oy-summary-wrap, .rit-list-container { 
          font-size: 13px !important; 
          line-height: normal !important; 
          box-sizing: border-box !important;
          letter-spacing: normal !important;
        }

        /* 💡 썸네일 하단 갤러리 영역 (강력 복구) */
        .rit-under-thumb-wrap { margin: 25px auto 20px !important; padding-top: 15px !important; border-top: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-thumb-header { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-bottom: 10px !important; }
        .rit-thumb-title { font-size: 14px !important; font-weight: 800 !important; color: #111 !important; }
        .rit-count { color: #94a3b8 !important; font-weight: 500 !important; font-size: 12px !important; }
        .rit-thumb-view-all { font-size: 12px !important; color: #64748b !important; cursor: pointer !important; text-decoration: underline !important; }
        
        .rit-thumb-list { display: flex !important; gap: 8px !important; width: 100% !important; overflow: hidden !important; }
        .rit-thumb-item { position: relative !important; flex: 1 1 0 !important; aspect-ratio: 1/1 !important; border-radius: 6px !important; overflow: hidden !important; background: #f8fafc !important; cursor: pointer !important; border: 1px solid #e2e8f0 !important; }
        .rit-thumb-item img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }
        .rit-thumb-more { position: absolute !important; inset: 0 !important; background: rgba(0,0,0,0.6) !important; color: #fff !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 15px !important; font-weight: 800 !important; }

        /* 더미 썸네일 */
        .rit-dummy-item { background: #f8fafc !important; border: 1px dashed #cbd5e1 !important; }
        .rit-dummy-item img { opacity: 0.1 !important; filter: grayscale(100%) !important; }
        .rit-dummy-text { position: absolute !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; font-size: 11px !important; font-weight: 700 !important; color: #64748b !important; line-height: 1.3 !important; }

        /* 상단 평점 요약 (올리브영 뷰) */
        .rit-oy-summary-wrap { margin: 15px 0 !important; padding: 12px 16px !important; background: #f8fafc !important; border-radius: 8px !important; cursor: pointer !important; border: 1px solid #f1f5f9 !important; width: 100% !important; }
        .rit-oy-content { display: flex !important; justify-content: space-between !important; align-items: center !important; }
        .rit-oy-left { display: flex !important; align-items: center !important; gap: 8px !important; }
        .rit-oy-star { font-size: 14px !important; font-weight: 800 !important; color: #18181b !important; }
        .rit-oy-count { font-size: 12px !important; color: #71717a !important; border-left: 1px solid #e4e4e7 !important; padding-left: 8px !important; }
        .rit-oy-avatars { display: flex !important; align-items: center !important; }
        .rit-oy-avatar { width: 24px !important; height: 24px !important; border-radius: 50% !important; object-fit: cover !important; border: 1.5px solid #ff425c !important; margin-left: -8px !important; position: relative !important; z-index: 2 !important; }
        .rit-oy-avatar:first-child { margin-left: 0 !important; z-index: 3 !important; }
        .rit-oy-avatar-more { width: 24px !important; height: 24px !important; border-radius: 50% !important; background: #e4e4e7 !important; color: #52525b !important; font-size: 10px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; margin-left: -8px !important; border: 1.5px solid #fff !important; }

        /* 메인 리스트 컨테이너 */
        .rit-list-container { width: 100% !important; max-width: 1600px !important; margin: 30px auto 60px !important; padding: 0 16px !important; }
        .rit-empty-state { background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%) !important; border: 1px dashed #cbd5e1 !important; border-radius: 12px !important; padding: 60px 20px !important; text-align: center !important; margin-top: 20px !important; width: 100% !important; }
        .rit-empty-icon { font-size: 40px !important; margin-bottom: 15px !important; animation: bounce 2s infinite !important; }
        .rit-empty-title { font-size: 18px !important; font-weight: 800 !important; color: #1e293b !important; margin-bottom: 10px !important; }
        .rit-empty-desc { font-size: 14px !important; color: #64748b !important; line-height: 1.6 !important; margin-bottom: 25px !important; }
        .rit-btn-write { display: inline-block !important; background: #18181b !important; color: #fff !important; padding: 14px 28px !important; border-radius: 8px !important; font-weight: 700 !important; font-size: 14px !important; text-decoration: none !important; }

        /* 대시보드 카드 */
        .rit-dashboard-card { background: #fff !important; border: 1px solid #f0f0f0 !important; border-radius: 12px !important; padding: 24px !important; display: flex !important; flex-direction: column !important; gap: 20px !important; width: 100% !important; }
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

        .rit-universal-header { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-bottom: 20px !important; }
        .rit-universal-title { font-size: 20px !important; font-weight: 800 !important; color: #111 !important; margin: 0 !important; }
        
        .rit-masonry-grid { display: flex !important; flex-direction: row !important; align-items: flex-start !important; gap: 16px !important; width: 100% !important; margin-top: 20px !important; }
        .rit-masonry-column { display: flex !important; flex-direction: column !important; flex: 1 !important; min-width: 0 !important; gap: 16px !important; }
        .rit-masonry-item { background: #fff !important; border: 1px solid #f0f0f0 !important; border-radius: 12px !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; }
        .rit-masonry-img { width: 100% !important; height: auto !important; display: block !important; object-fit: cover !important; }
        .rit-masonry-info { padding: 15px !important; display: flex !important; flex-direction: column !important; }
        .rit-masonry-subject { font-size: 13px !important; font-weight: 700 !important; color: #111 !important; margin-bottom: 6px !important; }
        .rit-masonry-desc { font-size: 12px !important; color: #666 !important; line-height: 1.5 !important; margin-bottom: 12px !important; }
        .rit-masonry-meta { display: flex !important; justify-content: space-between !important; font-size: 11px !important; border-top: 1px solid #eee !important; padding-top: 10px !important; margin-top: auto !important; }
        
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `;
      document.head.appendChild(style);
    }
  };

  ReviewDetailApp.init();
})();