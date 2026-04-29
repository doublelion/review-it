/**
 * @Project: Review-It Collector v7.3
 * @Feature: 아이디 정밀 파싱 (특수문자/숫자/중복마스킹 제거) 및 SQL 스키마 동기화
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    boardNo: '4' // 카페24 리뷰 게시판 번호
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 데이터 수집 및 아이디 정제 시작...');

    // 1. 카페24 게시판 목록 레코드 선택 (다양한 스킨 대응)
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr');
    const payload = [];

    items.forEach(el => {
      // [A] 게시글 링크 및 번호 추출
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) return;

      const articleNoMatch = link.href.match(/article_no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // [B] 별점 추출 (이미지 및 텍스트 대응)
      let extractedStars = 5;
      const starImg = el.querySelector('img[src*="star"], img[src*="rating"], img[src*="icon_star"]');
      if (starImg) {
        const match = starImg.src.match(/star(\d)/) || starImg.src.match(/rating(\d)/) || starImg.src.match(/icon_star(\d)/);
        if (match) extractedStars = parseInt(match[1]);
      } else {
        const starText = el.querySelector('.point, .rating, .score')?.innerText;
        if (starText) {
          const num = starText.replace(/[^0-9]/g, "");
          if (num) extractedStars = parseInt(num);
        }
      }

      // [C] 작성자(아이디) 정밀 파싱 ⭐️
      // 스크린샷 이슈 해결: 이름 뒤의 [1], (2) 또는 이미 마스킹된 * 기호들을 모두 제거하여 순수 이름만 추출
      const writerEl = el.querySelector('.writer, .name, td:nth-child(3)');
      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";

      // 대괄호, 소괄호, 별표 제거 로직
      let cleanWriter = rawWriter
        .split('[')[0]  // '아이디[1]' -> '아이디'
        .split('(')[0]  // '아이디(2)' -> '아이디'
        .replace(/[*]/g, '') // '아*이*디' -> '아이디'
        .trim();

      // [D] 제목 추출
      const subjectText = link.innerText.trim() || "포토 리뷰입니다.";

      // [E] 페이로드 구성 (SQL 스키마 필드명과 일치)
      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.boardNo,
        subject: subjectText,
        content: "구매해 주셔서 감사합니다!", // 초기값 (위젯 딥스캔 시 실제 내용으로 업데이트)
        writer: cleanWriter || "고객",
        stars: extractedStars,
        image_urls: [], // 빈 배열 전송 (위젯 엔진이 딥스캔 수행)
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.warn("⚠️ 수집할 리뷰를 찾지 못했습니다. 리뷰 게시판 목록(List) 페이지인지 확인해주세요.");
      return;
    }

    // [F] 중복 제거 (article_no 기준)
    const uniquePayload = Array.from(new Map(payload.map(item => [item.article_no, item])).values());

    // [G] Supabase 전송 (UPSERT 방식)
    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트
        },
        body: JSON.stringify(uniquePayload)
      });

      if (res.ok) {
        console.log(`✅ 성공: ${uniquePayload.length}개의 리뷰 아이디가 깨끗하게 동기화되었습니다.`);
      } else {
        const errorData = await res.json();
        console.error("❌ 저장 실패:", errorData);
      }
    } catch (e) {
      console.error("❌ 네트워크 오류:", e);
    }
  }

  // 실행
  sync();
})();