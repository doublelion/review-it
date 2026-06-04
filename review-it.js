/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.1
 * @Goal: 무설정(Zero-Config) 기반 리뷰 자동 수집 및 전환율 극대화
 */
(function (window) {
  const getDynamicConfig = () => {
    let host = window.location.hostname;
    let mallId = host.replace('.cafe24.com', '').split('.').pop() === 'com'
      ? host.split('.')[host.split('.').length - 2]
      : host.split('.')[0];

    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      mallId: mallId.replace('m.', ''),
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

    console.log(`🚀 [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 수집 시작...`);

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

      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (!starImg) return;

      let extractedStar = 5;
      const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
      if (match && match[1]) {
        extractedStar = parseInt(match[1], 10);
      }

      // 💡 [수정] 작성자 이름 추출 방어 로직 추가
      let cleanWriter = "고객";
      const writerEl = el.querySelector('.writer, .name, [class*="writer"], td:nth-child(2)'); 
      if (writerEl) {
        cleanWriter = writerEl.innerText.trim();
      }

      // 💡 [수정] 썸네일 이미지 추출 방어 로직 추가
      let thumbUrl = null;
      const imgEl = el.querySelector('.thumb img, img.thumb, .thumbnail img');
      if (imgEl) {
        thumbUrl = imgEl.getAttribute('src');
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_id: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문을 불러오는 중입니다...",
        author_name: cleanWriter, // 💡 writer -> author_name 으로 DB와 통일
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.log(`⚠️ [REVIEW-IT] ${CONFIG.mallId} 수집할 리뷰 데이터가 없습니다.`);
      return;
    }

    // 💡 [수정] article_id 기준으로 중복 데이터 완벽 제거
    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_id)) {
        uniqueMap.set(item.article_id, item);
      }
    });
    const uniquePayload = Array.from(uniqueMap.values());
    const limitedPayload = uniquePayload.slice(0, 20);

    if (limitedPayload.length === 0) return;

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_id`, {
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
        console.log(`✅ [REVIEW-IT] ${CONFIG.mallId} 수집 완료 (${limitedPayload.length}건)`);
        localStorage.setItem('rit_last_sync', new Date().getTime().toString());
      } else {
        console.error("❌ 데이터 전송 실패:", await res.text());
      }
    } catch (e) {
      console.error("❌ 오류 발생:", e);
    }
  }

  setTimeout(sync, 2000);
})(window);