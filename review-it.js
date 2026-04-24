/**
 * @Project: Review-It Collector v2.7 (Target Lock & 400 Error Fix)
 * @Description: 메인 페이지 오작동 방지 및 불량 데이터 전송 차단
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png'
  };

  async function syncReview() {
    // [맥점 1] URL 검사: 게시판(/board/ 또는 /article/) 관련 주소가 아니면 즉시 종료
    const path = window.location.pathname;
    if (!path.includes('/board/') && !path.includes('/article/')) {
        console.log("⏸️ [Review-it] 리뷰 게시판이 아니므로 수집을 대기합니다.");
        return; 
    }

    console.log("🚀 [Review-it] 리뷰 데이터 스캔 시작...");
    
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
    // [맥점 2] 아무 링크나 잡지 않고, 실제 게시판 목록 영역 내부의 링크만 스캔
    const boardListContainer = document.querySelector('.xans-board-list, .board_list, tbody');
    if (!boardListContainer) return;

    const allLinks = boardListContainer.querySelectorAll('a[href*="no="], a[href*="/article/"]');
    const processedNos = new Set();

    for (let link of allLinks) {
      const href = link.getAttribute('href');
      // 제목이 비어있거나 너무 짧으면 불량 링크로 간주하고 패스
      if (!href || link.innerText.trim().length < 2) continue;

      const match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      const articleNo = match[1];
      if (processedNos.has(articleNo) || !articleNo || isNaN(articleNo)) continue;
      processedNos.add(articleNo);

      const row = link.closest('tr') || link.closest('li');
      const thumb = row?.querySelector('img[src*="/web/upload/"], .thumb img, .thumbnail img');
      const writer = row?.querySelector('.writer, .name')?.innerText.split('(')[0].trim() || '고객';

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: "리뷰 목록 수집",
        writer: writer,
        stars: 5,
        image_urls: thumb ? [thumb.src] : [CONFIG.defaultImg]
      });
    }
  }

  // --- DB 전송 ---
  async function postToDB(data) {
    // [맥점 3] 필수 데이터(게시글 번호, 제목)가 없으면 전송 자체를 차단 (400 에러 방지)
    if (!data.article_no || data.article_no === 'undefined' || !data.subject) {
        return; 
    }

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
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
        console.log(`⚠️ [${data.article_no}] DB 거절 (코드: ${res.status})`);
      }
    } catch (e) {
      console.error("네트워크 오류:", e);
    }
  }

  setTimeout(syncReview, 2500);
})();