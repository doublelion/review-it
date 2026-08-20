/**
 * @Project: Review-It Detail Engine (Production Master v1.5.0)
 * @Feature: 0-Review Universal Layout Secured, Dashboard + Empty State Merge
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Production Engine Master Loaded!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

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

      // 💡 리뷰가 0개여도 무조건 레이아웃 렌더링 진행 (Return 종료 제거)
      if (this.settings.is_detail_summary_enabled !== false) this.renderTopSummary();
      if (this.reviews.length > 0 && this.settings.is_detail_gallery_enabled !== false) this.renderUnderThumbGallery();

      this.renderMainDetailBoard();
    },

    async loadSettings() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
        const data = await res.json();
        if (data && data.length > 0) this.settings = data[0];
      } catch (e) {
        this.settings = { detail_display_type: 'masonry', is_detail_summary_enabled: true, is_detail_gallery_enabled: true };
      }
    },

    async loadReviews() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&product_no=eq.${productNo}&is_visible=eq.true&order=created_at.desc`, { headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` } });
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
      // 1. 타겟 엘리먼트 찾기 (와이키나스 테마의 .detailArea 완벽 대응)
      let targetEl = document.querySelector('.detailArea, .xans-product-image, .product-image-section');
      if (!targetEl || !targetEl.parentNode) return;

      const galleryContainer = document.createElement('div');
      // 플로팅 해제를 위해 cboth 추가
      galleryContainer.className = 'rit-under-thumb-wrap cboth';

      const totalPhotos = this.photoReviews.length;
      let photosHtml = '';

      if (totalPhotos > 0) {
        // 리뷰가 있을 때 정상 렌더링
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
        // 💡 리뷰가 0개일 때: 샘플 더미(가이드) 썸네일 5장 노출
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

      // detailArea 바로 밑으로 정확하게 삽입
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

    getCardHTML(r) { /* 생략 없이 기존 코드 유지 */ return `
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
        .cboth { clear: both; display: block; }
        .rit-list-container { width: 100%; max-width: 1600px; margin: 30px auto 60px; box-sizing: border-box; padding: 0 16px; }
        .rit-empty-state { background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 20px; text-align: center; margin-top: 20px; width: 100%; }
        .rit-empty-icon { font-size: 40px; margin-bottom: 15px; animation: bounce 2s infinite; }
        .rit-empty-title { font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 10px; }
        .rit-empty-desc { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 25px; word-break: keep-all; }
        .rit-empty-desc strong { color: #3b82f6; }
        .rit-btn-write { display: inline-block; background: #18181b; color: #fff !important; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .rit-oy-summary-wrap { margin: 15px 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; cursor: pointer; border: 1px solid #f1f5f9; box-sizing: border-box; width: 100%; }
        .rit-oy-content { display: flex; justify-content: space-between; align-items: center; }
        .rit-oy-left { display: flex; align-items: center; gap: 8px; }
        .rit-oy-star { font-size: 14px; font-weight: 800; color: #18181b; }
        .rit-oy-count { font-size: 12px; color: #71717a; border-left: 1px solid #e4e4e7; padding-left: 8px; }
        .rit-oy-avatars { display: flex; align-items: center; }
        .rit-oy-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid #ff425c; margin-left: -8px; position: relative; z-index: 2; }
        .rit-oy-avatar:first-child { margin-left: 0; z-index: 3; }
        .rit-dashboard-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 20px; width: 100%; box-sizing: border-box; }
        @media (min-width: 768px) { .rit-dashboard-card { flex-direction: row; align-items: center; justify-content: space-between; } }
        .rit-dash-left { display: flex; gap: 15px; flex: 1; }
        .rit-dash-score-box { display: flex; align-items: center; gap: 15px; }
        .rit-dash-big-score { font-size: 36px; font-weight: 800; color: #111; line-height: 1; }
        .rit-dash-count-text { font-size: 12px; color: #666; font-weight: 500; }
        .rit-dash-gauge-box { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        @media (min-width: 768px) { .rit-dash-gauge-box { border-left: 1px solid #f3f3f3; padding-left: 24px; } }
        .rit-gauge-row { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #888; }
        .rit-gauge-label { width: 24px; font-weight: 600; color: #52525b; }
        .rit-gauge-bg { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
        .rit-gauge-fill { height: 100%; background: #f59e0b; border-radius: 4px; }
        .rit-gauge-percent { width: 28px; text-align: right; font-weight: 600; }
        .rit-universal-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
        .rit-universal-title { font-size: 20px; font-weight: 800; color: #111; margin: 0; }
        .rit-masonry-grid { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; width: 100%; box-sizing: border-box; margin-top: 20px; }
        .rit-masonry-column { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 16px; }
        .rit-masonry-item { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; }
        .rit-masonry-info { padding: 15px; display: flex; flex-direction: column; flex-grow: 1; }
        .rit-masonry-subject { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-meta { display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid #eee; padding-top: 10px; margin-top: auto; }
        @media (max-width: 768px) { .rit-oy-summary-wrap { margin-left: 16px; margin-right: 16px; width: calc(100% - 32px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        /* 더미 썸네일 디자인 추가 */
        .rit-dummy-item { background: #f8fafc; border: 1px dashed #cbd5e1; }
        .rit-dummy-item img { opacity: 0.15; filter: grayscale(100%); }
        .rit-dummy-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 11px; font-weight: 700; color: #64748b; line-height: 1.4; }
      `;
      document.head.appendChild(style);
    }
  };

  ReviewDetailApp.init();
})();