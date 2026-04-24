/**
 * @Project: Review-It Collector (SaaS Version) - Optimized for Cafe24 Default Board
 * @Description: 게시판 목록의 텍스트와 썸네일 이미지를 정확히 매핑하여 수집
 */

(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 1. 카페24 게시판 목록의 행(tr) 탐색
    const reviewElements = document.querySelectorAll('.xans-board-listpackage table tbody tr');

    if (reviewElements.length === 0) {
      console.log("ℹ️ [Review-it] 수집 가능한 리뷰 행을 찾지 못했습니다.");
      return;
    }

    for (let el of reviewElements) {
      try {
        // 공지사항 등 번호가 없는 행 제외
        const noEl = el.querySelector('td:first-child');
        if (!noEl || isNaN(parseInt(noEl.innerText))) continue;

        const articleNo = noEl.innerText.trim();

        // 1. 제목 및 상세 링크 추출
        const subjectEl = el.querySelector('.subject a, .title a, td.subject');
        const subject = subjectEl ? subjectEl.innerText.trim() : '제목 없음';

        // 2. 작성자 및 별점
        const writer = el.querySelector('.writer, td:nth-child(3)')?.innerText.trim() || '익명';

        // 별점 이미지(icon_ztar) 등 클래스에서 숫자 추출 (없으면 5점)
        const starImg = el.querySelector('img[src*="star"], .displaynone img');
        const stars = starImg ? (parseInt(starImg.src.match(/star(\d+)/)?.[1]) || 5) : 5;

        // 3. 이미지 수집 로직 (핵심!)
        // 목록에 썸네일 이미지가 있다면 수집, 없으면 빈 배열
        let imageUrls = [];
        const thumbImg = el.querySelector('img[src*="/web/upload/"], .thumb img');
        if (thumbImg) {
          imageUrls.push(thumbImg.src.replace('https:', '').replace('http:', ''));
        }

        // 4. 전송
        const response = await fetch(`${CONFIG.sbUrl}/reviews`, {
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
            subject: subject,
            content: subject, // 목록에서는 상세내용 확인이 어려우므로 제목으로 대체
            writer: writer,
            stars: stars,
            image_urls: imageUrls, // ✅ 이제 실제 이미지 경로가 들어갑니다
            is_visible: true
          })
        });

        if (response.ok) {
          console.log(`✅ 수집 성공: [${articleNo}] ${subject}`);
        }
      } catch (err) {
        console.error('❌ 수집 중 오류:', err);
      }
    }
  }

  window.addEventListener('load', () => {
    console.log(`🚀 [Review-it] Monitoring: ${CONFIG.mallId}`);
    setTimeout(syncReview, 2000);
  });
})();