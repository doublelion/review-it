/**
 * @Project: Review-It Universal Widget Engine v1.0.5
 * @Update: 독립 도메인(.co.kr) 타겟 몰아이디 파싱 버그 완벽 픽스 및 상세페이지 제목 가공 강화
 */
(function (window) {
  const getDynamicConfig = () => {
    // 💡 [버그 수정 핵심] 수집기와 동일하게 카페24 엔진 내부 변수를 활용하여 독립 도메인 완벽 대응
    const cafe24MallId = window.SHOP_ID || (typeof EC_SHOP_ID !== 'undefined' ? EC_SHOP_ID : null);
    
    let fallbackMallId = window.location.hostname.split('.').filter(part => !['www', 'm', 'cafe24', 'com', 'co', 'kr'].includes(part))[0];
    
    const finalMallId = cafe24MallId || fallbackMallId || 'default_mall';

    console.log("▶ [REVIEW-IT Widget] 매핑된 상점 Mall ID:", finalMallId);

    const getProductNo = () => {
      if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return window.iProductNo;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('product_no') || null;
    };

    const getMallName = () => {
      if (window.iMallName && window.iMallName !== "") return window.iMallName;
      let title = document.title || "";
      if (title.includes('-')) {
        const parts = title.split('-');
        title = parts[parts.length - 1].trim();
      } else if (title.includes(':')) {
        title = title.split(':')[0].trim();
      }
      title = title.replace(/공식몰|공식홈페이지|온라인스토어/g, "").trim();
      return title || "REVIEW-IT";
    };

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: finalMallId, // 정확하게 일치된 몰 아이디 바인딩
      PRODUCT_NO: getProductNo(),
      DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|star_fill|star_empty|rating|clear/i,
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자', 'admin', '대표', '주인장'],
      MALL_NAME: getMallName()
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    settings: {
      display_type: 'grid',
      tagline: 'Verified Authenticity',
      title: 'People Choice',
      description: '"당신의 선택에 확신을 더하는 기록"<br>텍스처부터 상세한 사용 후기까지, 실제 구매 고객들이 직접 경험하고 기록한 REVIEW-IT만의 생생한 리얼 피드를 확인해보세요.',
      display_limit: 15,
      grid_rows_desktop: 5,
      grid_rows_mobile: 2
    },

    renderSkeleton(container) {
      const skeletonCards = Array(5).fill(0).map(() => `<div class="rit-skeleton-card"></div>`).join('');
      container.innerHTML = `
        <div class="rit-header-area" style="text-align:center; margin-bottom:30px; opacity:0.6;">
          <div class="rit-skeleton-text" style="width:120px; height:14px; margin:0 auto 10px;"></div>
          <div class="rit-skeleton-text" style="width:250px; height:32px; margin:0 auto;"></div>
          <div class="rit-line" style="width:30px; height:1px; background:#eaeaea; margin:15px auto;"></div>
          <div class="rit-skeleton-text" style="width:350px; height:40px; margin:0 auto; max-width:80%;"></div>
        </div>
        <div class="rit-main-grid-layout" style="overflow: hidden;">
          ${skeletonCards}
        </div>
      `;
    },

    autoCreateContainer() {
      let container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (container) return;

      const pathname = window.location.pathname;
      const isMainPage = pathname === '/' || pathname === '/index.html';
      const isProductPage = !!CONFIG.PRODUCT_NO;

      if (!isMainPage && !isProductPage) return;

      container = document.createElement('div');
      container.id = 'review-it-widget';
      container.style.marginTop = '80px';
      container.style.marginBottom = '80px';

      if (isProductPage) {
        const detailArea = document.querySelector('.xans-product-additional') || document.querySelector('#prdDetail') || document.querySelector('#detailArea');
        if (detailArea) {
          detailArea.appendChild(container);
          return;
        }
      }

      if (isMainPage) {
        const mainContent = document.querySelector('#contents') || document.querySelector('.xans-product-listmain') || document.querySelector('#wrap');
        const footer = document.querySelector('#footer');

        if (mainContent) {
          mainContent.appendChild(container);
        } else if (footer) {
          document.body.insertBefore(container, footer);
        } else {
          document.body.appendChild(container);
        }
      }
      if (document.getElementById('review-it-widget')) this.renderSkeleton(container);
    },

    async init() {
      this.injectCSS();
      this.autoCreateContainer();
      await this.loadWidgetSettings();
      const hasReviews = await this.loadReviews();

      if (!hasReviews) {
        const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
        if (container) container.style.display = 'none';
        return;
      }
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
            if (s[key] !== undefined && s[key] !== null && String(s[key]).trim() !== "") {
              this.settings[key] = (key === 'description') ? s[key].replace(/\n/g, '<br>') : s[key];
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 기본 설정을 유지합니다."); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      name = name.trim();
      // 만약 작성자가 몰 아이디 형태(영어+숫자)라면 마스킹을 유연하게 처리
      if (name.length <= 2) return name.charAt(0) + '*';
      return name.substring(0, 2) + '*'.repeat(Math.max(1, name.length - 2)); 
    },

    // 💡 상세페이지 비동기 스크래핑 시 제목 파싱 필터링 트윅 고도화
    async _fetchAndSeparateContent(articleNo, boardNo = '4') {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        if (!res.ok) throw new Error("Network response was not ok");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        let extractedStar = null;
        const starImg = doc.querySelector('img[src*="icon-star-rating"]');
        if (starImg) {
          const match = starImg.src.match(/icon-star-rating(\d+)/);
          if (match && match[1]) extractedStar = parseInt(match[1], 10);
        }

        let extractedSubject = null;
        const readArea = doc.querySelector('.xans-board-read-4, .xans-board-read, #board_read');

        if (readArea) {
          const titleEl = readArea.querySelector('.title h3, .title h2, .title p, .boardView .title, td.subject');
          if (titleEl) {
            let tempTitle = titleEl.innerText.replace(/^제목\s*:?\s*/i, '').trim();
            // 개행 문자 분할 후 다중 공백 제거 압축
            tempTitle = tempTitle.split('\n')[0].replace(/\s+/g, ' ').trim(); 
            
            if (tempTitle.length > 25) {
              extractedSubject = tempTitle.substring(0, 25) + '...';
            } else {
              extractedSubject = tempTitle;
            }
          }
        }

        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail');
        if (!contentArea) return { images: [], text: "", star: extractedStar, subject: extractedSubject };

        const extractedImages = [];
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

        return { images: extractedImages, text: contentArea.innerHTML.trim(), star: extractedStar, subject: extractedSubject };
      } catch (e) {
        return null;
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

        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            const container = document.getElementById('review-it-widget');
            if (container) container.style.display = 'none';
            return false;
          }
          throw new Error(`API 오류: ${res.status}`);
        }

        const list = await res.json();
        if (!list || list.length === 0) {
          const container = document.getElementById('review-it-widget');
          if (container) container.style.display = 'none';
          return false;
        }

        this.data = {};
        this.listOrder = [];

        await Promise.all(list.slice(0, this.settings.display_limit).map(async (r) => {
          const id = String(r.id);
          const separateData = await this._fetchAndSeparateContent(r.article_id || r.article_no, r.board_no);

          if (separateData) {
            r.clean_text_body = separateData.text || r.content;
            r.all_images = (separateData.images && separateData.images.length > 0)
              ? separateData.images
              : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.DEFAULT_IMG]);

            if (separateData.star !== null && !isNaN(separateData.star)) r.stars = separateData.star;
            if (separateData.subject && separateData.subject.trim().length > 0) {
              r.subject = separateData.subject;
            }
          } else {
            r.clean_text_body = r.content || "리뷰 본문이 없습니다.";
            r.all_images = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [CONFIG.DEFAULT_IMG];
          }

          // 💡 서브젝트 정제 백업 필터
          if (r.subject === "포토 리뷰입니다." || !r.subject) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = r.clean_text_body;
            let plainText = tempDiv.innerText.replace(/\s+/g, ' ').trim();
            if (plainText.length > 0) {
              r.subject = plainText.length > 25 ? plainText.substring(0, 25) + '...' : plainText;
            }
          }

          this.data[id] = r;
          this.listOrder.push(id);
        }));

        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));
        return true;
      } catch (e) {
        return false;
      }
    },

    renderWidget() {
      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (!container) return;

      const getFormattedTitle = (rawTitle) => {
        const text = rawTitle || 'PEOPLE CHOICE';
        const words = text.split(' ');
        if (words.length <= 1) return text;
        const lastWord = words.pop();
        const prefix = words.join(' ');
        return `${prefix} <span class="rit-title-point">${lastWord}</span>`;
      };

      const isGrid = this.settings.display_type === 'grid';
      const limit = this.settings.display_limit || 15;
      const reviews = this.listOrder.slice(0, limit);
      const pcCols = isGrid ? (parseInt(this.settings.grid_rows_desktop) || 5) : 5;
      const moCols = isGrid ? (parseInt(this.settings.grid_rows_mobile) || 2) : 2.2;

      let mainHtml = `
    <style>
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
    </style>

    <div class="rit-header-area" style="text-align:center; margin-bottom:30px;">
      <div class="rit-tagline" style="font-weight:700; text-transform:uppercase; letter-spacing:2px;">
        ${this.settings.tagline || 'Verified Authenticity'}
      </div>
      <h2 class="rit-main-title">
        ${getFormattedTitle(this.settings.title || 'People Choice')}
      </h2>
      <div class="rit-line" style="width:30px; height:1px; background:#cbcbcb; margin:15px auto;"></div>
      <p class="rit-desc" style="font-size:14px; color:#444; word-break:keep-all;">
        ${this.settings.description || '"당신의 선택에 확신을 더하는 기록"<br>텍스처부터 상세한 사용 후기까지, 실제 구매 고객들이 직접 경험하고 기록한 REVIEW-IT만의 생생한 리얼 피드를 확인해보세요.'}
      </p>
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

      if (!isGrid && window.Swiper) {
        const getSwiperConfig = () => {
          const isPc = window.innerWidth >= 1024;
          return {
            slidesPerView: isPc ? pcCols : moCols,
            spaceBetween: isPc ? 20 : 12,
            loop: true,
            speed: 5000,
            freeMode: true,
            freeModeMomentum: false,
            autoplay: { delay: 0, disableOnInteraction: false, pauseOnMouseEnter: true },
            allowTouchMove: true,
            grabCursor: true,
            observer: true,
            observeParents: true,
            roundLengths: true
          };
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
    
    <button class="rit-nav-btn rit-nav-prev" onclick="ReviewApp.navigateReview(-1)" style="position:fixed; left:3%; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:60px; cursor:pointer; color:#fff; z-index:9999; text-shadow: 0 4px 10px rgba(0,0,0,0.4);">&#10094;</button>
    <button class="rit-nav-btn rit-nav-next" onclick="ReviewApp.navigateReview(1)" style="position:fixed; right:3%; top:50%; transform:translateY(-50%); background:transparent; border:none; font-size:60px; cursor:pointer; color:#fff; z-index:9999; text-shadow: 0 4px 10px rgba(0,0,0,0.4);">&#10095;</button>

    <div class="rit-modal-window">
       <div class="rit-modal-header">
          <span class="rit-logo-text">${CONFIG.MALL_NAME}</span>
          <div class="rit-header-buttons">
            <button onclick="ReviewApp.toggleGrid()" class="btn-rit-grid">
            <svg viewBox="0 0 24 24">
                    <rect x="2" y="2" width="9" height="9" rx="1" />
                    <rect x="13" y="2" width="9" height="9" rx="1" />
                    <rect x="2" y="13" width="9" height="9" rx="1" />
                    <rect x="13" y="13" width="9" height="9" rx="1" />
                  </svg>GRID VIEW</button>
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
      const thumb = d.all_images[0] || CONFIG.DEFAULT_IMG;
      return `<div class="rit-card" onclick="ReviewApp.openModal('${id}')">
        <img src="${thumb}" class="rit-card-img" loading="lazy">
        <div class="rit-card-info">
          <div class="rit-card-subject line-clamp-2 break-keep">${d.subject}</div>
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

    async renderDetail(id) {
      this.currentReviewId = id;
      const d = this.data[id];
      const imgSide = document.getElementById('ritModalImg');
      const contentSide = document.getElementById('ritContent');

      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      contentSide.innerHTML = '<div class="rit-loading">리뷰를 불러오는 중입니다...</div>';

      if (!d.is_parsed) {
        const separateData = await this._fetchAndSeparateContent(d.article_id || d.article_no, d.board_no);
        if (separateData) {
          d.clean_text_body = separateData.text || d.content;
          d.all_images = (separateData.images && separateData.images.length > 0) ? separateData.images : d.all_images;
        }
        d.is_parsed = true;
      }

      if (d.all_images && d.all_images.length > 0 && d.all_images[0] !== CONFIG.DEFAULT_IMG) {
        imgSide.innerHTML = `
      <div class="swiper rit-modal-swiper">
        <div class="swiper-wrapper">
          ${d.all_images.map(img => `<div class="swiper-slide"><img src="${img}" alt="review"></div>`).join('')}
        </div>
        <div class="rit-fraction"></div>
        <div class="swiper-button-next"></div><div class="swiper-button-prev"></div>
      </div>`;
        if (window.Swiper) {
          setTimeout(() => {
            new Swiper('.rit-modal-swiper', {
              pagination: { el: '.rit-fraction', type: 'fraction' },
              navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
              centeredSlides: true, loop: d.all_images.length > 1
            });
          }, 50);
        }
      } else {
        imgSide.innerHTML = `<div class="rit-no-image"><span>REVIEW-IT</span></div>`;
      }

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-meta-container">
          <div class="rit-meta-top">
            <span class="rit-author">${this.maskName(d.writer)}</span> 
            <span class="rit-date">${d.created_at ? d.created_at.split('T')[0] : ''}</span>
            <div class="rit-stars-gold"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" class="rit-star-img"></div>
          </div>
        </div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      contentSide.innerHTML = d.clean_text_body || "본문이 없습니다.";

      this.loadComments(d.article_id || d.article_no, d.board_no);
    },

    navigateReview(direction) {
      const currentIndex = this.listOrder.indexOf(this.currentReviewId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = this.listOrder.length - 1;
      if (nextIndex >= this.listOrder.length) nextIndex = 0;

      this.renderDetail(this.listOrder[nextIndex]);
    },

    toggleGrid() {
      const gv = document.getElementById('ritGridView');
      const gi = document.getElementById('ritGridInner');
      if (gv.classList.contains('rit-hidden')) {
        gv.classList.remove('rit-hidden');
        gi.innerHTML = this.listOrder.map(id => `<div class="rit-grid-thumb" onclick="ReviewApp.renderDetail('${id}')"><img src="${this.data[id].all_images[0]}"></div>`).join('');
      } else { gv.classList.add('rit-hidden'); }
    },

    async loadComments(articleNo, boardNo) {
      const commContainer = document.getElementById('ritCommList');
      if (!commContainer) return;
      commContainer.innerHTML = '<div style="padding:15px; text-align:center; font-size:12px; color:#999; border-top:1px solid #eee; margin-top:20px;">댓글 연결 중...</div>';

      try {
        const res = await fetch(`/board/product/read.html?board_no=${boardNo}&no=${articleNo}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const selectors = ['.xans-board-commentlist li', '.boardComment li', '.commentList li', '.replyArea li', '[class*="comment"] li'].join(', ');
        const commentRows = doc.querySelectorAll(selectors);

        const comments = Array.from(commentRows).map(el => {
          let writer = (el.querySelector('.name, .writer, strong')?.innerText || "고객").trim();

          const isAdminBadge = el.querySelector('img[src*="admin"], img[src*="staff"]');
          if (isAdminBadge || CONFIG.ADMIN_KEYWORDS.some(k => writer.includes(k))) {
            writer = CONFIG.MALL_NAME;
          } else {
            writer = this.maskName(writer);
          }

          const content = (el.querySelector('.comment, .content, span[id^="comment_"]')?.innerText || "").trim();
          const date = (el.querySelector('.date')?.innerText || "").trim();
          return { writer, content, date };
        }).filter(c => c.content.length > 0 && !c.content.includes('비밀번호'));

        this.renderComments(comments, articleNo, boardNo);
      } catch (e) { commContainer.innerHTML = ''; }
    },

    renderComments(comments, articleNo, boardNo) {
      const container = document.getElementById('ritCommList');
      if (!container) return;

      const detailUrl = `/board/product/read.html?board_no=${boardNo}&no=${articleNo}`;
      const headerHtml = `
        <div class="rit-comm-head" style="margin-top:25px; border-top:1px solid #eee; padding-top:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:flex-end;">
          <h4 style="font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#111; margin:0;">Comments <span style="color:#999; font-weight:normal;">(${comments.length})</span></h4>
          <a href="${detailUrl}" target="_blank" style="font-size:10px; color:#999; text-decoration:underline; text-underline-offset:4px;">리뷰 원문보기</a>
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
        const isOfficial = c.writer === CONFIG.MALL_NAME;
        const fontColor = isOfficial ? '#000' : '#111';
        const bgStyle = isOfficial ? 'background:#f0f4f8; border:1px solid #e2e8f0;' : 'background:#f9f9f9; border:1px solid transparent;';

        return `
        <div class="rit-comm-item" style="margin-bottom:10px; ${bgStyle} padding:14px; border-radius:10px; font-size:12px;">
          <div style="font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:${fontColor};">${c.writer} ${isOfficial ? '✓' : ''}</span>
            <span style="font-weight:400; color:#bbb; font-size:11px;">${c.date}</span>
          </div>
          <div style="color:#444; font-weight:400; line-height:1.5;">${c.content}</div>
        </div>
      `;
      }).join('');
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