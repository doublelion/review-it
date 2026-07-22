/**
 * @Project: Review-It Universal Widget Engine v1.0.8
 * @Update: 리스트 엔진 종속성(ReviewApp) 유지를 위한 return 차단 해제 및 고정 폴백 리뷰 수 적용
 */
(function (window) {
  console.log("▶ [REVIEW-IT] 프론트엔드 스크립트 로드 완료!");

  const currentPath = window.location.pathname.toLowerCase();
  const currentSearch = window.location.search.toLowerCase();

// 💡 [수정] 상품 상세 페이지(detail.html) 및 게시판 상세/작성 페이지 완벽 차단
  const isProductDetailPage = currentPath.includes('/product/detail.html');
  const isBoardReadPage = currentPath.includes('/board/product/read.html') || currentSearch.includes('no=');
  const isWriteOrModify = currentPath.includes('write.html') || currentPath.includes('modify.html');

  // 🚨 차단 대상 페이지 전역 플래그 세팅 (상세, 게시판, 글쓰기 모두 차단)
  const isBlockedPage = isProductDetailPage || isBoardReadPage || isWriteOrModify;

  const isBoardPage = currentPath.includes('/board/') || currentPath.includes('상품-사용후기');
  
  const isReadOrWrite = currentPath.includes('read.html') || currentPath.includes('write.html') || currentPath.includes('modify.html') || currentSearch.includes('no=');

  if (isBoardPage) {
    const isReviewList = currentPath.includes('/board/product/list') || currentPath.includes('상품-사용후기') || (currentSearch.includes('board_no=4') || currentPath.includes('/4/'));

    // 리스트 게시판일 때만 리스트 엔진 호출 (캐시 무효화 포함)
    if (isReviewList && !isReadOrWrite) {
      if (!document.getElementById('rit-list-script')) {
        console.log("▶ [REVIEW-IT] 리뷰 리스트 게시판 감지! 최신 review-list.js를 동적으로 호출합니다.");
        const script = document.createElement('script');
        script.id = 'rit-list-script';
        script.src = `https://review-it-tau.vercel.app/review-list.js?v=${new Date().getTime()}`;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }

  // 🚨 2. [Ghost Killer] 게시판 상세/작성 페이지는 하드코딩 뼈대가 있어도 3초간 감시하며 강제 파괴!
  if (isBoardPage && isReadOrWrite) {
    console.log("▶ [REVIEW-IT Widget] 예외 페이지 진입 -> 3초간 위젯 뼈대를 강력 감시 및 파괴합니다.");
    const killWidget = () => {
      document.querySelectorAll('#review-it-widget, #rit-widget-container, .rit-list-container').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.innerHTML = '';
      });
    };

    killWidget(); // 1차 즉시 파괴
    window.addEventListener('DOMContentLoaded', killWidget); // 2차 DOM 파괴
    const killerInterval = setInterval(killWidget, 200); // 3차 0.2초 간격 무한 파괴
    setTimeout(() => clearInterval(killerInterval), 3000); // 3초 후 감시 종료

    return; // ⭐️ 위젯 렌더링 엔진 완전 정지
  }

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
    const finalMallId = cafe24MallId || fallbackMallId || 'default_mall';

    console.log("▶ [REVIEW-IT Widget] 매핑된 상점 Mall ID:", finalMallId);

    const getProductNo = () => {
      if (typeof window.iProductNo !== 'undefined' && window.iProductNo) return window.iProductNo;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('product_no') || null;
    };

    const getMallName = () => {
      if (window.iMallName && window.iMallName !== "") return window.iMallName;

      const ogSiteName = document.querySelector('meta[property="og:site_name"]');
      if (ogSiteName && ogSiteName.content) return ogSiteName.content.trim();

      let title = document.title || "";
      if (title.includes('-')) {
        const parts = title.split('-');
        title = parts[parts.length - 1].trim();
      } else if (title.includes(':')) {
        title = title.split(':')[0].trim();
      }

      title = title.replace(/공식몰|공식홈페이지|온라인스토어/g, "").trim();

      if (title.length > 15) {
        title = title.substring(0, 15) + '...';
      }

      return title || "REVIEW-IT";
    };

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: finalMallId,
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
      is_header_enabled: true,
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
      // 🛑 차단 대상 페이지라면 어떠한 경우에도 뼈대를 생성하지 않음!
      if (typeof isBlockedPage !== 'undefined' && isBlockedPage) return;

      let container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (container) return;

      const pathname = decodeURIComponent(window.location.pathname);
      const isMainPage = pathname === '/' || pathname === '/index.html';

      // 💡 [핵심] 오직 메인 페이지에서만 위젯 뼈대를 자동 생성 (Zero Setup)
      if (!isMainPage) return;

      container = document.createElement('div');
      container.id = 'review-it-widget';
      container.style.marginTop = '80px';
      container.style.marginBottom = '80px';

      const mainContent = document.querySelector('#contents') || document.querySelector('.xans-product-listmain') || document.querySelector('#wrap');
      const footer = document.querySelector('#footer');

      if (mainContent) {
        mainContent.appendChild(container);
      } else if (footer) {
        document.body.insertBefore(container, footer);
      } else {
        document.body.appendChild(container);
      }

      if (document.getElementById('review-it-widget')) this.renderSkeleton(container);
    },

    async init() {
      // 🚨 [강력 차단] 상품 상세 또는 게시판 상세 페이지 진입 시, 하드코딩된 태그가 있어도 숨기고 실행 종료!
      if (typeof isBlockedPage !== 'undefined' && isBlockedPage) {
        const hardcodedContainer = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
        if (hardcodedContainer) {
          hardcodedContainer.style.setProperty('display', 'none', 'important');
          hardcodedContainer.innerHTML = '';
        }
        console.log("▶ [REVIEW-IT Widget] 예외 페이지(/detail.html, /read.html 등) 진입 -> 위젯 강제 차단");
        return;
      }

      // 💡 메인 페이지 자동 노출 로직 실행
      this.autoCreateContainer();

      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');

      if (!container) {
        console.log("▶ [REVIEW-IT] 메인 페이지가 아니거나 뼈대가 없으므로 위젯 생성을 안전하게 스킵합니다.");
        return;
      }

      this.injectCSS();
      // 뼈대가 갓 생성되어 비어있다면 스켈레톤 먼저 렌더링
      if (container.innerHTML.trim() === '') this.renderSkeleton(container);
      
      await this.loadWidgetSettings();
      const hasReviews = await this.loadReviews();

      if (!hasReviews) {
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
            if (s[key] !== undefined && s[key] !== null) {
              if (key === 'is_header_enabled') {
                this.settings[key] = s[key];
              } else {
                let dbValue = String(s[key]).trim();
                // 💡 [트윅 1] DB 값이 대문자 'EMPTY'이거나 실제 공백/빈 문자열이면 명시적 빈 값("")으로 세팅
                if (dbValue === "" || dbValue === "EMPTY") {
                  this.settings[key] = "";
                } else {
                  this.settings[key] = (key === 'description') ? String(s[key]).replace(/\n/g, '<br>') : String(s[key]);
                }
              }
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 기본 설정을 유지합니다."); }
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
        if (!res.ok) throw new Error("Network response was not ok");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        let extractedStar = null;
        const starImg = doc.querySelector('img[src*="icon-star-rating"]');
        if (starImg) {
          const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
          if (match && match[1]) extractedStar = parseInt(match[1], 10);
        }

        const readArea = doc.querySelector('.xans-board-read-4, .xans-board-read, #board_read');
        let extractedSubject = null;
        let extractedDate = null;
        let extractedWriter = null;

        if (readArea) {
          const titleEl = readArea.querySelector('.head h3, .head h2, .title h3, .title h2, .title p, .boardView .title, td.subject');
          if (titleEl) {
            let tempTitle = titleEl.innerText.replace(/^제목\s*:?\s*/i, '').trim();
            extractedSubject = tempTitle.split('\n')[0].replace(/\s+/g, ' ').trim();
          }

          const dateEl = readArea.querySelector('.date, .write-date, td.date, .info .date, .boardView .date');
          if (dateEl) {
            const rawDate = dateEl.innerText.trim();
            const dateMatch = rawDate.match(/\d{4}\s*[-./]\s*\d{2}\s*[-./]\s*\d{2}/);
            if (dateMatch) extractedDate = dateMatch[0].replace(/\s/g, '').replace(/[\./]/g, '-');
          }

          const writerEl = readArea.querySelector('.description .name, .head .name, .xans-board-read .name, .xans-board-read .writer, .boardView .name');
          if (writerEl) {
            const clone = writerEl.cloneNode(true);
            const hidden = clone.querySelector('.displaynone');
            if (hidden) hidden.remove();
            extractedWriter = clone.innerText.replace(/\(ip:.*\)/gi, '').trim();
          }
        }

        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail');
        const attachArea = doc.querySelector('.attachedImage, .thumbnail, ul.thumbnail, .boardView .attach');

        if (!contentArea && !attachArea) {
          return { images: [], text: "", star: extractedStar, subject: extractedSubject, date: extractedDate, writer: extractedWriter };
        }

        const extractedImages = [];
        const uniqueSet = new Set();

        const processImage = (src, elToRemove = null) => {
          if (!src || CONFIG.SPAM_KEYWORDS.test(src) || src.includes('.gif') || src.includes('blank')) {
            if (elToRemove) elToRemove.remove();
            return;
          }
          let finalSrc = src.replace(/\/(tiny|small|medium)\//gi, '/big/');
          finalSrc = finalSrc.startsWith('//') ? 'https:' + finalSrc : (finalSrc.startsWith('/') ? window.location.origin + finalSrc : finalSrc);

          if (!uniqueSet.has(finalSrc)) {
            uniqueSet.add(finalSrc);
            extractedImages.push(finalSrc);
          }
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

        if (attachArea) {
          attachArea.querySelectorAll('img').forEach(img => processImage(img.getAttribute('src'), img));
          attachArea.remove();
        }

        let cleanText = contentArea ? contentArea.innerHTML.trim() : "";
        if (cleanText === "" && extractedImages.length > 0) {
          cleanText = "포토 리뷰입니다.";
        }

        return {
          images: extractedImages,
          text: cleanText,
          star: extractedStar,
          subject: extractedSubject,
          date: extractedDate,
          writer: extractedWriter
        };
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
            console.error(`[REVIEW-IT] 접근 거부(403/401): 결제 만료 또는 유효하지 않은 상점입니다.`);
            return false;
          }
          throw new Error(`API 오류: ${res.status}`);
        }

        const list = await res.json();
        if (!list || list.length === 0) {
          const container = document.getElementById('review-it-widget');
          if (container) container.style.display = 'none';
          console.warn(`[REVIEW-IT] 노출할 리뷰 데이터가 DB에 없습니다.`);
          return false;
        }

        this.data = {};
        this.listOrder = [];

        await Promise.all(list.slice(0, this.settings.display_limit).map(async (r) => {
          const id = String(r.id);
          const separateData = await this._fetchAndSeparateContent(r.article_no, r.board_no);

          if (separateData) {
            r.clean_text_body = separateData.text || r.content;
            r.all_images = (separateData.images && separateData.images.length > 0)
              ? separateData.images
              : (r.image_urls && r.image_urls.length > 0 ? r.image_urls : [CONFIG.DEFAULT_IMG]);

            if (separateData.star !== null && !isNaN(separateData.star)) r.stars = separateData.star;
            if (separateData.subject && separateData.subject.trim().length > 0) {
              r.subject = separateData.subject;
            }
            if (separateData.date) {
              r.original_date = separateData.date;
            }
            if (separateData.writer) {
              r.author_name = separateData.writer;
            }
          } else {
            r.clean_text_body = r.content || "리뷰 본문이 없습니다.";
            r.all_images = (r.image_urls && r.image_urls.length > 0) ? r.image_urls : [CONFIG.DEFAULT_IMG];
          }

          if (r.subject === "포토 리뷰입니다." || !r.subject) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = r.clean_text_body;
            let plainText = tempDiv.innerText.replace(/\s+/g, ' ').trim();
            if (plainText.length > 0) {
              r.subject = plainText;
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
        const text = rawTitle || '';
        if (!text) return '';
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

    <!-- 💡 [트윅 2] 과도한 연산자(||) 제거하여 DB에서 세팅한 명시적 빈 문자열을 온전히 렌더링하도록 처리 -->
    ${this.settings.is_header_enabled !== false
          ? `<div class="rit-header-area" style="text-align:center; margin-bottom:30px;">
              ${this.settings.tagline ? `<div class="rit-tagline" style="font-weight:700; text-transform:uppercase; letter-spacing:2px; margin-bottom:5px;">${this.settings.tagline}</div>` : ''}
              ${this.settings.title ? `<h2 class="rit-main-title" style="margin:0;">${getFormattedTitle(this.settings.title)}</h2>` : ''}
              ${(this.settings.tagline || this.settings.title) ? `<div class="rit-line" style="width:30px; height:1px; background:#cbcbcb; margin:15px auto;"></div>` : ''}
              ${this.settings.description ? `<p class="rit-desc" style="font-size:14px; color:#444; word-break:keep-all; margin:0 auto; max-width:80%;">${this.settings.description}</p>` : ''}
             </div>`
          : ''
        }

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
            // 슬라이드 개수가 적을 때 루프가 멈추는 버그 방지 (선택 사항이나 권장)
            loopedSlides: isPc ? pcCols * 2 : moCols * 2,
            speed: 4000, // 롤링 속도 (5000은 터치 후 복귀 시 다소 답답할 수 있어 4000 권장)

            // freeMode는 delay:0 방식과 충돌을 일으키므로 false로 두는 것이 훨씬 자연스럽습니다.
            freeMode: false,

            autoplay: {
              delay: 0,
              disableOnInteraction: false, // 드래그 후에도 계속 자동 재생
              pauseOnMouseEnter: true // PC 환경에서 마우스 오버 시 멈춤 (사용성 증가)
            },

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

        // 백그라운드(다른 탭) 이동 후 돌아왔을 때 스와이퍼가 멈춰있는 버그 해결
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            // 탭을 벗어나면 애니메이션 일시 정지 (리소스 절약 및 꼬임 방지)
            if (ritSwiper && ritSwiper.autoplay) ritSwiper.autoplay.stop();
          } else {
            // 탭으로 돌아오면 재시작
            if (ritSwiper && ritSwiper.autoplay) ritSwiper.autoplay.start();
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
                <h3 id="ritSubject" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; word-break: keep-all; margin-bottom: 15px;"></h3>
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
      const displayName = d.author_name ? d.author_name : (d.writer || '고객');

      // 💡 [완전 삭제 및 실제 데이터 연동] 가짜 폴백 로직(stableRandomCount) 전면 제거
      const avgScore = d.product_avg_score || d.stars || 5;
      const revCount = d.product_review_count; // 오직 DB의 실제 데이터만 받음

      // 💡 실제 데이터가 없으면(|) 기호와 숫자 자체를 렌더링하지 않음
      const reviewCountHtml = revCount ? `<span style="color:#e4e4e7; margin:0 2px;">|</span><span style="font-weight:500; color:#71717a;">리뷰 ${revCount.toLocaleString()}</span>` : '';

      return `
      <div class="rit-card" onclick="ReviewApp.openModal('${id}')" style="position: relative; overflow: hidden; display: flex; flex-direction: column; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background:#fff;">
        <div class="rit-card-img-container" style="position: relative; width: 100%; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; z-index: 2; overflow: hidden; background: rgba(0,0,0,0.02);">
          <img src="${thumb}" class="rit-card-img" loading="lazy" 
              onerror="this.onerror=null; this.src='${CONFIG.DEFAULT_IMG}';"
              style="max-width: 100%; max-height: 100%; object-fit: cover; width: 100%; height: 100%; transition: transform 0.3s ease;">
        </div>
        <div class="rit-card-info" style="position: relative; z-index: 3; background: #fff; padding: 15px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:5px; margin-bottom:8px; font-size:11px; font-weight:700; color:#52525b;">
             <span style="color:#fbbf24;">★</span>
             <span>${Number(avgScore).toFixed(1)}</span>
             ${reviewCountHtml}
          </div>
          <div class="rit-card-subject line-clamp-2 break-keep" style="font-size: 13px; line-height: 1.4; color: #222; margin-bottom: 10px; font-weight: 500;">${d.subject}</div>
          <div class="rit-card-meta" style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #888;">${displayName}</span>
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
      const updatedDisplayName = d.author_name ? d.author_name : (d.writer || '고객');

      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';
      contentSide.innerHTML = '<div class="rit-loading">리뷰를 불러오는 중입니다...</div>';

      if (!d.is_parsed) {
        const separateData = await this._fetchAndSeparateContent(d.article_no, d.board_no);
        if (separateData) {
          d.clean_text_body = separateData.text || d.content;
          d.all_images = (separateData.images && separateData.images.length > 0) ? separateData.images : d.all_images;
          if (separateData.date) d.original_date = separateData.date;
          if (separateData.writer) d.author_name = separateData.writer;
        }
        d.is_parsed = true;
      }

      // ... (renderDetail 상단 로직 유지) ...

      if (d.all_images && d.all_images.length > 0 && d.all_images[0] !== CONFIG.DEFAULT_IMG) {
        imgSide.innerHTML = `
      <div class="swiper rit-modal-swiper" style="width:100%; height:100%;">
        <div class="swiper-wrapper">
          ${d.all_images.map(img => `
            <div class="swiper-slide" style="position: relative; overflow: hidden; background: #000; display:flex; align-items:center; justify-content:center; width: 100% !important; box-sizing: border-box;">
              <div style="position: absolute; inset: -20px; background-image: url('${img}'); background-size: cover; background-position: center; filter: blur(20px); opacity: 0.4; pointer-events: none;"></div>
              <img src="${img}" alt="review" 
                   onerror="this.src='${CONFIG.DEFAULT_IMG}'; this.style.filter='none'; this.previousElementSibling.style.display='none';" 
                   style="position: relative; max-width: 100%; max-height: 100%; object-fit: contain; z-index: 1;">
            </div>
          `).join('')}
        </div>
        <div class="rit-fraction"></div>
        <div class="swiper-button-next"></div><div class="swiper-button-prev"></div>
      </div>`;

        if (window.Swiper) {
          // 🛑 [긴급 픽스] 기존에 열려있던 좀비 스와이퍼 인스턴스 파괴 (충돌 방지)
          if (window.ritActiveModalSwiper) {
            window.ritActiveModalSwiper.destroy(true, true);
          }

          // DOM이 완전히 그려질 틈을 주기 위한 미세 딜레이
          setTimeout(() => {
            window.ritActiveModalSwiper = new Swiper('.rit-modal-swiper', {
              pagination: { el: '.rit-fraction', type: 'fraction' },
              navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
              centeredSlides: true,
              loop: d.all_images.length > 1,
              // 🛑 [긴급 픽스] 모달 창 내부에서 Swiper를 쓸 때 필수인 동적 감지 옵션
              observer: true,
              observeParents: true,
              resizeObserver: true
            });
          }, 50);
        }
      } else {
        imgSide.innerHTML = `<div class="rit-no-image"><span>REVIEW-IT</span></div>`;
      }

      const displayDate = d.original_date ? d.original_date : (d.created_at ? d.created_at.split('T')[0] : '');

      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-meta-container">
          <div class="rit-meta-top">
            <span class="rit-author">${updatedDisplayName}</span> 
            <span class="rit-date">${displayDate}</span>
            <div class="rit-stars-gold"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" class="rit-star-img"></div>
          </div>
        </div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      contentSide.innerHTML = d.clean_text_body || "본문이 없습니다.";

      this.loadComments(d.article_no, d.board_no, d);
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
        gi.innerHTML = this.listOrder.map(id => {
          const imgUrl = this.data[id].all_images[0] || CONFIG.DEFAULT_IMG;
          return `<div class="rit-grid-thumb" onclick="ReviewApp.renderDetail('${id}')">
          <img src="${imgUrl}" onerror="this.onerror=null; this.src='${CONFIG.DEFAULT_IMG}';">
        </div>`;
        }).join('');
      } else { gv.classList.add('rit-hidden'); }
    },

    async loadComments(articleNo, boardNo, currentReviewData) {
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
          let isOfficial = false;

          const isAdminBadge = el.querySelector('img[src*="admin"], img[src*="staff"]');
          if (isAdminBadge || CONFIG.ADMIN_KEYWORDS.some(k => writer.includes(k)) || writer.includes(CONFIG.MALL_NAME) || CONFIG.MALL_NAME.includes(writer.replace(/\*/g, ''))) {
            isOfficial = true;
          } else {
            writer = this.maskName(writer);
          }

          const content = (el.querySelector('.comment, .content, span[id^="comment_"]')?.innerText || "").trim();
          const date = (el.querySelector('.date')?.innerText || "").trim();
          return { writer, content, date, isOfficial };
        }).filter(c => c.content.length > 0 && !c.content.includes('비밀번호'));

        // 💡 렌더링 함수로 리뷰 데이터(currentReviewData) 전달
        this.renderComments(comments, articleNo, boardNo, currentReviewData);
      } catch (e) { commContainer.innerHTML = ''; }
    },

    renderComments(comments, articleNo, boardNo, currentReviewData) {
      const container = document.getElementById('ritCommList');
      if (!container) return;

      // 🚨 [긴급 픽스] 임의의 11번 매핑 완전 제거. 실제 상품 번호가 있을 때만 버튼 렌더링
      const productNo = currentReviewData?.product_no || currentReviewData?.product_id;
      let shoppableBtnHtml = '';

      if (productNo && productNo !== '11') { // (기존 11번 캐싱 데이터 방어)
        const productUrl = `/product/detail.html?product_no=${productNo}`;
        const productImg = currentReviewData?.product_img || (currentReviewData?.all_images && currentReviewData.all_images[0]) || CONFIG.DEFAULT_IMG;

        shoppableBtnHtml = `
          <a href="${productUrl}" target="_self" style="display:flex; align-items:center; gap:6px; background:#f8fafc; padding:5px 12px; border-radius:6px; border:1px solid #f1f5f9; text-decoration:none; transition:all 0.2s;">
             <img src="${productImg}" style="width:16px; height:16px; border-radius:3px; object-fit:cover;">
             <span style="font-size:10.5px; font-weight:700; color:#475569;">상품 보기 〉</span>
          </a>
        `;
      }

      const headerHtml = `
        <div class="rit-comm-head" style="margin-top:25px; border-top:1px solid #eee; padding-top:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#111; margin:0;">Comments <span style="color:#999; font-weight:normal;">(${comments.length})</span></h4>
          ${shoppableBtnHtml}
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