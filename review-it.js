/**
 * @Project: Review-It Collector v3.5 (Final Gold)
 * @Description: 카페24 타겟팅 정밀화 및 데이터 오염 원천 차단
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: 'https://via.placeholder.com/400x533?text=Review-It'
  };

  async function syncReview() {
    // 게시판/아티클 경로가 아니면 절대 작동 안 함 (메인 페이지 가짜 데이터 방지)
    if (!/board|article/.test(window.location.pathname)) return;

    const readContainer = document.querySelector('.xans-board-read, #board_read, .ec-base-table.typeWrite');
    if (readContainer) {
      await handleReadPage(readContainer);
    } else {
      await handleListPage();
    }
  }

  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();
      if (!articleNo || articleNo === 'undefined' || isNaN(articleNo)) return;

      const subject = (container.querySelector('h3, .subject, [class*="subject"]') || {innerText:''}).innerText.replace(/\[\d+\]$/, '').trim();
      const writerEl = container.querySelector('.name, .writer, .author, [class*="writer"], td:nth-child(2)');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";
      
      const contentEl = container.querySelector('.detail, .content, #board_detail, .fr-view, .view_content');
      const content = contentEl ? contentEl.innerText.trim() : "";
      
      let imageUrls = [];
      if (contentEl) {
        const imgs = contentEl.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs).map(img => img.src).filter(src => src && src.length > 20);
      }

      await postToDB({
        mall_id: CONFIG.mallId, article_no: String(articleNo), subject: subject,
        content: content, writer: writer, stars: 5,
        image_urls: imageUrls.length > 0 ? imageUrls : [CONFIG.defaultImg]
      });
    } catch (e) { console.error(e); }
  }

  async function handleListPage() {
    const rows = document.querySelectorAll('.xans-board-list tr, .board_list tr, .ec-base-table tr');
    for (const row of rows) {
      const link = row.querySelector('a[href*="no="], a[href*="/article/"]');
      if (!link) continue;
      const match = link.href.match(/no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      const writerEl = row.querySelector('.name, .writer, [class*="writer"]');
      await postToDB({
        mall_id: CONFIG.mallId, article_no: String(match[1]),
        subject: link.innerText.replace(/\[\d+\]$/, '').trim(),
        content: "", writer: writerEl ? writerEl.innerText.split('(')[0].trim() : "고객",
        stars: 5, image_urls: [CONFIG.defaultImg]
      });
    }
  }

  async function postToDB(data) {
    if (!data.article_no || data.article_no === 'undefined') return;
    await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' 
      },
      body: JSON.stringify({ ...data, is_visible: true, created_at: new Date().toISOString() })
    });
  }

  setTimeout(syncReview, 2500);
})();