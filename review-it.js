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
        const articleNo = el.getAttribute('data-article-no') || el.querySelector('a')?.href.match(/no=(\d+)/)?.[1];

        // 1. 제목 추출 강화
        const subject = el.querySelector('.subject, .title, td.title, .summary')?.innerText.trim() || '제목 없음';

        // 2. 내용 추출 강화 (중요!)
        // 카페24는 내용이 숨겨져 있거나(displaynone), 다른 클래스에 있는 경우가 많습니다.
        const contentEl = el.querySelector('.content, .view_content_raw, .post-content, td.content, .detail, .displaynone');
        let content = contentEl ? (contentEl.innerHTML || contentEl.innerText) : '';

        // 만약 여전히 비어있다면, 제목이라도 넣어서 NULL 에러 방지
        if (!content || content.trim() === "") content = subject;

        // 3. 작성자 및 별점
        const writer = el.querySelector('.writer, .user-id, td.writer')?.innerText.trim() || '익명';
        const stars = parseInt(el.querySelector('.star-rating, .star-rate, [class*="star"]')?.className.match(/\d+/)?.[0]) || 5;

        // 4. 전송 (Prefer 헤더 오타 수정 확인!)
        const response = await fetch(`${CONFIG.sbUrl}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.sbKey,
            'Authorization': `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // ✅ merge-counter가 아님!
          },
          body: JSON.stringify({
            mall_id: CONFIG.mallId,
            article_no: String(articleNo),
            subject: subject,
            content: content, // 이제 절대 NULL이 아님
            writer: writer,
            stars: stars,
            is_visible: true
          })
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