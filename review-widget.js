/**
 * @Project: Review-It Universal Widget Engine v1.0.0
 * @Update: 
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

    // 카페24 상점명 가져오기
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
      MALL_ID: mallId,
      PRODUCT_NO: getProductNo(),
      BOARD_NO: '4',
      // DEFAULT_IMG: '//img.echosting.cafe24.com/thumb/img_product_medium.gif',
      DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg',
      STAR_PATH: '//img.echosting.cafe24.com/skin/skin/board/icon-star-rating',
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|star_fill|star_empty|rating|clear/i,
      ADMIN_KEYWORDS: ['관리자', 'Official', '운영자'],
      MALL_NAME: getMallName()
    };
  };

  const CONFIG = getDynamicConfig();

  const ReviewApp = {
    data: {},
    listOrder: [],
    settings: {
      display_type: 'grid',
      tagline: 'Verified Authenticity', // 부제목 업데이트
      title: 'People Choice',           // 제목 업데이트
      description: '"당신의 선택에 확신을 더하는 기록"<br>텍스처부터 상세한 사용 후기까지, 실제 구매 고객들이 직접 경험하고 기록한 REVIEW-IT만의 생생한 리얼 피드를 확인해보세요.', // 디스크립션 업데이트
      display_limit: 15,
      grid_rows_desktop: 5,
      grid_rows_mobile: 2
    },

    async init() {
      this.injectCSS();
      await this.loadWidgetSettings();
      const hasReviews = await this.loadReviews(); // 반환값 확인

      // 리뷰 데이터가 하나도 없거나 RLS로 차단된 경우(앱 삭제 등) 렌더링 중단 및 숨김 처리
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
            // DB에 값이 실제 존재할 때만 덮어쓰고, 아니면 기존 settings(기본값) 유지
            if (s[key] !== undefined && s[key] !== null && String(s[key]).trim() !== "") {
              this.settings[key] = (key === 'description') ? s[key].replace(/\n/g, '<br>') : s[key];
            }
          });
        }
      } catch (e) { console.warn("[REVIEW-IT] 기본 설정을 유지합니다."); }
    },

    maskName(name) {
      if (!name || name === "고객") return "고객";
      // 운영자 키워드가 포함되어 있으면 마스킹 없이 원본 그대로 반환
      if (CONFIG.ADMIN_KEYWORDS.some(k => name.includes(k))) return name;

      // 일반 고객만 마스킹 처리
      return name.length > 1 ? name.charAt(0) + "*".repeat(name.length - 1) : name;
    },

    // 이미지와 텍스트 분리 로직 강화
    async _fetchAndSeparateContent(articleNo) {
      try {
        const res = await fetch(`/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`);
        if (!res.ok) throw new Error("Network response was not ok");

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // [긴급 패치] 별점 이미지에서 숫자 파싱
        let extractedStar = null;
        const starImg = doc.querySelector('img[src*="icon-star-rating"]');
        if (starImg) {
          // icon-star-rating2.svg 에서 '2' 추출
          const match = starImg.src.match(/icon-star-rating(\d+)/);
          if (match && match[1]) {
            extractedStar = parseInt(match[1], 10);
          }
        }

        // 셀렉터 확장 (카페24 구버전/신버전/커스텀 스킨 대응)
        const contentArea = doc.querySelector('.view_content_raw, .detailField, .boardContent, .content-area, #board_read_content, .detail .fr-view, .detail, .v2-board-read-content');

        // contentArea가 없더라도 별점은 찾았을 수 있으므로 별점도 반환
        if (!contentArea) return { images: [], text: "", star: extractedStar };

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
          text: contentArea.innerHTML.trim(),
          star: extractedStar // 별점 데이터 추가 반환
        };
      } catch (e) {
        console.warn("[REVIEW-IT] 상세 페이지 파싱 실패, articleNo:", articleNo, e);
        return null;
      }
    },

    // 1. 위젯 소스코드 : 완전 무결한 이미지 필터링 & 본문 이미지 강제 구출 로직 적용
    async loadReviews() {
      try {
        let apiUrl = `${CONFIG.URL}/rest/v1/reviews?mall_id=eq.${CONFIG.MALL_ID}&is_visible=eq.true`;
        if (CONFIG.PRODUCT_NO) apiUrl += `&product_no=eq.${CONFIG.PRODUCT_NO}`;
        apiUrl += `&order=created_at.desc`;

        // 1. API 호출 (여기서 res가 최초로 정의됩니다)
        const res = await fetch(apiUrl, {
          headers: { 'apikey': CONFIG.KEY, 'Authorization': `Bearer ${CONFIG.KEY}` }
        });

        // 2. 상태 코드 검사 (403 에러 시 즉시 은폐)
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            console.warn("[REVIEW-IT] 이용 기간 만료 또는 앱 삭제됨. 위젯 영역을 숨깁니다.");
            const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
            if (container) container.style.display = 'none'; 
            return false;
          }
          throw new Error(`API 오류: ${res.status}`);
        }

        const list = await res.json();

        // 💡 [추가 방어] RLS 정책에 의해 빈 배열([])이 반환될 경우의 은폐 로직
        if (!list || list.length === 0) {
          console.warn("[REVIEW-IT] 표시할 리뷰가 없거나 RLS 정책에 의해 차단되었습니다.");
          const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
          if (container) container.style.display = 'none';
          return false;
        }

        this.data = {};
        this.listOrder = [];

        await Promise.all(list.slice(0, this.settings.display_limit).map(async (r) => {
          const id = String(r.id);

          // 1. 실시간 파싱 시도
          const separateData = await this._fetchAndSeparateContent(r.article_no);

          if (separateData) {
            r.clean_text_body = separateData.text || r.content;
            r.all_images = (separateData.images && separateData.images.length > 0)
              ? separateData.images
              : (r.image_url ? [r.image_url] : [CONFIG.DEFAULT_IMG]);

            if (separateData.star !== null && !isNaN(separateData.star)) {
              r.stars = separateData.star;
            }
          } else {
            // 파싱 자체가 실패한 경우 DB 데이터 사용
            r.clean_text_body = r.content || "리뷰 본문이 없습니다.";
            r.all_images = (r.image_url) ? [r.image_url] : [CONFIG.DEFAULT_IMG];
          }

          this.data[id] = r;
          this.listOrder.push(id);
        }));

        this.listOrder.sort((a, b) => new Date(this.data[b].created_at) - new Date(this.data[a].created_at));

        return true; 

      } catch (e) {
        console.error("[REVIEW-IT] 데이터 처리 에러:", e);
        return false;
      }
    },

    renderWidget() {
      const container = document.getElementById('review-it-widget') || document.getElementById('rit-widget-container');
      if (!container) return;

      // 타이틀 분리 로직
      const getFormattedTitle = (rawTitle) => {
        const text = rawTitle || 'PEOPLE CHOICE';
        const words = text.split(' ');
        if (words.length <= 1) return text; // 단어가 하나면 그대로 반환

        const lastWord = words.pop(); // 마지막 단어 추출
        const prefix = words.join(' '); // 나머지 단어들
        return `${prefix} <span class="rit-title-point">${lastWord}</span>`;
      };

      const isGrid = this.settings.display_type === 'grid';
      const limit = this.settings.display_limit || 15;
      const reviews = this.listOrder.slice(0, limit);

      const pcCols = isGrid ? (parseInt(this.settings.grid_rows_desktop) || 5) : 5;
      const moCols = isGrid ? (parseInt(this.settings.grid_rows_mobile) || 2) : 2.2;

      let mainHtml = `
    <style>
      /* 포인트 스타일: CSS 파일이나 인라인에서 조절 가능 */
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

      // 카페24 구버전 Swiper 호환성 해결 로직 (v9.4 계승)
      if (!isGrid && window.Swiper) {
        const getSwiperConfig = () => {
          const isPc = window.innerWidth >= 1024;
          return {
            slidesPerView: isPc ? pcCols : moCols,
            spaceBetween: isPc ? 20 : 12,
            loop: true, // 무한 루프를 위해 필수
            speed: 5000, // 전환 속도를 매우 길게 설정하여 아주 천천히 흐르게 함

            // --- 가장 자연스러운 흐름을 위한 설정 ---
            autoplay: {
              delay: 0, // 멈추는 시간 없이 즉시 전환
              disableOnInteraction: false, // 고객이 터치해도 다시 자동으로 흐름
              pauseOnMouseEnter: true, // 마우스 올리면 정지(가독성)
              waitForTransition: false
            },
            allowTouchMove: true, // 고객이 직접 넘겨볼 수 있음
            grabCursor: true,
            // ------------------------------------

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

    // 2. initModal 교체: 화살표를 모달 밖으로 빼고 4배(60px)로 확대
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

    // 3. renderDetail 교체: 지연 로딩(Lazy Fetch) 적용 및 현재 ID 트래킹
    async renderDetail(id) {
      this.currentReviewId = id; // 네비게이션을 위한 현재 ID 저장
      const d = this.data[id];
      const imgSide = document.getElementById('ritModalImg');
      const contentSide = document.getElementById('ritContent');

      document.getElementById('ritGridView').classList.add('rit-hidden');
      document.getElementById('ritDetailView').style.display = 'flex';

      // 파싱 전 로딩 처리
      contentSide.innerHTML = '<div class="rit-loading">리뷰를 불러오는 중입니다...</div>';

      // 한 번도 파싱하지 않은 리뷰일 경우에만 fetch 실행
      if (!d.is_parsed) {
        const separateData = await this._fetchAndSeparateContent(d.article_no);
        if (separateData) {
          d.clean_text_body = separateData.text || d.content;
          d.all_images = (separateData.images && separateData.images.length > 0) ? separateData.images : d.all_images;
        }
        d.is_parsed = true; // 완료 캐싱
      }

      // 이미지 렌더링
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

      // 텍스트 및 메타 렌더링
      const hits = d.hit_count || d.hit || Math.floor(Math.random() * 50) + 1;
      document.getElementById('ritMetaArea').innerHTML = `
        <div class="rit-meta-container">
          <div class="rit-meta-top">
            <span class="rit-author">${this.maskName(d.writer)}</span> <span class="rit-date">${d.created_at.split('T')[0]}</span>
            <div class="rit-stars-gold"><img src="${CONFIG.STAR_PATH}${d.stars || 5}.svg" class="rit-star-img"></div>
          </div>
        </div>`;
      document.getElementById('ritSubject').innerText = d.subject;
      contentSide.innerHTML = d.clean_text_body || "본문이 없습니다.";

      this.loadComments(d.article_no);
    },
    // 4. 신규 함수: 이전/다음 리뷰 탐색 (단순 배열 인덱스 활용)
    navigateReview(direction) {
      const currentIndex = this.listOrder.indexOf(this.currentReviewId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex + direction;
      // 끝에 도달하면 처음/마지막으로 루프 처리
      if (nextIndex < 0) nextIndex = this.listOrder.length - 1;
      if (nextIndex >= this.listOrder.length) nextIndex = 0;

      // 다음 리뷰 렌더링
      this.renderDetail(this.listOrder[nextIndex]);
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

    // 3. loadComments 교체: 게시글 번호(articleNo)를 렌더러로 전달
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

        // [수정] 원문 링크 생성을 위해 articleNo 같이 넘김
        this.renderComments(comments, articleNo);
      } catch (e) { commContainer.innerHTML = ''; }
    },

    // 4. renderComments 교체: 원문보기 링크 추가 및 담당자 ID 마스킹 해제
    renderComments(comments, articleNo) {
      const container = document.getElementById('ritCommList');
      if (!container) return;

      const detailUrl = `/board/product/read.html?board_no=${CONFIG.BOARD_NO}&no=${articleNo}`;

      // [수정] 요청하신 원문보기 HTML 디자인 적용 (헤더 부분)
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
        // 답변은 모두 담당자이므로 마스킹(maskName) 처리 제거
        const displayName = c.writer;
        const bgStyle = 'background:#f9f9f9; border:1px solid transparent;';
        //const label = '<span style="color:#111; font-weight:800; margin-right:5px;">[SHOP]</span>';

        return `
        <div class="rit-comm-item" style="margin-bottom:10px; ${bgStyle} padding:14px; border-radius:10px; font-size:12px;">
          <div style="font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#111;">${displayName}</span>
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