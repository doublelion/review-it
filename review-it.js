/**
 * @Project: Review-It Collector v2.4 (Final Integration)
 * @Description: 이미지 없을 때 기본 경로 지정 및 작성자 IP 제거 완벽 대응
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png' // 이미지 없을 때 기본 경로
  };

  async function syncReview() {
    console.log("🚀 [Review-it] 수집 시작...");
    const readPageContainer = document.querySelector('.xans-board-read, .ec-base-table.typeWrite');

    if (readPageContainer) {
      await handleReadPage(readPageContainer);
    } else {
      await handleListPage();
    }
  }

  // --- 상세 페이지 정밀 수집 ---
  async function handleReadPage(container) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').pop();

      // 1. 작성자 마스킹 전 전처리 (IP 제거)
      let writerEl = container.querySelector('.name');
      let writer = "고객";
      if (writerEl) {
        // IP(괄호 부분) 제거하고 순수 이름만 추출
        writer = writerEl.innerText.split('(')[0].trim();
      }

      // 2. 이미지 추출 (본문 .detail 내 이미지)
      const images = container.querySelectorAll('.detail img:not([src*="star"]), .fr-view img');
      let imageUrls = Array.from(images)
        .map(img => img.getAttribute('src'))
        .filter(src => src && !src.includes('star') && !src.includes('icon') && src.length > 5);

      // 3. 경로 보정
      imageUrls = imageUrls.map(src => {
        if (src.startsWith('http')) return src;
        if (src.startsWith('//')) return 'https:' + src;
        return window.location.origin + src;
      });

      // 4. 이미지 아예 없을 때 처리
      if (imageUrls.length === 0) imageUrls = [CONFIG.defaultImg];

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: container.querySelector('h3')?.innerText.trim() || "리뷰",
        content: container.querySelector('.detail')?.innerText.trim() || "",
        writer: writer,
        stars: 5,
        image_urls: imageUrls
      });
    } catch (e) { console.error("상세페이지 수집 에러:", e); }
  }

  // --- 목록 페이지 수집 ---
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

      // 목록 썸네일 추출 (없으면 기본 이미지)
      const thumb = row.querySelector('img[src*="/web/upload/"], .thumb img');
      let imageUrls = thumb ? [thumb.src] : [CONFIG.defaultImg];

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: link.innerText.trim(),
        writer: row.querySelector('.writer, .name')?.innerText.split('(')[0].trim() || '고객',
        stars: 5,
        image_urls: imageUrls
      });
    }
  }

  // --- DB 전송 ---
  async function postToDB(data) {
    // placeholder가 이미 주소에 포함되어 있다면 기본이미지로 치환 (세탁 작업)
    if (data.image_urls[0] && data.image_urls[0].includes('placeholder')) {
      data.image_urls = [CONFIG.defaultImg];
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
        body: JSON.stringify({
          ...data,
          is_visible: true,
          created_at: new Date().toISOString()
        })
      });
      if (res.ok) console.log(`✅ [${data.article_no}] 동기화 완료`);
    } catch (e) { console.error("DB 전송 실패:", e); }
  }

  setTimeout(syncReview, 2000);
})();