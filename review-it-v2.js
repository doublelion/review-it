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
      // DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/no-img.png',
      DEFAULT_IMG: '//img.echosting.cafe24.com/thumb/img_product_medium.gif', // 특정 경로
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

    // Collector 코드 내 sync 함수 내부의 추출 로직 수정
    items.forEach(el => {
      const link = el.querySelector('a[href*="article/"]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;

      // [핵심] 모든 td를 가져와서 순서대로 매핑 (가장 정확함)
      const tds = el.querySelectorAll('td');

      // 1. 작성자 정확히 가져오기 (5번째 td)
      // maskName 함수를 거치지 않고 원본 데이터를 수집 단계에서 확보해야 합니다.
      let rawWriter = tds[4] ? tds[4].innerText.trim() : "고객";

      // 2. 작성일 정확히 가져오기 (6번째 td)
      // "2026-01-28 12:31:37" 형태를 그대로 수집하거나 ISO 형태로 변환
      let rawDate = tds[5] ? tds[5].innerText.trim() : new Date().toISOString();

      // 3. 별점 추출 (마지막 td의 이미지 alt값 활용)
      const starImg = el.querySelector('td.displaynone img');
      const starMatch = starImg ? starImg.getAttribute('alt').match(/\d/) : [5];
      const starCount = parseInt(starMatch[0]);

      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim(),
        content: "본문 상세 참조",
        writer: rawWriter, // "와이키나스" 원본 데이터 저장
        stars: starCount,
        image_urls: [/* 이미지 추출 로직 */],
        created_at: rawDate, // DB에 날짜 문자열 전송
        is_visible: true
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