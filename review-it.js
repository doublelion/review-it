/**
 * @Project: Review-It Collector (SaaS Version)
 * @Updated: 2026-04-23
 * @Description: 카페24 게시판 데이터를 Supabase 신규 테이블 구조에 맞게 자동 전송
 */

(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0] // 상점 아이디 자동 추출
  };

  console.log(`🚀 [Review-it] Monitoring for: ${CONFIG.mallId}`);

  async function syncReview() {
    // 1. 카페24 상세페이지의 리뷰 엘리먼트 탐색 (선택자는 실제 환경에 맞게 조정 가능)
    const reviewElements = document.querySelectorAll('.review-item, .xans-board-listpackage li');

    if (reviewElements.length === 0) return;

    for (let el of reviewElements) {
      try {
        // 2. 데이터 추출
        const articleNo = el.getAttribute('data-article-no') || el.querySelector('a')?.href.match(/no=(\d+)/)?.[1];
        const subject = el.querySelector('.subject, .title')?.innerText.trim();
        const content = el.querySelector('.content, .view_content_raw')?.value || el.querySelector('.displaynone')?.innerText;
        const writer = el.querySelector('.writer, .user-id')?.innerText.trim();
        const stars = parseInt(el.querySelector('.star-rating, .star-rate')?.className.match(/\d+/)?.[0]) || 5;
        const date = el.querySelector('.date, .write-date')?.innerText.trim();

        // 이미지 추출 (여러 장일 경우 배열로)
        const imgs = Array.from(el.querySelectorAll('img')).map(img => img.src).filter(src => src.includes('/web/upload/'));

        if (!articleNo || !subject) continue;

        // 3. Supabase 전송 (Upsert: 중복이면 업데이트, 없으면 삽입)
        const payload = {
          mall_id: CONFIG.mallId,
          article_no: String(articleNo),
          subject: subject,
          content: content,
          writer: writer,
          stars: stars,
          date: date,
          image_urls: imgs,
          is_visible: true // 기본값 노출
        };

        const response = await fetch(`${CONFIG.sbUrl}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.sbKey,
            'Authorization': `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ Sync Success: [${articleNo}] ${subject.substring(0, 10)}...`);
        }
      } catch (err) {
        console.error('❌ Sync Error:', err);
      }
    }
  }

  // 페이지 로드 후 실행 및 게시판 탭 클릭 등 동적 로드 대응
  window.addEventListener('load', () => {
    setTimeout(syncReview, 2000); // 카페24 렌더링 대기
  });
})();