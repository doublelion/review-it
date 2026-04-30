/**
 * @Project: Review-It Universal Collector & Engine
 * @Version: v1.0.0 (Universal Edition)
 * @Description: 특정 몰 ID 고정 없이 설치 즉시 환경을 감지하여 작동합니다.
 */
(function (window) {
  // [1] 환경 감지 및 설정 자동화
  const getDynamicConfig = () => {
    // 카페24 전역 객체 또는 현재 호스트네임에서 Mall ID를 자동으로 추출합니다.
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0];

    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // Anon Key
      mallId: mallId,
      // 절대경로 문제를 해결하기 위해 현재 도메인 기반의 상대경로를 생성합니다.
      defaultImg: `${window.location.origin}/web/upload/no-img.png`,
      targetBoardNo: '4' // 추후 DB 설정값에 따라 가변적으로 운용 가능
    };
  };

  const CONFIG = getDynamicConfig();

  // [2] 데이터 수집 및 동기화 로직
  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 동기화 시작...`);

    // 다양한 카페24 스킨(기본, 디자인뱅크, 유료스킨 등)을 포괄하는 선택자
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // 게시판 번호 추출 및 필터링
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      const currentBoardNo = boardNoMatch ? boardNoMatch[1] : null;

      if (currentBoardNo !== CONFIG.targetBoardNo) return;

      // 게시글 번호 추출
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 작성자 추출 및 정제 (마스킹 제거 및 이름만 추출)
      let writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      if (!writerEl) {
        const spans = el.querySelectorAll('span');
        for (let s of spans) { if (s.innerText.includes('**')) { writerEl = s; break; } }
      }
      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";
      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();

      // 썸네일 추출 (동적 경로 적용)
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter || "고객",
        stars: 5,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    // 데이터 전송 (Upsert: 중복 시 업데이트)
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

      if (res.ok) console.log(`✅ [REVIEW-IT] ${CONFIG.mallId} 동기화 완료`);
    } catch (e) { console.error("❌ 오류 발생:", e); }
  }

  // 실행 시점 제어
  if (document.readyState === 'complete') { sync(); }
  else { window.addEventListener('load', sync); }

})(window);