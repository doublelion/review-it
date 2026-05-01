/**
 * @Project: Review-It Universal Collector & Engine
 * @Version: v9.5 (Final Stable Edition)
 * @Goal: 409 Conflict 해결, 변수 선언 오류 수정, 이미지 필터링 강화
 */
(function (window) {
  const getDynamicConfig = () => {
    // 1. Mall ID 추출 로직 (카페24 도메인 대응)
    let host = window.location.hostname;
    let mallId = host.replace('.cafe24.com', '').split('.').pop() === 'com'
      ? host.split('.')[host.split('.').length - 2]
      : host.split('.')[0];

    // 2. URL 파라미터에서 상품 번호 안전하게 추출
    const urlParams = new URLSearchParams(window.location.search);
    const productNo = urlParams.get('product_no') || 'common';

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // Supabase API Key
      MALL_ID: mallId.replace('m.', ''), // 모바일 도메인 접두사 제거
      PRODUCT_NO: productNo,
      TARGET_BOARD_NO: '4', // 기본 수집 대상 게시판 번호
      DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/no-img.png',
      // 별점 아이콘, 로고 등 불필요한 이미지 필터링 키워드
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|rating/i
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.MALL_ID} 상점 데이터 동기화 시작...`);

    // 카페24 다양한 스킨의 게시판 레코드 선택자
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group, .notice_view');
    const payload = [];

    items.forEach(el => {
      // 게시글 및 게시판 번호가 포함된 링크 탐색
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // 1. 게시글 번호(article_no) 추출
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 2. 작성자 이름 정제
      // [2] 작성자 이름 정제 (개선 버전)
      let cleanWriter = "고객";

      // 카페24의 공통적인 작성자 패턴을 모두 감지
      const writerSelectors = [
        '.writer', '.name', '.displaynone + span',
        'td[class*="writer"]', 'td[class*="name"]',
        '.author', '[id*="writer"]',
        '.member_name'
      ];

      let writerEl = null;
      for (let selector of writerSelectors) {
        writerEl = el.querySelector(selector);
        if (writerEl && writerEl.innerText.trim()) break;
      }

      if (writerEl) {
        // 1. [공지], [관리자] 등의 태그나 대괄호 내용 제거
        // 2. 관리자 아이콘 등이 포함될 수 있으므로 텍스트만 추출
        cleanWriter = writerEl.innerText
          .replace(/\[.*?\]/g, '') // 대괄호와 그 안의 내용 삭제
          .replace(/[*]/g, '')     // 기존에 이미 되어있는 마스킹 제거
          .trim()
          .split('\n')[0];        // 줄바꿈 발생 시 첫 줄만 선택
      }

      // 3. 이미지 추출 및 필터링 (v1.2 로직 최적화)
      let allImgs = Array.from(el.querySelectorAll('img')).map(img => img.getAttribute('src'));
      let validImg = allImgs.find(src =>
        src &&
        !CONFIG.SPAM_KEYWORDS.test(src) &&
        !src.includes('.svg') &&
        (src.includes('/product/') || src.includes('/board/') || src.includes('/file_data/'))
      );

      let thumbUrl = validImg || CONFIG.DEFAULT_IMG;
      if (thumbUrl.startsWith('//')) { thumbUrl = 'https:' + thumbUrl; }

      // 4. 데이터 전송 객체 구성
      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문은 상세 페이지에서 확인 가능합니다.",
        writer: cleanWriter,
        stars: 5, // 기본 별점
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true,
        is_best: false
      });
    });

    console.log(`📊 [REVIEW-IT] 수집된 리뷰 개수: ${payload.length}개`);

    if (payload.length > 0) {
      try {
        const res = await fetch(`${CONFIG.URL}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.KEY,
            'Authorization': `Bearer ${CONFIG.KEY}`,
            'Content-Type': 'application/json',
            // [중요] 409 Conflict 해결: 중복 데이터 발생 시 업데이트로 처리
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          console.log(`✅ [REVIEW-IT] ${CONFIG.MALL_ID} 데이터 전송/업데이트 성공!`);
        } else {
          const errText = await res.text();
          console.error("❌ [REVIEW-IT] 전송 실패:", errText);
        }
      } catch (e) {
        console.error("❌ [REVIEW-IT] 네트워크 오류:", e);
      }
    }
  }

  // 카페24 로딩 속도를 고려한 지연 실행 (1.5초)
  setTimeout(() => {
    if (document.readyState === 'complete') { sync(); }
    else { window.addEventListener('load', sync); }
  }, 1500);
})(window);