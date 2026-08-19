/**
 * @Project: Review-It Detail Engine (Production Master v1.3.0)
 * @Feature: Universal ProductNo Extractor, 0-Review OliveYoung Summary, Tab Safe Injection
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Production Engine Master Loaded!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

  // 기존 위젯 클린업
  document.querySelectorAll('.rit-oy-summary-wrap, .rit-under-thumb-wrap, #rit-detail-main-board, #rit-detail-css').forEach(el => el.remove());

  // 💡 [핵심 해결] 카페24 모든 URL 패턴에서 product_no를 추출하는 만능 함수
  const getProductNo = () => {
    if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return String(window.iProductNo);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('product_no')) return urlParams.get('product_no');

    // SEO URL 패턴 대응 (/product/상품명/14/...)
    const pathMatches = window.location.pathname.match(/\/product\/(?:[^\/]+\/)?(\d+)/i);
    if (pathMatches && pathMatches[1]) return pathMatches[1];

    // Meta 태그 Fallback
    const metaPrd = document.querySelector('meta[property="product:productId"], meta[name="product_no"]');
    if (metaPrd && metaPrd.content) return metaPrd.content;

    return null;
  };

  const productNo = getProductNo();
  const mallId = (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID)
    || window.location.hostname.split('.')[0];

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

      if (!productNo) {
        console.warn('[REVIEW-IT] 상품 번호 추출 불가로 실행을 중단합니다.');
        return;
      }

      // 1. 설정 및 리뷰 동시 조회
      await Promise.all([this.loadSettings(), this.loadReviews()]);

      // 2. 💡 [요청사항 반영] 리뷰가 0개여도 상단 올리브영 요약본은 기본 노출
      if (this.settings.is_detail_summary_enabled !== false) {
        this.renderTopSummary();
      }

      // 3. 리뷰가 0개인 경우: 하단에 Empty State 렌더링
      if (this.reviews.length === 0) {
        this.renderEmptyState();
        return;
      }

      // 4. 리뷰가 있는 경우: 포토 갤러리 및 메인 보드 정상 렌더링
      if (this.settings.is_detail_gallery_enabled !== false) {
        this.renderUnderThumbGallery();
      }
      this.renderMainDetailBoard();
    },

    async loadSettings() {
      try {
        const res = await fetch(`${CONFIG.sbUrl}/widget_settings?mall_id=eq.${CONFIG.mallId}`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}` }
        });
        const data = await res.json();
        if (data && data.length > 0) this.settings = data[0];
      } catch (e) {
        this.settings = { detail_display_type: 'masonry', is_detail_summary_enabled: true, is_detail_gallery_enabled: true };
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
        console.error("[REVIEW-IT] 리뷰 로드 실패:", e);
      }
    },

    hideDefaultReviews() {
      const selectors = [
        '.xans-product-review',
        'a[name="use_review"]',
        '#prdReview > table',
        '#prdReview > .board'
      ];
      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        if (el) el.style.setProperty('display', 'none', 'important');
      });
    },

    // 💡 탭 박스 안쪽 최하단 삽입
    injectToBoard(container) {
      const prdReview = document.querySelector('#prdReview');
      const additional = document.querySelector('.xans-product-additional');
      const prdDetail = document.querySelector('#prdDetail');

      if (prdReview) {
        prdReview.appendChild(container);
      } else if (additional) {
        additional.appendChild(container);
      } else if (prdDetail) {
        prdDetail.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
    },

    renderEmptyState() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-empty-state">
          <div class="rit-empty-icon">✨</div>
          <h3 class="rit-empty-title">이 상품의 첫 번째 리뷰어가 되어주세요!</h3>
          <p class="rit-empty-desc">아직 작성된 리뷰가 없습니다.<br>지금 첫 포토 리뷰를 남겨주시면 <strong>특별한 혜택</strong>을 드립니다!</p>
          <a href="/board/product/write.html?board_no=4&product_no=${productNo}" class="rit-btn-write">첫 리뷰 작성하고 혜택 받기</a>
        </div>
      `;
      this.injectToBoard(container);
    },

    renderUnderThumbGallery() {
      if (this.photoReviews.length === 0) return;
      let targetEl = document.querySelector('.detailArea');
      if (!targetEl) targetEl = document.querySelector('.xans-product-image, .product-image-section');
      if (!targetEl || !targetEl.parentNode) return;

      const galleryContainer = document.createElement('div');
      galleryContainer.className = 'rit-under-thumb-wrap';
      const photos = this.photoReviews.slice(0, 5);
      const hasMore = this.photoReviews.length > 5;

      const photosHtml = photos.map((r, index) => {
        const isLast = index === 4;
        return `
          <div class="rit-thumb-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${r.image_urls[0]}" alt="review">
            ${isLast && hasMore ? `<div class="rit-thumb-more">+${this.photoReviews.length - 5}</div>` : ''}
          </div>
        `;
      }).join('');

      galleryContainer.innerHTML = `
        <div class="rit-thumb-header">
          <span class="rit-thumb-title">포토리뷰 <span class="rit-count">(${this.photoReviews.length}건)</span></span>
          <span class="rit-thumb-view-all" onclick="document.getElementById('rit-detail-main-board').scrollIntoView({behavior: 'smooth'})">전체보기</span>
        </div>
        <div class="rit-thumb-list">${photosHtml}</div>
      `;
      targetEl.parentNode.insertBefore(galleryContainer, targetEl.nextSibling);
    },

    // 💡 0건일 때도 자연스럽게 처리되는 올리브영 요약 뷰
    renderTopSummary() {
      let infoArea = document.querySelector('.xans-product-info, .infoArea, .prdInfo');
      if (!infoArea) {
        const buyBtn = document.querySelector('.xans-product-action, #totalProducts');
        if (buyBtn) infoArea = buyBtn.parentNode;
      }
      if (!infoArea) return;

      let avgScore = '5.0';
      const totalCount = this.reviews.length;

      if (totalCount > 0) {
        let totalStars = 0;
        this.reviews.forEach(r => totalStars += (r.stars || 5));
        avgScore = (totalStars / totalCount).toFixed(1);
      }

      const avatarPhotos = this.photoReviews.slice(0, 2);

      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'rit-oy-summary-wrap';
      summaryContainer.innerHTML = `
        <div class="rit-oy-content" onclick="document.getElementById('rit-detail-main-board')?.scrollIntoView({behavior: 'smooth'})">
          <div class="rit-oy-left">
            <span class="rit-oy-star">★ ${avgScore}</span>
            <span class="rit-oy-count">리뷰 ${totalCount}건</span>
          </div>
          <div class="rit-oy-avatars">
            ${avatarPhotos.length > 0
          ? avatarPhotos.map(r => `<img src="${r.image_urls[0]}" class="rit-oy-avatar">`).join('') + `<div class="rit-oy-avatar-more">+</div>`
          : `<span style="font-size:11px; color:#94a3b8; font-weight:500;">첫 리뷰 작성 시 포인트 지급</span>`
        }
          </div>
        </div>
      `;
      const productNameEl = infoArea.querySelector('.name, .prd-name, h2, h3, .headingArea');
      if (productNameEl) productNameEl.parentNode.insertBefore(summaryContainer, productNameEl.nextSibling);
      else infoArea.insertBefore(summaryContainer, infoArea.firstChild);
    },

    renderMainDetailBoard() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-list-container';

      const isSwiper = this.settings.detail_display_type === 'swiper';

      let totalStars = 0;
      const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      this.reviews.forEach(r => {
        const star = r.stars || 5;
        totalStars += star;
        starCounts[star]++;
      });
      const avgScore = (totalStars / this.reviews.length).toFixed(1);

      const dashboardHtml = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score">${avgScore}</div> 
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars" style="color:#f59e0b; font-size:16px;">★★★★★</div>
                <div class="rit-dash-count-text">총 <strong>${this.reviews.length}개</strong>의 리뷰</div>
              </div>
            </div>
          </div>
          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
        const pct = Math.round((starCounts[star] / this.reviews.length) * 100);
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

      container.innerHTML = `
        <div class="rit-universal-header" style="margin-top: 60px;">
          <h2 class="rit-universal-title">${this.settings.title || 'Product Reviews'}</h2>
        </div>
        ${dashboardHtml}
        <div id="rit-detail-grid" class="${isSwiper ? 'swiper rit-detail-swiper' : 'rit-masonry-grid'}">
           ${isSwiper ? '<div class="swiper-wrapper"></div>' : ''}
        </div>
      `;

      this.injectToBoard(container);

      if (isSwiper) this.initSwiper();
      else this.initMasonry();
    },

    getCardHTML(r) {
      const img = r.image_urls && r.image_urls.length > 0 ? r.image_urls[0] : CONFIG.defaultImg;
      const date = r.created_at ? r.created_at.split('T')[0].replace(/-/g, '.') : '';
      return `
        <div class="rit-masonry-item" style="height:100%;">
          <div style="position:relative; width:100%; overflow:hidden; background:#f4f4f5;">
            <img src="${img}" class="rit-masonry-img" onerror="this.src='${CONFIG.defaultImg}'">
          </div>
          <div class="rit-masonry-info">
            <div style="font-size:11px; font-weight:700; color:#52525b; margin-bottom:5px;">★ ${r.stars || 5}.0</div>
            <div class="rit-masonry-subject">${r.subject || ''}</div>
            <div class="rit-masonry-desc">${r.clean_text_body || r.content || ''}</div>
            <div class="rit-masonry-meta">
              <span style="font-weight:600; color:#71717a;">${r.author_name || '고객'}</span>
              <span style="color:#a1a1aa;">${date}</span>
            </div>
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

      if (typeof Swiper !== 'undefined') {
        new Swiper('.rit-detail-swiper', {
          slidesPerView: 'auto',
          spaceBetween: 16,
          freeMode: true,
          grabCursor: true
        });
      }
    },

    injectCSS() {
      const style = document.createElement('style');
      style.id = 'rit-detail-css';
      style.innerHTML = `
        .rit-list-container { width: 100%; max-width: 1200px; margin: 30px auto 60px; box-sizing: border-box; padding: 0 16px; clear: both; }
        
        .rit-empty-state { background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border: 1px dashed #cbd5e1; border-radius: 16px; padding: 60px 20px; text-align: center; margin: 20px 0; }
        .rit-empty-icon { font-size: 40px; margin-bottom: 15px; animation: bounce 2s infinite; }
        .rit-empty-title { font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 10px; }
        .rit-empty-desc { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 25px; word-break: keep-all; }
        .rit-empty-desc strong { color: #3b82f6; }
        .rit-btn-write { display: inline-block; background: #18181b; color: #fff !important; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        
        .rit-under-thumb-wrap { margin: 30px auto 20px; padding-top: 20px; border-top: 1px solid #f4f4f5; display:block; clear:both; width: 100%; max-width: 1200px; box-sizing: border-box;}
        .rit-thumb-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        .rit-thumb-title { font-size: 14px; font-weight: 800; color: #111; display:flex; align-items:center; gap:4px; }
        .rit-count { color: #a1a1aa; font-weight: 500; font-size: 13px; }
        .rit-thumb-view-all { font-size: 12px; color: #71717a; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .rit-thumb-list { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
        .rit-thumb-list::-webkit-scrollbar { display: none; }
        .rit-thumb-item { position: relative; width: calc(20% - 6.4px); aspect-ratio: 1/1; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: #f4f4f5; cursor: pointer; border: 1px solid #f0f0f0; }
        .rit-thumb-item img { width: 100%; height: 100%; object-fit: cover; }
        .rit-thumb-more { position: absolute; inset: 0; background: rgba(0,0,0,0.6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; }

        .rit-oy-summary-wrap { margin: 15px 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; cursor: pointer; display:block; clear:both; border: 1px solid #f1f5f9; box-sizing: border-box;}
        .rit-oy-content { display: flex; justify-content: space-between; align-items: center; }
        .rit-oy-left { display: flex; align-items: center; gap: 8px; }
        .rit-oy-star { font-size: 14px; font-weight: 800; color: #18181b; }
        .rit-oy-count { font-size: 12px; color: #71717a; border-left: 1px solid #e4e4e7; padding-left: 8px; }
        .rit-oy-avatars { display: flex; align-items: center; }
        .rit-oy-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid #ff425c; margin-left: -8px; position: relative; z-index: 2; }
        .rit-oy-avatar:first-child { margin-left: 0; z-index: 3; }
        .rit-oy-avatar-more { width: 24px; height: 24px; border-radius: 50%; background: #e4e4e7; color: #52525b; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-left: -8px; position: relative; z-index: 1; border: 1.5px solid #fff; }

        .rit-dashboard-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 24px; margin-bottom: 30px; display: flex; flex-direction: column; gap: 20px; }
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

        .rit-masonry-grid { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; width: 100%; box-sizing: border-box; }
        .rit-masonry-column { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 16px; }
        .rit-masonry-item { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; }
        .rit-masonry-info { padding: 15px; display: flex; flex-direction: column; flex-grow: 1; }
        .rit-masonry-subject { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-meta { display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid #eee; padding-top: 10px; margin-top: auto; }

        @media (max-width: 768px) {
          .rit-under-thumb-wrap { padding-left: 16px; padding-right: 16px; }
          .rit-oy-summary-wrap { margin-left: 16px; margin-right: 16px; }
        }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `;
      document.head.appendChild(style);
    }
  };

  ReviewDetailApp.init();
})();