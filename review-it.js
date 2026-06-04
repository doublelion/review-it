/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.3
 * @Update: 작성자 ID 제거 로직(v1.0.0) 복구 및 제목/본문 완벽 분리
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
      const tds = el.querySelectorAll('td');

      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 💡 [핵심 1] 구버전(v1.0.0)의 정밀한 이름 추출 및 괄호(아이디) 제거 로직 완벽 복구
      let rawWriter = "고객";
      const writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      
      if (writerEl) {
        rawWriter = writerEl.innerText.trim();
      } else if (tds.length >= 5) {
        rawWriter = tds[4].innerText.trim();
      }

      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();
      if (!cleanWriter) cleanWriter = "고객";

      // 썸네일 및 별점 추출
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;

      let extractedStar = 5;
      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) extractedStar = parseInt(match[1], 10);
      }

      // 💡 [핵심 2] 제목 텍스트에서 엔터(\n) 기준 첫 줄만 가져와 본문과 완벽하게 분리
      let cleanSubject = "포토 리뷰입니다.";
      const linkText = link.innerText.trim();
      if (linkText) {
         cleanSubject = linkText.split('\n')[0].replace(/^제목\s*:?\s*/i, '').trim();
         if (cleanSubject.length > 30) cleanSubject = cleanSubject.substring(0, 30) + '...';
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_id: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        author_name: cleanWriter, // 💡 DB 규격에 맞춰 author_name으로 전송
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    // 중복 제거 로직
    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_id)) uniqueMap.set(item.article_id, item);
    });
    const limitedPayload = Array.from(uniqueMap.values()).slice(0, 20);

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
        console.log(`✅ [REVIEW-IT] 동기화 완료 (${limitedPayload.length}건)`);
        localStorage.setItem('rit_last_sync', new Date().getTime().toString());
      }
    } catch (e) {
      console.error(e);
    }
  }

  setTimeout(sync, 2000);
})(window);