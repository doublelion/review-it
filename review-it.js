/**
 * @Project: Review-It Collector v2.0 (Deep Tracer)
 * @Description: 클래스명에 의존하지 않고 게시판 링크 패턴을 역추적하여 99% 수집
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 1. 카페24의 리뷰 게시글 링크 패턴(/article/게시판번호/번호/글번호)을 가진 모든 A태그를 찾습니다.
    const allLinks = document.querySelectorAll('a[href*="/article/"], a[href*="no="]');
    const processedNos = new Set();

    console.log(`🔎 [Review-it] ${allLinks.length}개의 잠재적 리뷰 링크 감지`);

    for (let link of allLinks) {
      try {
        let href = link.getAttribute('href');
        // 글번호 추출 (정규식 강화)
        let match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/(\d+)\/(\d+)\//);
        if (!match) continue;

        let articleNo = match[1] || match[match.length - 1];
        if (processedNos.has(articleNo)) continue;
        processedNos.add(articleNo);

        // 2. 해당 링크를 포함한 부모 행(Row)을 찾아 데이터를 파싱합니다.
        const row = link.closest('tr') || link.closest('li') || link.parentElement;

        // 작성자 추출 (범용 셀렉터)
        const writerEl = row.querySelector('.writer, .name, [class*="writer"], [class*="name"]') || row.querySelector('td:nth-child(3)');
        let writer = writerEl ? writerEl.innerText.trim() : '고객';

        // 별점 추출 (이미지 alt값 또는 파일명)
        const starImg = row.querySelector('img[src*="star"], img[alt*="별"]');
        let stars = 5;
        if (starImg) {
          const scoreMatch = starImg.src.match(/star(\d+)/) || starImg.alt.match(/(\d+)/);
          stars = scoreMatch ? parseInt(scoreMatch[1]) : 5;
          if (stars > 5) stars = stars / 20; // 100점 만점 대응
        }

        // 이미지 추출 (썸네일)
        let imageUrls = [];
        const thumb = row.querySelector('img[src*="/web/upload/"], .thumb img');
        if (thumb && !thumb.src.includes('star')) imageUrls.push(thumb.src);

        // 3. DB 전송
        await fetch(`${CONFIG.sbUrl}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.sbKey,
            'Authorization': `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            mall_id: CONFIG.mallId,
            article_no: String(articleNo),
            subject: link.innerText.trim() || '리뷰',
            content: link.innerText.trim(),
            writer: writer,
            stars: stars,
            image_urls: imageUrls,
            is_visible: true,
            created_at: new Date().toISOString()
          })
        });

      } catch (e) { }
    }
  }

  // 카페24는 스크립트 로드 시점이 중요하므로 3초 뒤 실행
  if (document.readyState === 'complete') {
    setTimeout(syncReview, 3000);
  } else {
    window.addEventListener('load', () => setTimeout(syncReview, 3000));
  }
})();