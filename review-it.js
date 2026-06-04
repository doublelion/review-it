/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.2
 * @Update: 제목 DOM 추출 로직 정교화 및 매칭 안정성 강화
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
      let extractedStar = 5;
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) {
          extractedStar = parseInt(match[1], 10);
        }
      }

      let cleanWriter = "고객";
      const writerEl = el.querySelector('.writer, .name, [class*="writer"], td:nth-child(2)'); 
      if (writerEl) {
        cleanWriter = writerEl.innerText.trim();
      }

      let thumbUrl = null;
      const imgEl = el.querySelector('.thumb img, img.thumb, .thumbnail img');
      if (imgEl) {
        thumbUrl = imgEl.getAttribute('src');
      }

      // 💡 [버그 픽스] 제목(Subject)을 정확히 추출하는 로직 도입
      let cleanSubject = "포토 리뷰입니다.";
      
      // 1. 게시판 내 명시적인 제목 클래스를 먼저 찾습니다.
      const subjectEl = el.querySelector('.subject, .title, td.subject, p.name');
      
      if (subjectEl) {
        // '제목 :' 같은 불필요한 접두어 제거 후 저장
        cleanSubject = subjectEl.innerText.replace(/^제목\s*:?\s*/i, '').trim();
      } else if (link) {
        // 2. 명확한 제목 요소가 없어 링크 텍스트를 쓸 경우, 글자 수를 제한하여 본문이 통째로 들어가는 것을 방지합니다.
        const linkText = link.innerText.trim();
        if (linkText.length > 0) {
          cleanSubject = linkText.length > 30 ? linkText.substring(0, 30) + '...' : linkText;
        }
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_id: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        author_name: cleanWriter,
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.log(`⚠️ [REVIEW-IT] ${CONFIG.mallId} 수집할 리뷰 데이터가 없습니다.`);
      return;
    }

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
      }
    } catch (e) {
      console.error("❌ 오류 발생:", e);
    }
  }

  setTimeout(sync, 2000);
})(window);