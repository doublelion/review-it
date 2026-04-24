(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    const reviewElements = document.querySelectorAll('.xans-record-, .review-item');
    if (reviewElements.length === 0) return;

    for (let el of reviewElements) {
      try {
        const linkEl = el.querySelector('a[href*="/article/"], a[href*="/product/read.html"]');
        if (!linkEl) continue;

        const href = linkEl.getAttribute('href');
        const articleNo = href.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] || href.match(/no=(\d+)/)?.[1];
        if (!articleNo) continue;

        let subject = linkEl.childNodes[0]?.textContent?.trim() || linkEl.innerText.trim();
        subject = subject.replace(/\[\d+\]$/, '').trim();

        const writerEl = el.querySelector('.writer, .name, td:nth-child(5)');
        const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : '고객';
        
        const starImg = el.querySelector('img[alt*="점"]');
        const stars = starImg ? parseInt(starImg.alt.replace(/[^0-9]/g, '')) : 5;

        // 전송 시작
        await fetch(`${CONFIG.sbUrl}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.KEY || CONFIG.sbKey,
            'Authorization': `Bearer ${CONFIG.KEY || CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            mall_id: CONFIG.mallId,
            article_no: String(articleNo),
            subject: subject,
            content: subject, // 리스트에선 제목과 동일하게 처리
            writer: writer,
            stars: stars,
            is_visible: true,
            image_urls: [], // 반드시 배열 형태 유지!
            updated_at: new Date().toISOString()
          })
        });
        
        console.log(`✅ Attempted: [${articleNo}]`);
      } catch (err) {
        console.error('❌ Error:', err);
      }
    }
  }

  setTimeout(syncReview, 2500);
})();