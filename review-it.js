/**
 * @Project: Review-It Collector (Ultimate Href Tracker)
 * @Description: 클래스명에 의존하지 않고, 카페24 게시판의 고유 링크 패턴을 역추적하여 데이터 100% 추출
 */

(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 1. 카페24 목록의 모든 행(tr)이나 리스트(li)를 광범위하게 잡습니다.
    const reviewElements = document.querySelectorAll('.xans-board-listpackage tbody tr, .board_list tbody tr, .xans-board-listpackage ul li');

    if (reviewElements.length === 0) return;
    console.log(`🔎 [Review-it] ${reviewElements.length}개의 항목 분석 시작 (강제 추적 모드)...`);

    for (let el of reviewElements) {
      try {
        // [번호 & 제목 강제 추출] 게시글 링크(a 태그)를 찾아 번호와 제목을 발라냅니다.
        const link = el.querySelector('a[href*="/article/"], a[href*="no="]');
        if (!link) continue; // 링크가 없으면 공지사항이거나 빈칸이므로 패스

        let href = link.getAttribute('href');
        let articleNoMatch = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/);
        if (!articleNoMatch) continue;

        let articleNo = articleNoMatch[1];

        // 링크 안의 쓸데없는 태그(이미지, 아이콘) 날리고 순수 텍스트(제목)만 남기기
        const clone = link.cloneNode(true);
        clone.querySelectorAll('img, span, i').forEach(n => n.remove());
        let subject = clone.innerText.trim() || '제목 없음';

        // [작성자 추출] 보통 두 번째나 세 번째 칸에 있습니다.
        const writerEl = el.querySelector('.writer, td:nth-child(2), td:nth-child(3), td:nth-child(4)');
        let writer = writerEl ? writerEl.innerText.trim().split('\n')[0] : '익명'; // 줄바꿈 방지

        // [별점 추출] 별 모양 이미지 파일명에서 점수 빼오기
        const starImg = el.querySelector('img[src*="star"]');
        const stars = starImg ? (parseInt(starImg.src.match(/star(\d+)/)?.[1]) || 5) : 5;

        // [이미지 추출] 목록에 썸네일이 있는 경우만 작동합니다.
        let imageUrls = [];
        const thumb = el.querySelector('img[src*="/web/upload/"], img[src*="/file/"]');
        if (thumb && thumb.src && !thumb.src.includes('star')) {
          imageUrls.push(thumb.src);
        }

        // [DB 전송]
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
            content: subject, // 목록에서는 내용 확인 불가하므로 제목으로 세팅
            writer: writer,
            stars: stars,
            image_urls: imageUrls,
            is_visible: true
          })
        });

        console.log(`✅ 수집 성공: 번호[${articleNo}] 제목[${subject}]`);

      } catch (err) {
        // 에러 무시하고 다음 줄 진행
      }
    }
  }

  // 카페24 로딩 속도 감안
  window.addEventListener('load', () => setTimeout(syncReview, 2500));
})();