/**
 * @Project: Review-It Collector (SaaS Version) - Cafe24 Precision Edition
 * @Description: 카페24 게시판의 복잡한 HTML 구조에서 제목, 작성자, 이미지를 100% 추출
 */

(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 1. 카페24 게시판 목록의 모든 행(tr)을 가져옵니다.
    const reviewElements = document.querySelectorAll('.xans-board-listpackage table tbody tr');
    
    if (reviewElements.length === 0) return;

    console.log(`🔎 [Review-it] ${reviewElements.length}개의 항목 분석 시작...`);

    for (let el of reviewElements) {
      try {
        // [번호 추출] 첫 번째 칸(td)에서 번호를 가져옵니다. 공지사항(img 등)이면 제외합니다.
        const noTd = el.querySelector('td:nth-child(1)');
        if (!noTd || isNaN(parseInt(noTd.innerText))) continue;
        const articleNo = noTd.innerText.trim();

        // [제목 추출] 'subject' 클래스 내부의 실제 텍스트만 추출 (아이콘 제외)
        const subjectTd = el.querySelector('td.subject');
        let subject = '제목 없음';
        if (subjectTd) {
            const link = subjectTd.querySelector('a');
            if (link) {
                // cloneNode를 사용하여 원본 훼손 없이 아이콘/이미지 제거 후 텍스트만 추출
                const clone = link.cloneNode(true);
                clone.querySelectorAll('img, span, i').forEach(n => n.remove());
                subject = clone.innerText.trim();
            }
        }

        // [작성자 추출] 보통 3번째 혹은 'writer' 클래스
        const writer = el.querySelector('.writer, td:nth-child(3)')?.innerText.trim() || '익명';

        // [이미지 추출] 썸네일 이미지가 있는지 확인
        let imageUrls = [];
        const thumb = el.querySelector('img[src*="/web/upload/"], .thumb img');
        if (thumb && thumb.src) {
            imageUrls.push(thumb.src);
        }

        // [별점 추출] 별점 이미지 파일명에서 숫자 추출
        const starImg = el.querySelector('img[src*="star"]');
        const stars = starImg ? (parseInt(starImg.src.match(/star(\d+)/)?.[1]) || 5) : 5;

        // [DB 전송]
        const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
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
            content: subject,
            writer: writer,
            stars: stars,
            image_urls: imageUrls,
            is_visible: true
          })
        });

        if(res.ok) console.log(`✅ [${articleNo}] 수집 완료: ${subject}`);

      } catch (err) {
        console.error('❌ 항목 처리 중 에러:', err);
      }
    }
  }

  // 카페24의 느린 렌더링을 고려해 3초 뒤 실행
  window.addEventListener('load', () => setTimeout(syncReview, 3000));
})();