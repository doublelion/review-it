/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.6
 * @Update: 독립 도메인 대응 강화, 작성자 몰아이디 매핑, 제목 본문 혼입 방지 정교화
 */
(function (window) {
  const getDynamicConfig = () => {
    // 1. 카페24 전역 변수에서 mallId를 먼저 찾습니다. (가장 정확함)
    const cafe24MallId = window.SHOP_ID || (typeof EC_SHOP_ID !== 'undefined' ? EC_SHOP_ID : null);

    // 2. 전역 변수가 없을 경우에만 기존의 hostname 파싱 로직을 사용 (백업)
    let host = window.location.hostname;
    let fallbackMallId = host.replace('.cafe24.com', '').split('.').pop() === 'com'
      ? host.split('.')[host.split('.').length - 2]
      : host.split('.')[0];

    const finalMallId = cafe24MallId || fallbackMallId.replace('m.', '');

    console.log("▶ [REVIEW-IT] 현재 인식된 Mall ID:", finalMallId);

    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      mallId: finalMallId,
      targetBoardNo: '4',
      defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg'
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    const lastSync = localStorage.getItem('rit_last_sync');
    const now = new Date().getTime();
    const COOLDOWN_MS = 1000 * 60 * 60; // 1시간 쿨타임

    if (lastSync && (now - parseInt(lastSync) < COOLDOWN_MS)) {
      console.log(`⏳ [REVIEW-IT] 동기화 쿨타임 대기 중입니다.`);
      return;
    }

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
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 💡 [요청 반영] 작성자명을 화면의 실명/쇼핑몰명 대신 현재 인식된 '몰 아이디(Mall ID)'로 변경
      let cleanWriter = CONFIG.mallId || "customer";

      // 썸네일 및 별점 추출
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;

      let extractedStar = 5;
      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) extractedStar = parseInt(match[1], 10);
      }

      // 💡 [요청 반영] 제목 추출 정교화 (본문 섞임 및 공백 제거 강력 쉴드)
      let subjectEl = el.querySelector('.subject, .title, .board_title, .td_subject');
      let rawSubject = subjectEl ? subjectEl.innerText : link.innerText;
      let cleanSubject = "포토 리뷰입니다.";

      if (rawSubject) {
        // 줄바꿈 제거, 앞뒤 공백 제거 후 첫 문장 유효 텍스트만 확보
        let temp = rawSubject.split('\n')[0].replace(/^제목\s*:?\s*/i, '').trim();
        // 다중 공백 및 탭을 한 칸의 공백으로 압축
        temp = temp.replace(/\s+/g, ' ').trim();

        if (temp.length > 0) {
          cleanSubject = temp;
          // 본문 유입 방지를 위한 강력한 25자 커트라인 및 말줄임 처리
          if (cleanSubject.length > 25) {
            cleanSubject = cleanSubject.substring(0, 25) + '...';
          }
        }
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter, // 몰 아이디 저장 완료
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    // 중복 제거
    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_no)) uniqueMap.set(item.article_no, item);
    });
    const limitedPayload = Array.from(uniqueMap.values()).slice(0, 20);

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
        console.log(`✅ [REVIEW-IT] 동기화 완료 (${limitedPayload.length}건)`);
        localStorage.setItem('rit_last_sync', new Date().getTime().toString());
      } else {
        console.error("❌ 데이터 전송 실패:", await res.text());
      }
    } catch (e) {
      console.error(e);
    }
  }

  setTimeout(sync, 2000);
})(window);