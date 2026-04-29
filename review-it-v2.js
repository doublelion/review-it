(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    boardNo: '4' // 대상 게시판 번호
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 데이터 수집 시작...');

    // 카페24 게시판 목록 레코드 선택 (다양한 스킨 대응)
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr');
    const payload = [];

    items.forEach(el => {
      // 1. 게시글 링크 및 번호 추출
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) return;

      const articleNoMatch = link.href.match(/article_no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 2. 별점 추출 (이미지 src 및 텍스트 대응)
      let extractedStars = 5;
      const starImg = el.querySelector('img[src*="star"], img[src*="rating"]');
      if (starImg) {
        const match = starImg.src.match(/star(\d)/) || starImg.src.match(/rating(\d)/);
        if (match) extractedStars = parseInt(match[1]);
      } else {
        const starText = el.querySelector('.point, .rating, .score')?.innerText;
        if (starText) {
          const num = starText.replace(/[^0-9]/g, "");
          if (num) extractedStars = parseInt(num);
        }
      }

      // 3. 작성자 추출 (태그 제거 및 정제)
      const writerEl = el.querySelector('.writer, .name, td:nth-child(3)');
      let writerName = writerEl ? writerEl.innerText.replace(/[*]/g, "").trim() : "고객";

      // 4. 제목 추출
      const subjectText = link.innerText.trim() || "포토 리뷰입니다.";

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.boardNo, // DB 스키마의 board_no 필드 대응
        subject: subjectText,
        content: "내용은 상세페이지에서 업데이트됩니다.", // 초기값
        writer: writerName,
        stars: extractedStars,
        image_urls: [], // 빈 배열로 전송 (위젯에서 딥스캔 수행)
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.warn("⚠️ 수집할 리뷰를 찾지 못했습니다. 게시판 목록 페이지에서 실행해 주세요.");
      return;
    }

    // 중복 제거 (articleNo 기준)
    const uniquePayload = Array.from(new Map(payload.map(item => [item.article_no, item])).values());

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트(UPSERT)
        },
        body: JSON.stringify(uniquePayload)
      });

      if (res.ok) {
        console.log(`✅ 성공: ${uniquePayload.length}개의 리뷰가 동기화되었습니다.`);
      } else {
        const errorData = await res.json();
        console.error("❌ 저장 실패:", errorData);
      }
    } catch (e) {
      console.error("❌ 네트워크 오류:", e);
    }
  }

  sync();
})();