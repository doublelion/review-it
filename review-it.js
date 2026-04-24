(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    defaultImg: 'https://via.placeholder.com/400x533?text=Review-It'
  };

  async function sync() {
    if (!/board|article/.test(location.pathname)) return; // 게시판만 감시

    const read = document.querySelector('.xans-board-read, #board_read');
    if (read) {
      // [상세 페이지] 여기서만 진짜 본문과 이미지를 긁음
      const no = new URLSearchParams(location.search).get('no') || location.pathname.split('/').pop();
      if (!no || isNaN(no)) return;

      const content = document.querySelector('.detail, .content, #board_detail')?.innerText.trim() || "";
      const imgs = Array.from(document.querySelectorAll('.detail img, .content img, #board_detail img'))
                    .map(i => i.src).filter(s => s.length > 30 && !s.includes('star'));

      await send({
        article_no: String(no),
        subject: document.querySelector('.subject, h3')?.innerText.replace(/\[\d+\]$/, '').trim() || "리뷰",
        content: content, // 진짜 본문 전송
        writer: document.querySelector('.name, .writer')?.innerText.split('(')[0].trim() || "고객",
        image_urls: imgs.length ? imgs : [CONFIG.defaultImg]
      });
    } else {
      // [목록 페이지] 여기서는 껍데기만 만듦
      document.querySelectorAll('a[href*="no="]').forEach(async (link) => {
        const no = link.href.match(/no=(\d+)/)?.[1];
        if (no) await send({ article_no: String(no), subject: link.innerText.trim(), content: "" });
      });
    }
  }

  async function send(data) {
    await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
      method: 'POST',
      headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ ...data, mall_id: CONFIG.mallId })
    });
  }
  setTimeout(sync, 2000);
})();