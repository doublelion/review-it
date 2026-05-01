/**
 * @Project: Review-It Collector v1.1
 * @Description: 게시판 목록에서 데이터를 정밀 수집하여 Supabase로 동기화합니다.
 */
(function (window) {
  const CONFIG = {
    SB_URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    SB_KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    // 환경 감지: 카페24 API 또는 도메인에서 Mall ID 추출
    MALL_ID: (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0],
    TARGET_BOARD_NO: '4',
    DEFAULT_IMG: 'https://review-it-tau.vercel.app/assets/no-img.png'
  };

  async function sync() {
    // 게시글 목록을 나타내는 다양한 선택자 대응
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group');
    if (items.length === 0) return;

    console.log(`🚀 [REVIEW-IT] ${CONFIG.MALL_ID} 데이터 수집 및 동기화 시작...`);
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // 게시판 번호 추출 및 타겟 보드 검증
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      if (!boardNoMatch || boardNoMatch[1] !== CONFIG.TARGET_BOARD_NO) return;

      // 게시글 번호(article_no) 추출
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      if (!articleNoMatch) return;

      // 작성자 추출 및 정제 (마스킹 제거)
      let writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";
      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();

      // 썸네일 이미지 추출
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.DEFAULT_IMG;

      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNoMatch[1]),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        writer: cleanWriter || "고객",
        stars: 5,
        image_urls: [thumbUrl],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    try {
      // Upsert 로직: 중복 데이터는 업데이트, 새 데이터는 삽입
      await fetch(`${CONFIG.SB_URL}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SB_KEY,
          'Authorization': `Bearer ${CONFIG.SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      console.log("✅ [REVIEW-IT] 수집 데이터 전송 완료");
    } catch (e) { console.error("❌ [REVIEW-IT] 수집 중 오류 발생:", e); }
  }

  // 페이지 로드 시점에 실행
  if (document.readyState === 'complete') sync();
  else window.addEventListener('load', sync);
})(window);