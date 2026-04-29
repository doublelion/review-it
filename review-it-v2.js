(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879'
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 데이터 수집 시작...');
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"]');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) return;

      const articleNo = link.href.match(/article_no=(\d+)/)?.[1] || link.href.match(/\/(\d+)\/?$/)?.[1];
      if (!articleNo) return;

      // ⭐️ 핵심 수정: 카페24 DOM에서 실제 별점 동적 추출 로직 추가
      let extractedStars = 5; // 기본값
      const starImg = el.querySelector('img[src*="icon_star"]');
      if (starImg) {
        // icon_star1.gif ~ icon_star5.gif 에서 숫자만 파싱
        const match = starImg.src.match(/icon_star(\d)/);
        if (match) extractedStars = parseInt(match[1]);
      } else {
        // 만약 텍스트로 별점이 표기되는 스킨일 경우 대비
        const textContent = el.innerText;
        const pointMatch = textContent.match(/점수\s*:\s*(\d)/);
        if (pointMatch) extractedStars = parseInt(pointMatch[1]);
      }

      // 작성자 추출 (스킨별 예외처리 반영)
      const writerEl = el.querySelector('.writer, .name, td:nth-child(3)');
      const writerName = writerEl ? writerEl.innerText.trim() : "고객";

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: "구매해 주셔서 감사합니다!",
        writer: writerName,
        stars: extractedStars, // 동적으로 추출한 별점 매핑
        image_urls: ["https://ecudemo389879.cafe24.com/web/upload/no-img.png"], // 딥스캔 전 기본이미지
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.error("❌ 수집할 리뷰를 찾지 못했습니다. 게시판 페이지가 맞나요?");
      return;
    }

    // ⭐️ 오류 수정: fetch 응답을 받을 res 변수 선언 추가
    const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.sbKey,
        'Authorization': `Bearer ${CONFIG.sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`✅ 성공: ${payload.length}개 데이터가 Supabase에 저장되었습니다!`);
    } else {
      const errorData = await res.json();
      console.error("❌ 저장 실패:", errorData);
    }
  }

  sync();
})();