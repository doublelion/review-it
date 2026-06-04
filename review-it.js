/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.5
 * @Update: 400 Bad Request 픽스 (컬럼명 롤백) & 실명 대신 아이디 추출 적용 & 제목 본문 차단
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
    const COOLDOWN_MS = 1000 * 60 * 60;

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

      // 💡 [핵심 1] 실명 대신 괄호 안의 '몰 아이디(ID)' 추출 로직
      let rawWriter = "고객";
      const writerEl = el.querySelector('.writer, .name, div.mt-3 > span:first-child');
      
      if (writerEl) {
        rawWriter = writerEl.innerText.trim();
      } else if (tds.length >= 5) {
        rawWriter = tds[4].innerText.trim();
      }

      let cleanWriter = rawWriter;
      // 김용관(ykinas) 형태로 올 경우 실명은 버리고 ykinas만 추출
      if (cleanWriter.includes('(') && cleanWriter.includes(')')) {
        cleanWriter = cleanWriter.split('(')[1].split(')')[0].trim();
      } else {
        cleanWriter = cleanWriter.split('[')[0].trim(); // 기타 특수기호 제거
      }
      cleanWriter = cleanWriter.replace(/[*]/g, '').trim();
      if (!cleanWriter) cleanWriter = "고객";

      // 썸네일 및 별점
      let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;

      let extractedStar = 5;
      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) extractedStar = parseInt(match[1], 10);
      }

      // 💡 [핵심 2] 제목 추출 정교화: 띄어쓰기로 본문이 섞이는 현상을 막기 위한 25자 강력 커트
      let subjectEl = el.querySelector('.subject, .title, .board_title, .td_subject');
      let cleanSubject = subjectEl ? subjectEl.innerText.trim() : "포토 리뷰입니다.";
      let targetText = subjectEl ? subjectEl.innerText : link.innerText;
      
      if (targetText) {
         cleanSubject = targetText.split('\n')[0].replace(/^제목\s*:?\s*/i, '').trim();
         // 본문이 딸려오더라도 25자 이상은 무조건 자름 (말줄임표 처리)
         if (cleanSubject.length > 25) cleanSubject = cleanSubject.substring(0, 25) + '...';
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo), // DB 규격에 맞게 복구 (400 에러 해결)
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter, // DB 규격에 맞게 복구 (400 에러 해결)
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_no)) uniqueMap.set(item.article_no, item);
    });
    const limitedPayload = Array.from(uniqueMap.values()).slice(0, 20);

    if (limitedPayload.length === 0) return;

    try {
      // API 주소도 article_no로 롤백 (400 에러 해결)
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