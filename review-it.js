/**
 * @Project: Review-It Collector v2.5 (Anti-Failure Edition)
 * @Description: 목록/상세 수집 로직 강화 및 이미지 경로 강제 보정
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0],
    defaultImg: '/web/upload/no-img.png' 
  };

  async function syncReview() {
    console.log("🚀 [Review-it] 수집 엔진 가동...");
    // 상세 페이지 판별 로직 강화
    const isReadPage = window.location.href.includes('/read.html') || document.querySelector('.xans-board-read');

    if (isReadPage) {
      console.log("📄 상세 페이지 분석 중...");
      await handleReadPage();
    } else {
      console.log("📋 목록 페이지 스캔 중...");
      await handleListPage();
    }
  }

  // --- 상세 페이지 수집 (정밀도 향상) ---
  async function handleReadPage() {
    try {
      const container = document.querySelector('.xans-board-read, #board_read, .ec-base-table.typeWrite');
      if (!container) return;

      const urlParams = new URLSearchParams(window.location.search);
      const articleNo = urlParams.get('no') || window.location.pathname.split('/').filter(Boolean).pop();

      // 작성자 추출 (IP 제거)
      let writerEl = container.querySelector('.name, .writer');
      let writer = writerEl ? writerEl.innerText.split('(')[0].trim() : "고객";

      // 이미지 추출 (본문 영역 이미지 전체 스캔)
      const contentArea = container.querySelector('.detail, .content, .fr-view, #board_detail');
      let imageUrls = [];
      if (contentArea) {
        const imgs = contentArea.querySelectorAll('img:not([src*="star"]):not([src*="icon"])');
        imageUrls = Array.from(imgs)
          .map(img => img.getAttribute('src'))
          .filter(src => src && src.length > 10 && !src.includes('clear.gif'));
      }

      // 경로 보정
      imageUrls = imageUrls.map(src => {
        if (src.startsWith('http')) return src;
        if (src.startsWith('//')) return 'https:' + src;
        return window.location.origin + src;
      });

      if (imageUrls.length === 0) imageUrls = [CONFIG.defaultImg];

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: container.querySelector('h3, .subject')?.innerText.trim() || "리뷰",
        content: contentArea?.innerText.trim() || "",
        writer: writer,
        stars: 5,
        image_urls: imageUrls
      });
    } catch (e) { console.error("상세페이지 에러:", e); }
  }

  // --- 목록 페이지 수집 (정규식 완화) ---
  async function handleListPage() {
    // 모든 리뷰 관련 링크 수집
    const allLinks = document.querySelectorAll('a[href*="/article/"], a[href*="no="], a[href*="/board/product/read"]');
    const processedNos = new Set();

    for (let link of allLinks) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // 숫자(게시글 번호)만 추출하는 더 강력한 정규식
      const match = href.match(/no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/read\.html\/(.+)\/(\d+)\//);
      if (!match) continue;

      const articleNo = match[match.length - 1]; // 매칭된 결과 중 마지막 숫자 그룹
      if (processedNos.has(articleNo)) continue;
      processedNos.add(articleNo);

      const row = link.closest('tr') || link.closest('li') || link.parentElement;
      
      // 목록 썸네일 (없으면 기본 이미지)
      const thumb = row.querySelector('img[src*="/web/upload/"], .thumb img, .thumbnail img');
      let imageUrls = thumb ? [thumb.src] : [CONFIG.defaultImg];

      await postToDB({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim() || "리뷰 제목",
        content: "",
        writer: row.querySelector('.writer, .name')?.innerText.split('(')[0].trim() || '고객',
        stars: 5,
        image_urls: imageUrls
      });
    }
  }

  async function postToDB(data) {
    // 세탁: placeholder 제거
    data.image_urls = data.image_urls.filter(url => url && !url.includes('placeholder'));
    if (data.image_urls.length === 0) data.image_urls = [CONFIG.defaultImg];

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
      if (res.ok) console.log(`✅ [${data.article_no}] 성공`);
    } catch (e) { }
  }

  setTimeout(syncReview, 2500); // 렌더링 대기 시간 살짝 증가
})();