/**
 * @Project: Review-It Collector v2.1 (Deep Tracer - Read Page Support)
 * @Description: 게시판 상세 페이지(Read)와 목록(List) 모두에서 이미지와 내용을 정밀 추출
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    console.log("🚀 [Review-it] 데이터 수집 및 동기화 시작...");

    // 1. 상세 페이지(Read) 인지 확인 (보내주신 DOM 구조 타겟팅)
    const readPageContainer = document.querySelector('.xans-board-read, .ec-base-table.typeWrite');

    if (readPageContainer) {
      console.log("📄 [Review-it] 상세 페이지 모드 감지");
      await handleReadPage(readPageContainer);
    } else {
      console.log("📋 [Review-it] 목록 페이지 모드 감지");
      await handleListPage();
    }
  }

  // --- 상세 페이지 전용 처리 함수 ---
  async function handleReadPage(container) {
    try {
      // 글번호 추출 (URL에서 추출)
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').pop();

      // 제목 & 내용 (상세페이지는 제목이 별도로 있음)
      const subject = container.querySelector('h3')?.innerText.trim() || "리뷰";
      const content = container.querySelector('.detail, .fr-view')?.innerText.trim() || "";
      const writer = container.querySelector('.name')?.innerText.trim() || "고객";

      // 별점 추출 (icon-star-rating5.svg 형태 대응)
      const starImg = container.querySelector('img[src*="star"], img[alt*="점"]');
      let stars = 5;
      if (starImg) {
        const starMatch = starImg.src.match(/rating(\d+)/) || starImg.alt.match(/(\d+)/);
        stars = starMatch ? parseInt(starMatch[1]) : 5;
      }

      // 🌟 이미지 추출 (가장 중요한 부분)
      // .detail 안의 fr-view 내부에 실제 사용자가 올린 이미지가 있음
      const images = container.querySelectorAll('.detail img:not([src*="star"]), .fr-view img');
      let imageUrls = Array.from(images)
        .map(img => img.getAttribute('src'))
        .filter(src => src && !src.includes('star') && !src.includes('icon'));

      // 상대경로일 경우 절대경로로 변환
      imageUrls = imageUrls.map(src => src.startsWith('http') ? src : window.location.origin + src);

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: subject,
        content: content,
        writer: writer,
        stars: stars,
        image_urls: imageUrls
      });
    } catch (e) { console.error("상세페이지 파싱 에러:", e); }
  }

  // --- 목록 페이지 전용 처리 함수 (기존 로직 강화) ---
  async function handleListPage() {
    const allLinks = document.querySelectorAll('a[href*="/article/"], a[href*="no="]');
    const processedNos = new Set();

    for (let link of allLinks) {
      let href = link.getAttribute('href');
      let match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      if (!match) continue;

      let articleNo = match[1];
      if (processedNos.has(articleNo)) continue;
      processedNos.add(articleNo);

      const row = link.closest('tr') || link.closest('li');
      if (!row) continue;

      // 목록에서도 썸네일이 있다면 추출
      const thumb = row.querySelector('img[src*="/web/upload/"], .thumb img');
      let imageUrls = thumb ? [thumb.src] : [];

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: link.innerText.trim(),
        writer: row.querySelector('.writer, .name')?.innerText.trim() || '고객',
        stars: 5, // 목록에선 별점 찾기 힘드므로 기본 5점
        image_urls: imageUrls
      });
    }
  }

  // --- DB 전송 공통 함수 ---
  async function postToDB(data) {
    const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.sbKey,
        'Authorization': `Bearer ${CONFIG.sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' // 중복시 업데이트(Upsert)
      },
      body: JSON.stringify({
        ...data,
        is_visible: true,
        created_at: new Date().toISOString()
      })
    });

    if (res.ok) console.log(`✅ Sync Success: [${data.article_no}] ${data.subject.substring(0, 10)}...`);
  }

  // 실행 지연 (카페24 렌더링 대기)
  setTimeout(syncReview, 2000);
})();