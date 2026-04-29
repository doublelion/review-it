/**
 * @Project: Review-It Collector v7.5 (Full-Sync)
 * @Feature: 목록 페이지 썸네일 + 실제 본문(일부) 수집 + 아이디 정제
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    boardNo: '4'
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 고정밀 데이터 수집 시작...');

    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr');
    const payload = [];

    for (const el of items) {
      // 1. 게시글 링크 및 번호
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) continue;

      const articleNoMatch = link.href.match(/article_no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) continue;

      // 2. 별점 추출
      let extractedStars = 5;
      const starImg = el.querySelector('img[src*="star"], img[src*="rating"]');
      if (starImg) {
        const match = starImg.src.match(/star(\d)/) || starImg.src.match(/rating(\d)/);
        if (match) extractedStars = parseInt(match[1]);
      }

      // 3. 작성자 정제
      const writerEl = el.querySelector('.writer, .name, td:nth-child(5)');
      let cleanWriter = writerEl ? writerEl.innerText.trim().replace(/[*]/g, '') : "고객";

      // 4. [중요] 목록에 있는 썸네일 이미지 미리 수집
      const thumbImg = el.querySelector('img[src*="/thumb/"], img[src*="/product/"]');
      let thumbUrl = thumbImg ? thumbImg.src : null;
      if (thumbUrl && thumbUrl.startsWith('//')) thumbUrl = 'https:' + thumbUrl;

      // 5. [개선] 목록에 본문 미리보기가 있는 경우 수집 (없으면 기본값)
      const summaryEl = el.querySelector('.displaynone, .summary, .content-preview'); // 카페24 스킨별 상이
      const summaryText = summaryEl ? summaryEl.innerText.trim() : "포토 리뷰입니다.";

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.boardNo,
        subject: link.innerText.trim() || "리뷰입니다.",
        content: summaryText, 
        writer: cleanWriter,
        stars: extractedStars,
        image_urls: thumbUrl ? [thumbUrl] : [], // 썸네일이라도 DB에 저장
        is_visible: true
      });
    }

    if (payload.length === 0) return;

    // Supabase Upsert
    try {
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

      if (res.ok) console.log(`✅ ${payload.length}건 동기화 완료`);
    } catch (e) {
      console.error("❌ 오류:", e);
    }
  }

  sync();
})();