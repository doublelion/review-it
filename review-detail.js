/**
 * @Project: Review-It Detail Engine (Console Test - Layout Fix)
 * @Feature: Insert AFTER detailArea to prevent flex/grid breaking
 */
(function () {
  console.log('%c[REVIEW-IT]%c Detail Engine Final Fired!', 'color:#3b82f6; font-weight:bold;', 'color:#10b981;');

  // 기존 테스트 잔여물 깔끔하게 청소
  document.querySelectorAll('.rit-oy-summary-wrap, .rit-under-thumb-wrap, #rit-detail-main-board, #rit-console-css').forEach(el => el.remove());

  const CONFIG = {
    defaultImg: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=80',
    mockSettings: {
      detail_display_type: 'masonry',
      is_detail_summary_enabled: true,
      is_detail_gallery_enabled: true,
      FORCE_STATE: 'has_reviews' // 테스트 상태
    }
  };

  const ReviewDetailApp = {
    reviews: [],

    init() {
      this.injectCSS();
      this.hideDefaultReviews();

      // 목업 데이터 생성
      if (CONFIG.mockSettings.FORCE_STATE === 'empty') {
        this.reviews = [];
      } else {
        this.reviews = Array(8).fill(0).map((_, i) => ({
          id: `mock_${i}`,
          stars: i % 3 === 0 ? 4 : 5,
          subject: '너무 마음에 들어요! 재구매 의사 100%',
          clean_text_body: '포장도 꼼꼼하고 재질도 너무 좋아요. 고민하다가 샀는데 진작 살 걸 그랬네요.',
          image_urls: [CONFIG.defaultImg],
          author_name: '김**',
          created_at: '2026-07-22T00:00:00'
        }));
      }

      if (this.reviews.length === 0) {
        this.renderEmptyState();
        return;
      }

      if (CONFIG.mockSettings.is_detail_gallery_enabled) this.renderUnderThumbGallery();
      if (CONFIG.mockSettings.is_detail_summary_enabled) this.renderTopSummary();
      this.renderMainDetailBoard();
    },

    hideDefaultReviews() {
      document.querySelectorAll('#prdReview, .xans-product-review, a[name="use_review"]').forEach(el => {
        if (el) el.style.setProperty('display', 'none', 'important');
      });
    },

    // 💡 [핵심 수정] detailArea "안(appendChild)"이 아니라 "밖(insertAfter)"으로 뺌
    renderUnderThumbGallery() {
      let targetEl = document.querySelector('.detailArea');

      // fallback
      if (!targetEl) targetEl = document.querySelector('.xans-product-image, .product-image-section');
      if (!targetEl || !targetEl.parentNode) return;

      const galleryContainer = document.createElement('div');
      galleryContainer.className = 'rit-under-thumb-wrap';

      const photos = this.reviews.slice(0, 5);
      const hasMore = this.reviews.length > 5;

      const photosHtml = photos.map((r, index) => {
        const isLast = index === 4;
        return `
          <div class="rit-thumb-item">
            <img src="${r.image_urls[0]}" alt="review">
            ${isLast && hasMore ? `<div class="rit-thumb-more">+${this.reviews.length - 5}</div>` : ''}
          </div>
        `;
      }).join('');

      galleryContainer.innerHTML = `
        <div class="rit-thumb-header">
          <span class="rit-thumb-title">포토리뷰 <span class="rit-count">(${this.reviews.length}건)</span></span>
          <span class="rit-thumb-view-all" onclick="document.getElementById('rit-detail-main-board').scrollIntoView({behavior: 'smooth'})">전체보기</span>
        </div>
        <div class="rit-thumb-list">${photosHtml}</div>
      `;

      // 💡 detailArea가 끝나는 바로 다음 형제 요소로 삽입 (기존 레이아웃 붕괴 방지)
      targetEl.parentNode.insertBefore(galleryContainer, targetEl.nextSibling);
    },

    renderTopSummary() {
      let infoArea = document.querySelector('.xans-product-info, .infoArea, .prdInfo');
      if (!infoArea) {
        const buyBtn = document.querySelector('.xans-product-action, #totalProducts');
        if (buyBtn) infoArea = buyBtn.parentNode;
      }
      if (!infoArea) return;

      const summaryContainer = document.createElement('div');
      summaryContainer.className = 'rit-oy-summary-wrap';
      summaryContainer.innerHTML = `
        <div class="rit-oy-content" onclick="document.getElementById('rit-detail-main-board').scrollIntoView({behavior: 'smooth'})">
          <div class="rit-oy-left">
            <span class="rit-oy-star">★ 4.9</span>
            <span class="rit-oy-count">리뷰 ${this.reviews.length}건</span>
          </div>
          <div class="rit-oy-avatars">
             <img src="${CONFIG.defaultImg}" class="rit-oy-avatar">
             <img src="${CONFIG.defaultImg}" class="rit-oy-avatar">
             <div class="rit-oy-avatar-more">+</div>
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

      const dashboardHtml = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score">4.9</div> 
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars" style="color:#f59e0b; font-size:16px;">★★★★★</div>
                <div class="rit-dash-count-text">총 <strong>${this.reviews.length}개</strong>의 리뷰</div>
              </div>
            </div>
          </div>
          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
        const pct = star === 5 ? 85 : (star === 4 ? 15 : 0);
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
          <h2 class="rit-universal-title">Product Reviews</h2>
        </div>
        ${dashboardHtml}
        <div id="rit-detail-grid" class="rit-masonry-grid"></div>
      `;

      const prdReview = document.querySelector('#prdReview');
      const additional = document.querySelector('.xans-product-additional');
      const prdDetail = document.querySelector('#prdDetail');

      if (prdReview) prdReview.parentNode.insertBefore(container, prdReview.nextSibling);
      else if (additional) additional.appendChild(container);
      else if (prdDetail) prdDetail.appendChild(container);
      else document.body.appendChild(container);

      this.initMasonry();
    },

    initMasonry() {
      const grid = document.getElementById('rit-detail-grid');
      if (!grid) return;

      let cols = window.innerWidth >= 1024 ? 4 : (window.innerWidth >= 768 ? 3 : 2);
      if (this.reviews.length < cols) cols = this.reviews.length;

      const columnDOMs = Array.from({ length: cols }, () => []);
      this.reviews.forEach((r, i) => {
        columnDOMs[i % cols].push(`
          <div class="rit-masonry-item">
            <div style="position:relative; width:100%; overflow:hidden;">
              <img src="${r.image_urls[0]}" class="rit-masonry-img">
            </div>
            <div class="rit-masonry-info">
              <div style="font-size:11px; font-weight:700; color:#52525b; margin-bottom:5px;">★ ${r.stars}.0</div>
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-desc">${r.clean_text_body}</div>
              <div class="rit-masonry-meta">
                <span style="font-weight:600; color:#71717a;">${r.author_name}</span>
                <span style="color:#a1a1aa;">26.07.22</span>
              </div>
            </div>
          </div>
        `);
      });

      grid.innerHTML = columnDOMs.map(col => `<div class="rit-masonry-column">${col.join('')}</div>`).join('');
    },

    renderEmptyState() {
      const container = document.createElement('div');
      container.id = 'rit-detail-main-board';
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div class="rit-empty-state">
          <div class="rit-empty-icon">✨</div>
          <h3 class="rit-empty-title">이 상품의 첫 번째 리뷰어가 되어주세요!</h3>
          <a href="#" class="rit-btn-write">첫 리뷰 작성하고 혜택 받기</a>
        </div>
      `;
      const target = document.querySelector('#prdReview') || document.querySelector('.xans-product-additional') || document.body;
      if (target.parentNode) target.parentNode.insertBefore(container, target.nextSibling);
    },

    injectCSS() {
      const style = document.createElement('style');
      style.id = 'rit-console-css';
      style.innerHTML = `
        .rit-list-container { width: 100%; max-width: 1200px; margin: 30px auto 60px; box-sizing: border-box; padding: 0 16px; clear: both; }
        
        /* 갤러리를 밖으로 뺐을 때의 스타일 보정 (전체 너비 제어) */
        .rit-under-thumb-wrap { margin: 40px auto 20px; padding-top: 20px; border-top: 1px solid #f4f4f5; display:block; clear:both; width: 100%; max-width: 1200px; box-sizing: border-box;}
        
        .rit-thumb-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        .rit-thumb-title { font-size: 14px; font-weight: 800; color: #111; display:flex; align-items:center; gap:4px; }
        .rit-count { color: #a1a1aa; font-weight: 500; font-size: 13px; }
        .rit-thumb-view-all { font-size: 12px; color: #71717a; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .rit-thumb-list { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
        .rit-thumb-list::-webkit-scrollbar { display: none; }
        .rit-thumb-item { position: relative; width: calc(20% - 6.4px); aspect-ratio: 1/1; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: #f4f4f5; cursor: pointer; border: 1px solid #f0f0f0; }
        .rit-thumb-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .rit-thumb-item:hover img { transform: scale(1.05); }
        .rit-thumb-more { position: absolute; inset: 0; background: rgba(0,0,0,0.6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; }

        .rit-oy-summary-wrap { margin: 15px 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; cursor: pointer; display:block; clear:both; border: 1px solid #f1f5f9; box-sizing: border-box;}
        .rit-oy-content { display: flex; justify-content: space-between; align-items: center; }
        .rit-oy-left { display: flex; align-items: center; gap: 8px; }
        .rit-oy-star { font-size: 14px; font-weight: 800; color: #18181b; }
        .rit-oy-count { font-size: 12px; color: #71717a; border-left: 1px solid #e4e4e7; padding-left: 8px; }
        .rit-oy-avatars { display: flex; align-items: center; }
        .rit-oy-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid #ff425c; margin-left: -8px; position: relative; z-index: 2; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .rit-oy-avatar:first-child { margin-left: 0; z-index: 3; }
        .rit-oy-avatar-more { width: 24px; height: 24px; border-radius: 50%; background: #e4e4e7; color: #52525b; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-left: -8px; position: relative; z-index: 1; border: 1.5px solid #fff; }

        /* 대시보드 그래프 */
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

        /* 메이슨리 격자 */
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
      `;
      document.head.appendChild(style);
    }
  };

  ReviewDetailApp.init();
})();