/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.0
 * @Goal: 
 */
(function (window) {
  const getDynamicConfig = () => {
    let host = window.location.hostname;
    let mallId = host.replace('.cafe24.com', '').split('.').pop() === 'com'
      ? host.split('.')[host.split('.').length - 2]
      : host.split('.')[0];

    // 반환 객체의 키(Key)를 아래 로직과 동일하게 카멜 케이스
    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      mallId: mallId.replace('m.', ''),
      targetBoardNo: '4',
      // defaultImg: '//img.echosting.cafe24.com/thumb/img_product_medium.gif'
      defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg'
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    const lastSync = localStorage.getItem('rit_last_sync');
    const now = new Date().getTime();
    const COOLDOWN_MS = 1000 * 60 * 60; // 1시간 쿨타임

    // 최근 1시간 이내에 동기화를 했다면 실행 취소
    if (lastSync && (now - parseInt(lastSync) < COOLDOWN_MS)) {
      console.log(`⏳ [REVIEW-IT] 동기화 쿨타임 대기 중입니다.`);
      return;
    }

    console.log(`🚀 [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 동기화 시작...`);

    const items = document.querySelectorAll(`
  .xans-board-listpackage .xans-record-, 
  .xans-product-review .xans-record-,
  tr[id^="record"], 
  .boardList tr, 
  .border-b.group,
  li.review_list_item
`);
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"], a[href*="no="]');
      if (!link) return;

      const href = link.getAttribute('href');
      // 💡 게시판 번호 동적 추출 (없으면 'unknown' 처리하되 수집은 진행)
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      const currentBoardNo = boardNoMatch ? boardNoMatch[1] : 'unknown';

      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 💡 [핵심 패치] 리스트에서 별점 이미지가 있는지 먼저 확인
      const starImg = el.querySelector('img[src*="icon-star-rating"]');

      // 별점 이미지가 없으면 리뷰가 아닌 일반 게시글(공지사항, Q&A 등)로 간주하고 패스
      if (!starImg) return;

      let extractedStar = 5;
      const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
      if (match && match[1]) {
        extractedStar = parseInt(match[1], 10);
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter || "고객",
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.log(`⚠️ [REVIEW-IT] ${CONFIG.mallId} 수집할 리뷰 데이터가 없습니다.`);
      return;
    }

    // 💡 [에러 해결 핵심 로직] article_no 기준으로 중복 데이터 완벽 제거
    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_no)) {
        uniqueMap.set(item.article_no, item);
      }
    });
    const uniquePayload = Array.from(uniqueMap.values());

    // 배열 크기 제한 (중복 제거된 배열에서 최대 20개까지만 수집)
    const limitedPayload = uniquePayload.slice(0, 20);

    if (limitedPayload.length === 0) return;

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(limitedPayload)
      });

      if (res.ok) {
        console.log(`✅ [REVIEW-IT] ${CONFIG.mallId} 동기화 완료 (${limitedPayload.length}건)`);
        // 성공 시에만 쿨타임 저장
        localStorage.setItem('rit_last_sync', new Date().getTime().toString());
      } else {
        console.error("❌ 데이터 전송 실패:", await res.text());
      }
    } catch (e) {
      console.error("❌ 오류 발생:", e);
    }
  }

  setTimeout(sync, 2000); // 카페24 렌더링 대기
})(window);