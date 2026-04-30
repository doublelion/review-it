/**
 * @Project: Review-It Collector v7.5
 * @Feature: URL 기반 게시판 번호(Board No) 정밀 필터링 추가
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    targetBoardNo: '4' // ✅ 수집을 원하는 '진짜' 리뷰 게시판 번호
  };

  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.targetBoardNo}번 게시판 전용 데이터 추출 시작...`);

    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // [핵심] 현재 링크의 게시판 번호(board_no) 추출
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      const currentBoardNo = boardNoMatch ? boardNoMatch[1] : null;

      // [필터링] 설정한 번호와 다르면 수집 대상에서 제외 ⭐️
      if (currentBoardNo !== CONFIG.targetBoardNo) return;

      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 작성자 추출
      let writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      if (!writerEl) {
        const spans = el.querySelectorAll('span');
        for (let s of spans) { if (s.innerText.includes('**')) { writerEl = s; break; } }
      }
      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";
      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();

      // 제목 추출
      let subjectText = link.innerText.replace(/^Q\./, '').trim() || "포토 리뷰입니다.";

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: subjectText,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter || "고객",
        stars: 5,
        image_urls: [],
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.warn(`⚠️ ${CONFIG.targetBoardNo}번 게시판의 데이터를 찾지 못했습니다.`);
      return;
    }

    const uniquePayload = Array.from(new Map(payload.map(item => [item.article_no, item])).values());

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(uniquePayload)
      });

      if (res.ok) {
        console.log(`✅ [성공] ${CONFIG.targetBoardNo}번 게시판 리뷰 ${uniquePayload.length}개 동기화 완료`);
      }
    } catch (e) { console.error("❌ 오류:", e); }
  }

  sync();
})();