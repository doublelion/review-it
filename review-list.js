/**
 * @Project: Review-It Universal Board List Engine v1.0.1
 * @Role: Cafe24 Review SaaS Lead Developer
 * @Update: 임시 상품 태그 칩 시현 연동, 별점 비어있는 영역 톤앤매너 보정, 모달 쇼퍼블 스마트 연동
 */
(function (window) {
  if (window.RIT_LIST_LOADED) return;
  window.RIT_LIST_LOADED = true;

  const stripHtml = (html) => {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || "";
  };

  const getDynamicConfig = () => {
    let cafe24MallId = null;
    if (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) {
      cafe24MallId = window.CAFE24API.MALL_ID;
    } else if (typeof window.SHOP_ID !== 'undefined' && window.SHOP_ID) {
      cafe24MallId = window.SHOP_ID;
    } else if (typeof EC_SHOP_ID !== 'undefined' && EC_SHOP_ID) {
      cafe24MallId = EC_SHOP_ID;
    }
    let fallbackMallId = window.location.hostname.split('.').filter(part => !['www', 'm', 'cafe24', 'com', 'co', 'kr'].includes(part))[0];

    let mallName = "REVIEW-IT";
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) mallName = ogSiteName.content.trim();

    return {
      mallId: cafe24MallId || fallbackMallId || 'default_mall',
      mallName: mallName
    };
  };

  const env = getDynamicConfig();

  // 🔒 [테스트 안전장치] ykinas 몰 전용 유지
  if (env.mallId !== 'ykinas') return;

  const currentPath = decodeURIComponent(window.location.pathname);
  const currentSearch = window.location.search;
  const isReviewBoardPage =
    currentPath.includes('/board/product/list') ||
    currentPath.includes('상품-사용후기') ||
    (currentPath.includes('/board/') && (currentSearch.includes('board_no=4') || currentPath.includes('/4/')));

  if (!isReviewBoardPage) return;

  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: env.mallId,
    mallName: env.mallName,
    limit: 15,
    defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
    starPath: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating'
  };

  const ReviewListApp = {
    page: 0,
    isLoading: false,
    hasMore: true,
    renderedIds: new Set(),
    allFetchedReviews: [],

    init() {
      console.log("▶ [REVIEW-IT] 세계 최고 수준의 미니멀 리뷰 리스트 엔진 가동");
      this.hideConflicts();
      this.injectGridCSS();
      this.createLayout();

      if (window.ReviewApp && typeof window.ReviewApp.initModal === 'function') {
        window.ReviewApp.initModal();
        this.hijackModal();
      }

      this.fetchReviews();
      this.initIntersectionObserver();
    },

    hideConflicts() {
      const selectors = ['.xans-board-listpackage', '.boardSort', '.xans-board-empty', '#prdReview', '.xans-product-review', '.review_list_item', 'div[id^="ec-product-review"]', '.board-list-wrap'];
      document.querySelectorAll(selectors.join(', ')).forEach(el => el.style.setProperty('display', 'none', 'important'));
    },

    injectGridCSS() {
      if (!document.getElementById('rit-css-link')) {
        const link = document.createElement('link');
        link.id = 'rit-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://review-it-tau.vercel.app/review-it.css';
        document.head.appendChild(link);
      }

      if (document.getElementById('rit-list-grid-css')) return;
      const style = document.createElement('style');
      style.id = 'rit-list-grid-css';
      style.innerHTML = `
        #review-it-widget, #rit-widget-container { display: none !important; }
        .rit-list-container { width: 100%; max-width: 1200px; margin: 30px auto 60px; padding: 0 15px; }
        
        /* 📊 상단 소셜 프루프 대시보드 카드 */
        .rit-dashboard-card {
          background: #ffffff;
          border: 1px solid #f0f0f0;
          border-radius: 16px;
          padding: 28px 32px;
          margin-bottom: 35px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        @media (min-width: 1024px) {
          .rit-dashboard-card { flex-direction: row; align-items: center; justify-content: space-between; }
        }

        .rit-dash-left { display: flex; flex-direction: column; gap: 15px; flex: 1; }
        .rit-dash-score-box { display: flex; align-items: center; gap: 18px; }
        .rit-dash-big-score { font-size: 44px; font-weight: 800; color: #111; line-height: 1; letter-spacing: -1px; }
        .rit-dash-score-info { display: flex; flex-direction: column; gap: 4px; }
        .rit-dash-stars { display: flex; gap: 2px; }
        .rit-universal-star { height: 16px !important; }

        .rit-dash-count-text { font-size: 13px; color: #666; font-weight: 500; }
        .rit-dash-satisfaction { font-size: 12px; color: #71717a; font-weight: 600; }

        .rit-dash-gauge-box { flex: 1; max-width: 420px; display: flex; flex-direction: column; gap: 6px; }
        @media (min-width: 1024px) {
          .rit-dash-gauge-box { border-left: 1px solid #f3f3f3; padding-left: 32px; }
        }
        .rit-gauge-row { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #888; }
        .rit-gauge-label { width: 28px; font-weight: 600; color: #555; }
        .rit-gauge-bg { flex: 1; height: 6px; background: #f2f2f2; border-radius: 3px; overflow: hidden; }
        .rit-gauge-fill { height: 100%; background: #18181b; border-radius: 3px; transition: width 0.6s ease; }
        .rit-gauge-percent { width: 32px; text-align: right; font-weight: 500; color: #71717a; }

        /* 🛍️ 미니멀 상품 정보 태그 칩 스타일 */
        .rit-product-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          padding: 6px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
          transition: background 0.2s;
        }
        .rit-product-chip:hover {
          background: #f1f5f9;
        }
        .rit-product-chip-img {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          object-fit: cover;
        }
        .rit-product-chip-name {
          font-size: 11px;
          color: #475569;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* 🛍️ 미니멀 라인 쇼퍼블 버튼 */
        .rit-shoppable-wrap { margin-top: 25px; padding-top: 20px; border-top: 1px solid #f4f4f5; }
        .rit-btn-shoppable {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          background: #fafafa !important;
          color: #18181b !important;
          border: 1px solid #e4e4e7 !important;
          text-decoration: none !important;
          padding: 13px 18px !important;
          border-radius: 10px !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .rit-btn-shoppable:hover {
          background: #18181b !important;
          color: #ffffff !important;
          border-color: #18181b !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
        }

        /* 🖼️ 진성 맨선리 레이아웃 */
        .rit-masonry-grid { column-count: 2; column-gap: 12px; }
        @media (min-width: 768px) { .rit-masonry-grid { column-count: 3; column-gap: 18px; } }
        @media (min-width: 1024px) { .rit-masonry-grid { column-count: 4; column-gap: 20px; } }
        
        .rit-masonry-item { break-inside: avoid; margin-bottom: 16px; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s; border: 1px solid #f0f0f0; }
        .rit-masonry-item:hover { transform: translateY(-3px); }
        .rit-masonry-img { width: 100%; height: auto; display: block; object-fit: cover; } 
        .rit-masonry-info { padding: 15px; }
        .rit-masonry-subject { font-size: 13px; color: #18181b; font-weight: 700; line-height: 1.4; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .rit-masonry-desc { font-size: 12px; color: #52525b; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: keep-all; }
        .rit-masonry-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 10px; }
        .rit-card-star { height: 12px !important; }

        .rit-modal-swiper .swiper-wrapper { display: flex !important; }
        .rit-modal-swiper .swiper-slide { width: 100% !important; flex-shrink: 0 !important; background: #000 !important; }
        .rit-img-side { background: #000 !important; }
        
        @media (min-width: 768px) {
          .rit-modal-window { overflow: visible !important; }
          .rit-modal-header { position: absolute !important; top: -60px !important; left: 0; right: 0; background: transparent !important; padding: 0 !important; display: flex !important; z-index: 99999 !important; border: none !important; }
          .btn-rit-grid { display: none !important; } 
          .rit-logo-text { font-size: 13px !important; color: #fff !important; opacity: 1 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.6); font-weight: 800; border-left: 1px solid rgba(255,255,255,0.4); padding-left: 10px; margin-left: 5px; }
          .btn-rit-close { color: #fff !important; }
        }
        
        #ritGridView { z-index: 100005 !important; background: #fff !important; }
        #ritGridView:not(.rit-hidden) { display: block !important; }
      `;
      document.head.appendChild(style);
    },

    createLayout() {
      document.querySelectorAll('.rit-list-container, #rit-scroll-anchor').forEach(el => el.remove());

      const wrapper = document.querySelector('#contents') || document.body;
      const container = document.createElement('div');
      container.className = 'rit-list-container';
      container.innerHTML = `
        <div id="rit-dashboard-area"></div>
        <div class="rit-masonry-grid" id="rit-masonry-grid"></div>
        <div id="rit-scroll-anchor" style="text-align:center; padding:30px; color:#a1a1aa; font-size:13px; font-weight:500;">리뷰를 불러오는 중입니다...</div>
      `;
      wrapper.appendChild(container);
    },

    renderDashboard(reviews) {
      const dashArea = document.getElementById('rit-dashboard-area');
      if (!dashArea || reviews.length === 0) return;

      const totalCount = reviews.length;
      let totalStars = 0;
      const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

      reviews.forEach(r => {
        const star = parseInt(r.stars || 5, 10);
        totalStars += star;
        if (starCounts[star] !== undefined) starCounts[star]++;
        else starCounts[5]++;
      });

      const avgScore = (totalStars / totalCount).toFixed(1);
      const satisfiedRatio = Math.round(((starCounts[5] + starCounts[4]) / totalCount) * 100);
      const getPercent = (count) => Math.round((count / totalCount) * 100);

      dashArea.innerHTML = `
        <div class="rit-dashboard-card">
          <div class="rit-dash-left">
            <div class="rit-dash-score-box">
              <div class="rit-dash-big-score">${avgScore}</div>
              <div class="rit-dash-score-info">
                <div class="rit-dash-stars">
                  <img src="${CONFIG.starPath}5.svg" class="rit-universal-star" alt="star rating">
                </div>
                <div class="rit-dash-count-text">총 <strong>${totalCount.toLocaleString()}개</strong>의 생생한 후기</div>
                <div class="rit-dash-satisfaction">구매 고객의 ${satisfiedRatio}%가 만족했습니다</div>
              </div>
            </div>
          </div>

          <div class="rit-dash-gauge-box">
            ${[5, 4, 3, 2, 1].map(star => {
        const pct = getPercent(starCounts[star]);
        return `
                <div class="rit-gauge-row">
                  <span class="rit-gauge-label">${star}점</span>
                  <div class="rit-gauge-bg">
                    <div class="rit-gauge-fill" style="width: ${pct}%;"></div>
                  </div>
                  <span class="rit-gauge-percent">${pct}%</span>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    },

    hijackModal() {
      if (window.ReviewApp && !window.ReviewApp._list_hijacked) {
        window.ReviewApp._list_hijacked = true;
        const origRender = window.ReviewApp.renderDetail;
        window.ReviewApp.renderDetail = async function (id) {
          await origRender.call(this, id);

          const authorEl = document.querySelector('#ritMetaArea .rit-author');
          if (authorEl) {
            authorEl.innerText = CONFIG.mallName;
          }

          const d = window.ReviewApp.data[id];
          const contentSide = document.getElementById('ritContent');

          if (d && contentSide) {
            const oldWrap = contentSide.querySelector('.rit-shoppable-wrap');
            if (oldWrap) oldWrap.remove();

            const productNo = d.product_no || d.product_id;

            // 💡 실제 상품 번호가 있거나 테스트 상태일 때 쇼퍼블 버튼 출력
            const targetProductNo = productNo || '11'; // 시현용 기본 상품 ID
            const productUrl = `/product/detail.html?product_no=${targetProductNo}`;

            const shoppableBtnHtml = `
              <div class="rit-shoppable-wrap">
                <a href="${productUrl}" class="rit-btn-shoppable" target="_blank">
                  <span>🛍️ 리뷰 속 상품 보러가기</span>
                  <span>→</span>
                </a>
              </div>
            `;
            contentSide.insertAdjacentHTML('beforeend', shoppableBtnHtml);
          }
        };
      }
    },

    openModal(id) {
      if (window.ReviewApp) window.ReviewApp.openModal(id);
    },

    async fetchReviews() {
      if (this.isLoading || !this.hasMore) return;
      this.isLoading = true;
      const offset = this.page * CONFIG.limit;

      try {
        const res = await fetch(`${CONFIG.sbUrl}/reviews?mall_id=eq.${CONFIG.mallId}&is_visible=eq.true&order=created_at.desc`, {
          headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Range': `${offset}-${offset + CONFIG.limit - 1}` }
        });
        const data = await res.json();

        if (data.length < CONFIG.limit) {
          this.hasMore = false;
          const anchor = document.getElementById('rit-scroll-anchor');
          if (anchor) anchor.innerHTML = '모든 리뷰를 불러왔습니다.';
        }

        const enrichedData = await Promise.all(data.map(async (r) => {
          if (window.ReviewApp) {
            if (!window.ReviewApp.data[r.id]) {
              window.ReviewApp.data[r.id] = r;
              window.ReviewApp.listOrder.push(r.id);
            }

            let widgetData = window.ReviewApp.data[r.id];

            if (!widgetData.is_parsed && typeof window.ReviewApp._fetchAndSeparateContent === 'function') {
              const scraped = await window.ReviewApp._fetchAndSeparateContent(r.article_no, r.board_no);
              if (scraped) {
                widgetData.all_images = (scraped.images && scraped.images.length > 0) ? scraped.images : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg]);
                widgetData.clean_text_body = stripHtml(scraped.text || r.content || '');
                if (scraped.subject) widgetData.subject = scraped.subject;
              } else {
                widgetData.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
                widgetData.clean_text_body = stripHtml(r.content || '');
              }
              widgetData.is_parsed = true;
            }
            return widgetData;
          }

          r.all_images = r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.defaultImg];
          r.clean_text_body = stripHtml(r.content || '');
          return r;
        }));

        this.allFetchedReviews = [...this.allFetchedReviews, ...enrichedData];
        this.renderDashboard(this.allFetchedReviews);

        this.renderItems(enrichedData);
        this.page++;
      } catch (error) {
        console.error("❌ [REVIEW-IT] 리스트 로드 실패:", error);
      } finally {
        setTimeout(() => { this.isLoading = false; }, 300);
      }
    },

    renderItems(reviews) {
      const grid = document.getElementById('rit-masonry-grid');
      if (!grid) return;

      const uniqueReviews = [];
      reviews.forEach(r => {
        const checkKey = r.article_no || r.id;
        if (!this.renderedIds.has(checkKey)) {
          this.renderedIds.add(checkKey);
          uniqueReviews.push(r);
        }
      });

      if (uniqueReviews.length === 0) return;

      const html = uniqueReviews.map(r => {
        const imgUrl = (r.all_images && r.all_images.length > 0 && r.all_images[0] !== CONFIG.defaultImg) ? r.all_images[0] : CONFIG.defaultImg;
        const cleanContent = r.clean_text_body || '내용이 없습니다.';

        // 💡 [핵심 연동] 시현용 임시 상품 칩 주입 (대표님이 요청하신 크리마/넥젠 스타일의 미니멀 칩)
        const sampleProductName = r.product_name || "REVIEW-IT 프리미엄 솔루션";
        const sampleProductImg = r.product_img || imgUrl;

        const productChipHtml = `
          <div class="rit-product-chip">
            <img src="${sampleProductImg}" class="rit-product-chip-img" alt="product">
            <span class="rit-product-chip-name">${sampleProductName}</span>
          </div>
        `;

        return `
          <div class="rit-masonry-item" onclick="if(window.ReviewApp) window.ReviewApp.openModal('${r.id}')">
            <img src="${imgUrl}" class="rit-masonry-img" loading="lazy" onerror="this.src='${CONFIG.defaultImg}'">
            <div class="rit-masonry-info">
              <div class="rit-masonry-subject">${r.subject}</div>
              <div class="rit-masonry-desc">${cleanContent}</div>
              ${productChipHtml} <!-- 💡 카드 내 상품 태그 칩 노출 -->
              <div class="rit-masonry-meta">
                <span style="font-weight:600; color:#52525b;">${CONFIG.mallName}</span>
                <img src="${CONFIG.starPath}${r.stars || 5}.svg" class="rit-card-star" alt="star">
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (this.page === 0) {
        grid.innerHTML = html;
      } else {
        grid.insertAdjacentHTML('beforeend', html);
      }
    },

    initIntersectionObserver() {
      const anchor = document.getElementById('rit-scroll-anchor');
      if (!anchor) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
          this.fetchReviews();
        }
      }, { rootMargin: '200px' });
      observer.observe(anchor);
    }
  };

  window.ReviewListApp = ReviewListApp;

  if (document.readyState === 'complete') ReviewListApp.init();
  else window.addEventListener('DOMContentLoaded', () => ReviewListApp.init());

})(window);