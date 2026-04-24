/**
 * @Project: Review-It Collector v2.6 (Final Stable)
 * @Description: 409 Conflict 해결 및 게시글 번호 추출 로직 강화
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png'
  };

  async function syncReview() {
    console.log("🚀 [Review-it] 데이터 스캔 시작...");
    
    // 상세 페이지 여부 확인
    const readPage = document.querySelector('.xans-board-read, #board_read');
    if (readPage) {
      await handleReadPage(readPage);
    } else {
      await handleListPage();
    }
  }

  // --- 상세 페이지 수집 ---
  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      // 번호 추출 로직 강화 (쿼리스트링 우선, 없으면 경로에서)
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();
      if (!articleNo || isNaN(articleNo)) return;

      const writerEl = container.querySelector('.name, .writer');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";
      const subject = container.querySelector('h3, .subject')?.innerText.trim() || "리뷰";
      
      const contentArea = container.querySelector('.detail, .content, #board_detail');
      let imageUrls = [];
      if (contentArea) {
        const imgs = contentArea.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs).map(img => img.getAttribute('src'))
          .filter(src => src && src.length > 10 && !src.includes('clear.gif'))
          .map(src => src.startsWith('http') ? src : (src.startsWith('//') ? 'https:' + src : window.location.origin + src));
      }

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject,
        content: contentArea?.innerText.trim().substring(0, 500) || "",
        writer: writer,
        stars: 5,
        image_urls: imageUrls.length > 0 ? imageUrls : [CONFIG.defaultImg]
      });
    } catch (e) { console.error("상세페이지 에러:", e); }
  }

  // --- 목록 페이지 수집 ---
  async function handleListPage() {
    // 카페24의 다양한 링크 패턴 대응
    const allLinks = document.querySelectorAll('a[href*="no="], a[href*="/article/"]');
    const processedNos = new Set();

    for (let link of allLinks) {
      const href = link.getAttribute('href');
      if (!href || link.innerText.trim().length < 2) continue;

      // 정규식: no=숫자 혹은 /번호/ 형태 추출
      const match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      const articleNo = match[1];
      if (processedNos.has(articleNo) || articleNo === "undefined") continue;
      processedNos.add(articleNo);

      const row = link.closest('tr') || link.closest('li');
      const thumb = row?.querySelector('img[src*="/web/upload/"], .thumb img, .thumbnail img');
      const writer = row?.querySelector('.writer, .name')?.innerText.split('(')[0].trim() || '고객';

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: "",
        writer: writer,
        stars: 5,
        image_urls: thumb ? [thumb.src] : [CONFIG.defaultImg]
      });
    }
  }

  // --- DB 전송 (409 에러 원천 차단) ---
  async function postToDB(data) {
    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          // 중복 발생 시 오류(409)를 내지 않고 덮어쓰기(Upsert) 하도록 강제 설정
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify({
          ...data,
          is_visible: true,
          created_at: new Date().toISOString()
        })
      });

      if (res.ok) {
        console.log(`✅ [${data.article_no}] 동기화 성공`);
      } else {
        const errLog = await res.json();
        console.log(`❌ [${data.article_no}] 실패 사유:`, errLog.message);
      }
    } catch (e) {
      console.error("네트워크 오류:", e);
    }
  }

  setTimeout(syncReview, 2500);
})();