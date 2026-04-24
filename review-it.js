/**
 * @Project: Review-It Collector (SaaS Version) - Cafe24 Precision Mapping
 * @Description: 게시판의 실제 제목(Subject)과 썸네일(Thumbnail) 경로를 정확히 추출
 */

(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 1. 카페24 게시판 테이블 행 추출
    const reviewElements = document.querySelectorAll('.xans-board-listpackage table tbody tr');

    if (reviewElements.length === 0) return;

    for (let el of reviewElements) {
      try {
        // [번호 추출] 공지사항 등은 제외 (숫자가 아닌 경우 패스)
        const noText = el.querySelector('td:nth-child(1)')?.innerText.trim();
        if (!noText || isNaN(parseInt(noText))) continue;

        const articleNo = noText;

        // [제목 추출 - 정밀] 
        // 카페24 게시판 제목은 보통 .subject 클래스 안의 a 태그나 span에 들어있습니다.
        const subjectAnchor = el.querySelector('td.subject a') || el.querySelector('.subject a');
        let subject = '제목 없음';
        if (subjectAnchor) {
            // 링크 내부의 아이콘(new, image 등) 텍스트를 제외하고 순수 제목만 추출
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = subjectAnchor.innerHTML;
            const icons = tempDiv.querySelectorAll('img, span');
            icons.forEach(icon => icon.remove());
            subject = tempDiv.innerText.trim();
        }

        // [이미지 추출 - 정밀]
        // 게시판 목록의 썸네일 이미지를 찾습니다. 
        let imageUrls = [];
        const thumbImg = el.querySelector('img[src*="/web/upload/"], .thumb img, .displaynone img');
        if (thumbImg && thumbImg.src) {
            let src = thumbImg.src;
            // 상대 경로인 경우 현재 도메인 결합
            if (src.startsWith('/')) src = window.location.origin + src;
            imageUrls.push(src);
        }

        // [작성자 & 별점]
        const writer = el.querySelector('.writer, td:nth-child(3)')?.innerText.trim() || '익명';
        const starImg = el.querySelector('img[src*="star"]');
        const stars = starImg ? (parseInt(starImg.src.match(/star(\d+)/)?.[1]) || 5) : 5;

        // [전송]
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
            subject: subject,
            content: subject, // 목록 수집 시에는 제목을 내용으로 활용
            writer: writer,
            stars: stars,
            image_urls: imageUrls,
            is_visible: true
          })
        });

      } catch (err) {
        console.error('❌ 수집 오류:', err);
      }
    }
    console.log("✅ [Review-it] 현재 페이지 데이터 수집/갱신 완료");
  }

  window.addEventListener('load', () => {
    // 카페24 동적 렌더링을 위해 2.5초 뒤 실행
    setTimeout(syncReview, 2500); 
  });
})();