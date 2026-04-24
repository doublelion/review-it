/**
 * @Project: Review-It Collector v3.5 (Final)
 * @Description: Cafe24 타겟팅 정밀화 및 데이터 오염 원천 차단
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: 'https://via.placeholder.com/400x533?text=Review-It'
  };

  async function syncReview() {
    // 1. 게시판 관련 경로가 아니면 실행 안 함
    if (!/board|article/.test(window.location.pathname)) return;

    console.log("🚀 [Review-it] 스캔 중...");
    
    // 상세 페이지 여부 확인
    const readContainer = document.querySelector('.xans-board-read, #board_read, .ec-base-table.typeWrite');
    
    if (readContainer) {
      await handleReadPage(readContainer);
    } else {
      await handleListPage();
    }
  }

  // --- [상세 페이지] 진짜 본문과 고화질 이미지 수집 ---
  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();
      
      if (!articleNo || articleNo === 'undefined' || isNaN(articleNo)) return;

      const subject = (container.querySelector('h3, .subject, [class*="subject"]') || {innerText:''}).innerText.replace(/\[\d+\]$/, '').trim();
      
      // 작성자 탐색 (td, span, div 등 모든 가능성 열기)
      const writerEl = container.querySelector('.name, .writer, .author, [class*="writer"], td:nth-child(2)');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";
      
      // 본문 및 이미지
      const contentEl = container.querySelector('.detail, .content, #board_detail, .fr-view, .view_content');
      const content = contentEl ? contentEl.innerText.trim() : "";
      
      let imageUrls = [];
      if (contentEl) {
        const imgs = contentEl.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs).map(img => img.src).filter(src => src && src.length > 20);
      }

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject || "리뷰",
        content: content, 
        writer: writer,
        stars: 5,
        image_urls: imageUrls.length > 0 ? imageUrls : [CONFIG.defaultImg]
      });
    } catch (e) { console.error("상세 수집 에러:", e); }
  }

  // --- [목록 페이지] 기본 정보 수집 ---
  async function handleListPage() {
    const rows = document.querySelectorAll('.xans-board-list tr, .board_list tr, .ec-base-table tr');
    
    for (const row of rows) {
      const link = row.querySelector('a[href*="no="], a[href*="/article/"]');
      if (!link) continue;

      const match = link.href.match(/no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      const articleNo = match[1];
      const subject = link.innerText.replace(/\[\d+\]$/, '').trim();
      const writerEl = row.querySelector('.name, .writer, [class*="writer"]');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject,
        content: "", // 목록에서는 빈값 전송 (상세페이지에서 채우도록)
        writer: writer,
        stars: 5,
        image_urls: [CONFIG.defaultImg]
      });
    }
  }

  // --- [DB 전송] 중복 해결 및 덮어쓰기 ---
  async function postToDB(data) {
    if (!data.article_no || data.article_no === 'undefined') return;

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
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

      if (res.ok) console.log(`✅ [${data.article_no}] 동기화 완료`);
    } catch (e) { console.error("전송 에러:", e); }
  }

  setTimeout(syncReview, 2500);
})();