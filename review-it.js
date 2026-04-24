/**
 * @Project: Review-It Collector v2.8 (Deep Diagnostics)
 * @Description: 수집 로그 정밀화 및 가짜 데이터 원천 차단
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png'
  };

  async function syncReview() {
    // 1. 페이지 성격 파악 로그
    const isBoard = window.location.pathname.includes('/board/') || window.location.pathname.includes('/article/');
    console.log(`🔍 [Review-it] 현재 페이지 경로: ${window.location.pathname} (게시판 여부: ${isBoard})`);

    if (!isBoard) {
      console.warn("⚠️ [Review-it] 게시판이 아니므로 수집을 중단합니다. (메인/상품페이지 제외)");
      return;
    }

    const readPage = document.querySelector('.xans-board-read, #board_read');
    if (readPage) {
      console.log("📄 상세 페이지 감지 - 분석 시작");
      await handleReadPage(readPage);
    } else {
      console.log("📋 목록 페이지 감지 - 분석 시작");
      await handleListPage();
    }
  }

  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();

      // 제목, 작성자, 평점 요소를 더 넓게 탐색
      const subject = (container.querySelector('h3') || container.querySelector('.subject') || { innerText: '' }).innerText.trim();
      const writer = (container.querySelector('.name') || container.querySelector('.writer') || { innerText: '고객' }).innerText.split('(')[0].trim();

      // 별점(평점) 추출 로직 보강
      let stars = 5;
      const starEl = container.querySelector('[class*="star"], [class*="rating"]');
      if (starEl) {
        const scoreMatch = starEl.className.match(/\d+/);
        if (scoreMatch) stars = parseInt(scoreMatch[0]);
        // 카페24 특유의 별점 이미지 alt값이나 width값 대응
        const starImg = starEl.querySelector('img');
        if (starImg && starImg.alt.includes('점')) stars = parseInt(starImg.alt);
      }

      console.log(`📝 분석 결과 - 번호: ${articleNo}, 제목: ${subject}, 작성자: ${writer}, 평점: ${stars}`);

      const contentArea = container.querySelector('.detail, .content, #board_detail');
      let imageUrls = [];
      if (contentArea) {
        const imgs = contentArea.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs).map(img => img.getAttribute('src'))
          .filter(src => src && src.length > 10)
          .map(src => src.startsWith('http') ? src : (src.startsWith('//') ? 'https:' + src : window.location.origin + src));
      }

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject || "내용 없음",
        content: contentArea?.innerText.trim().substring(0, 500) || "",
        writer: writer,
        stars: stars,
        image_urls: imageUrls.length > 0 ? imageUrls : [CONFIG.defaultImg]
      });
    } catch (e) { console.error("❌ 상세페이지 분석 중 에러:", e); }
  }

  async function handleListPage() {
    const listContainer = document.querySelector('.xans-board-list, .board_list, .ec-base-table');
    if (!listContainer) {
      console.error("❌ 목록 테이블을 찾을 수 없습니다.");
      return;
    }

    const links = listContainer.querySelectorAll('a[href*="no="], a[href*="/article/"]');
    console.log(`🔗 발견된 잠재적 리뷰 링크: ${links.length}개`);

    for (let link of links) {
      const subject = link.innerText.trim();
      if (subject.length < 2 || subject === "삭제된 게시글입니다.") continue;

      const href = link.getAttribute('href');
      const match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      const articleNo = match[1];
      const row = link.closest('tr') || link.closest('li');

      // 목록에서 별점 이미지 찾기
      let stars = 5;
      const starImg = row?.querySelector('img[src*="star"]');
      if (starImg && starImg.alt) {
        const score = starImg.alt.match(/\d+/);
        if (score) stars = parseInt(score[0]);
      }

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject,
        content: "목록 수집 데이터",
        writer: row?.querySelector('.name, .writer')?.innerText.split('(')[0].trim() || "고객",
        stars: stars,
        image_urls: [CONFIG.defaultImg]
      });
    }
  }

  async function postToDB(data) {
    if (!data.article_no || data.article_no === 'undefined' || data.subject === "내용 없음") {
      console.warn(`🚫 [${data.article_no}] 전송 부적합: 제목이나 번호가 없음`);
      return;
    }

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ ...data, is_visible: true, created_at: new Date().toISOString() })
      });

      if (res.ok) console.log(`🚀 [${data.article_no}] DB 전송 성공! (${data.subject})`);
      else console.error(`❌ [${data.article_no}] DB 거절: ${res.status}`);
    } catch (e) { console.error("❌ 네트워크 오류:", e); }
  }

  setTimeout(syncReview, 2500);
})();