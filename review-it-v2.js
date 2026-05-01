/**
 * @Project: Review-It Universal Collector & Engine
 * @Version: v1.1.0 (Fixed Edition)
 */
(function (window) {
  const getDynamicConfig = () => {
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0];

    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // Anon Key
      mallId: mallId,
      defaultImg: `${window.location.origin}/web/upload/no-img.png`,
      targetBoardNo: '4' 
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 동기화 시작...`);

    // 카페24의 다양한 스킨 구조를 탐색하는 더 정교한 선택자
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // 게시판 번호 추출
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      const currentBoardNo = boardNoMatch ? boardNoMatch[1] : null;

      if (currentBoardNo !== CONFIG.targetBoardNo) return;

      // 게시글 번호 추출
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 작성자 정제
      let writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      if (!writerEl) {
        const spans = el.querySelectorAll('span');
        for (let s of spans) { if (s.innerText.includes('**')) { writerEl = s; break; } }
      }
      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";
      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();

      // 이미지 추출 (프로토콜 유실 방지)
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;
      if (thumbUrl && thumbUrl.startsWith('//')) { thumbUrl = 'https:' + thumbUrl; }

      // [핵심 수정] DB 테이블 구조와 100% 일치하도록 페이로드 구성
      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문을 불러오는 중입니다...", // 추후 상세페이지 fetch 로직 추가 가능
        writer: cleanWriter || "고객",
        stars: 5,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true,
        is_best: false // SQL에 추가된 컬럼 반드시 포함
      });
    });

    console.log(`📊 [REVIEW-IT] 수집된 리뷰 개수: ${payload.length}개`);

    if (payload.length === 0) {
      console.warn("⚠️ [REVIEW-IT] 동기화할 데이터가 없습니다. (게시판 번호 확인 필요)");
      return;
    }

    // 데이터 전송 (Upsert 로직 보강)
    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // 중복 시 덮어쓰기 설정
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log(`✅ [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 전송 성공!`);
      } else {
        const errorDetail = await res.json();
        console.error("❌ [REVIEW-IT] 전송 실패 사유:", errorDetail.message);
      }
    } catch (e) { 
      console.error("❌ [REVIEW-IT] 네트워크 오류:", e); 
    }
  }

  // 실행 시점 제어
  if (document.readyState === 'complete') { sync(); }
  else { window.addEventListener('load', sync); }

})(window);