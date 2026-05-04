/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v9.6 (Precision Parsing Edition)
 * @Goal: 닉네임 마스킹 방지, 날짜 정밀 수집, 별점 파싱 오류 해결
 */
(function (window) {
  const getDynamicConfig = () => {
    let host = window.location.hostname;
    let mallId = host.replace('.cafe24.com', '').split('.').pop() === 'com'
      ? host.split('.')[host.split('.').length - 2]
      : host.split('.')[0];

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId.replace('m.', ''),
      TARGET_BOARD_NO: '4',
      DEFAULT_IMG: '//img.echosting.cafe24.com/thumb/img_product_medium.gif'
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    // 1. 카페24 게시판 레코드 행 찾기
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr');
    const payload = [];

    items.forEach(el => {
      // 게시글 링크 및 번호 추출
      const link = el.querySelector('a[href*="article/"], a[href*="article_no="]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/(?:article_no=|article\/|no=)(\d+)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      const tds = el.querySelectorAll('td');
      if (tds.length < 3) return; // 유효한 행이 아님

      // [핵심 1] 작성자 추출 (마스킹 방지 및 원본 수집)
      // 카페24는 보통 닉네임이나 아이디가 들어있는 td에 클래스명이 있거나 특정 순서에 위치합니다.
      let rawWriter = "고객";
      const writerEl = el.querySelector('.writer, .name, [class*="writer"], [class*="name"]');

      if (writerEl) {
        rawWriter = writerEl.innerText.trim();
      } else {
        // 클래스가 없을 경우 td 인덱스로 추적 (보통 뒤에서 2~3번째 혹은 앞에서 4~5번째)
        // 안전하게 텍스트가 짧고 별표(*)가 없는 것을 우선 탐색하거나 순서 사용
        rawWriter = tds[4] ? tds[4].innerText.trim() : (tds[3] ? tds[3].innerText.trim() : "고객");
      }

      // [핵심 2] 작성일 추출 및 ISO 변환
      let rawDate = new Date().toISOString();
      const dateEl = el.querySelector('.date, .txtLess, [class*="date"]');
      if (dateEl) {
        rawDate = dateEl.innerText.trim();
      } else {
        rawDate = tds[5] ? tds[5].innerText.trim() : (tds[4] ? tds[4].innerText.trim() : rawDate);
      }

      // 날짜가 "2026-01-28" 형태라면 시간을 붙여 DB format에 맞춤
      if (rawDate.length <= 10) rawDate += " 00:00:00";

      // [핵심 3] 별점 추출 (이미지 alt값 또는 클래스명 분석)
      let starCount = 5;
      const starImg = el.querySelector('img[src*="rating"], img[alt*="별"], .icoStar');
      if (starImg) {
        const altText = starImg.getAttribute('alt');
        const starMatch = altText ? altText.match(/\d/) : null;
        starCount = starMatch ? parseInt(starMatch[0]) : 5;
      }

      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim().replace(/^\[.+\]\s*/, ''), // [포토] 같은 머리말 제거
        content: "상세 본문 참조",
        writer: rawWriter,
        stars: starCount,
        image_urls: [], // 이미지 딥스캔은 위젯 엔진에서 처리 (부하 방지)
        created_at: rawDate,
        is_visible: true
      });
    });

    if (payload.length > 0) {
      try {
        const res = await fetch(`${CONFIG.URL}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.KEY,
            'Authorization': `Bearer ${CONFIG.KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트 (409 에러 방지)
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) console.log(`✅ [REVIEW-IT] ${payload.length}개 리뷰 동기화 성공`);
      } catch (e) { console.error("❌ 네트워크 오류:", e); }
    }
  }

  setTimeout(sync, 2000); // 카페24 렌더링 대기
})(window);