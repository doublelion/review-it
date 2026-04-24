/**
 * @Project: Review-It Collector v3.0 (Perfect Integration)
 * @Description: Cafe24 DOM 완벽 대응, Upsert 충돌 해결, 작성자/내용 정밀 추출
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png'
  };

  async function syncReview() {
    const isBoard = window.location.pathname.includes('/board/') || window.location.pathname.includes('/article/');
    if (!isBoard) return; // 게시판이 아니면 즉시 종료 (가짜 데이터 방지)

    console.log("🚀 [Review-it] 리뷰 스캔 시작...");
    const readPage = document.querySelector('.xans-board-read, #board_read');

    if (readPage) {
      await handleReadPage(readPage);
    } else {
      await handleListPage();
    }
  }

  // --- 상세 페이지 수집 (진짜 본문과 고화질 이미지) ---
  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();
      if (!articleNo || isNaN(articleNo)) return;

      const subject = (container.querySelector('h3, .subject, .title') || { innerText: '' }).innerText.replace(/\[\d+\]$/, '').trim();

      // 작성자 탐색 강화 (다양한 카페24 클래스 대응)
      const writerEl = container.querySelector('.name, .writer, .author, td[class*="writer"]');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";

      const contentArea = container.querySelector('.detail, .content, .read_info, #board_detail');
      let imageUrls = [];
      if (contentArea) {
        const imgs = contentArea.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs).map(img => img.getAttribute('src'))
          .filter(src => src && src.length > 10 && !src.includes('clear.gif'))
          .map(src => src.startsWith('http') ? src : (src.startsWith('//') ? 'https:' + src : window.location.origin + src));
      }

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject || "리뷰",
        content: contentArea?.innerText.trim().substring(0, 500) || "", // 진짜 본문 추출
        writer: writer,
        stars: extractStars(container),
        image_urls: imageUrls.length > 0 ? imageUrls : [CONFIG.defaultImg]
      });
    } catch (e) { console.error("상세 수집 에러:", e); }
  }

  // --- 목록 페이지 수집 (기본 정보 선점) ---
  async function handleListPage() {
    const listContainer = document.querySelector('.xans-board-list, .board_list');
    if (!listContainer) return;

    const links = listContainer.querySelectorAll('a[href*="no="], a[href*="/article/"]');
    for (let link of links) {
      let subject = link.innerText.trim();
      // 댓글수 [1] 같은 텍스트 제거
      subject = subject.replace(/\[\d+\]$/, '').trim();
      if (subject.length < 2) continue;

      const match = link.getAttribute('href').match(/no=(\d+)/) || link.getAttribute('href').match(/\/(\d+)\/?$/);
      if (!match) continue;

      const row = link.closest('tr') || link.closest('li');
      const writerEl = row?.querySelector('.name, .writer, .author, td[class*="writer"]');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(match[1]),
        subject: subject,
        // 목록에서는 content를 비워서, 나중에 상세페이지 수집 시 덮어써지도록 유도
        content: "",
        writer: writer,
        stars: extractStars(row),
        image_urls: [CONFIG.defaultImg] // 목록은 우선 임시 이미지 배정
      });
    }
  }

  // 별점 추출 공통 함수
  function extractStars(element) {
    if (!element) return 5;
    const starImg = element.querySelector('img[src*="star"]');
    if (starImg && starImg.alt) {
      const score = starImg.alt.match(/\d+/);
      if (score) return parseInt(score[0]);
    }
    return 5;
  }

  // --- DB 전송 (Upsert 맥점) ---
  async function postToDB(data) {
    if (!data.article_no) return;

    try {
      // [맥점] on_conflict=mall_id,article_no 를 주소에 추가하여 SQL의 UNIQUE 제약조건과 연결!
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        // DB에 값이 이미 있는데 빈 값을 보내면 기존 값을 유지하도록 처리
        body: JSON.stringify(data)
      });

      if (res.ok) console.log(`✅ [${data.article_no}] 데이터 적재 완료`);
    } catch (e) { console.error("네트워크 오류:", e); }
  }

  setTimeout(syncReview, 2000);
})();