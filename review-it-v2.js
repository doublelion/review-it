/**
 * @Project: Review-It Universal Collector v10.1
 * @Goal: 상세 페이지 기반 정밀 수집 + 날짜 형식 최적화 (YYYY-MM-DD)
 */
(function (window) {
  const CONFIG = {
    URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    MALL_ID: window.location.hostname.split('.')[0].replace('m.', ''),
    TARGET_BOARD_NO: '4',
    SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|rating/i
  };

  async function fetchArticleDetail(articleNo) {
    try {
      const res = await fetch(`/board/product/read.html?board_no=${CONFIG.TARGET_BOARD_NO}&no=${articleNo}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // 1. 작성자 추출 (span.name 클래스에서 IP 등을 제외한 순수 텍스트)
      const nameEl = doc.querySelector('.description .name');
      let writer = "고객";
      if (nameEl) {
        writer = Array.from(nameEl.childNodes)
          .filter(node => node.nodeType === 3) // 텍스트 노드만
          .map(node => node.textContent.trim())
          .join('') || "고객";
      }

      // 2. 날짜 추출 및 정제 (2026-01-28 12:30:30 -> 2026-01-28)
      const dateEl = doc.querySelector('.etcArea .txtNum');
      let rawDate = dateEl ? dateEl.innerText.trim() : "";
      // [핵심 로직] T 이후 혹은 공백 이후의 시각 정보를 날려버림
      let createdAt = rawDate.match(/^\d{4}-\d{2}-\d{2}/) ? rawDate.match(/^\d{4}-\d{2}-\d{2}/)[0] : new Date().toISOString().split('T')[0];

      // 3. 이미지 추출 (본문 내 첫 번째 이미지)
      const detailImgs = Array.from(doc.querySelectorAll('.detail img'))
        .map(img => img.getAttribute('src'))
        .filter(src => src && !CONFIG.SPAM_KEYWORDS.test(src));

      let thumb = detailImgs.length > 0 ? detailImgs[0] : '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      return { writer, createdAt, thumb };
    } catch (e) {
      return { writer: "고객", createdAt: new Date().toISOString().split('T')[0], thumb: '' };
    }
  }

  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.MALL_ID} 수집 엔진 가동...`);
    const items = document.querySelectorAll('.xans-record-');
    const payload = [];

    for (const el of items) {
      const link = el.querySelector('a[href*="article/"]');
      if (!link) continue;

      const articleNo = link.getAttribute('href').match(/\/(\d+)\/?$/)?.[1];
      if (!articleNo) continue;

      const detail = await fetchArticleDetail(articleNo);

      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim(),
        content: "상세보기 참조",
        writer: detail.writer,
        created_at: detail.createdAt, // "2026-01-28" 형식으로 깔끔하게 저장
        stars: 5,
        image_urls: detail.thumb ? [detail.thumb] : [],
        is_visible: true
      });
    }

    if (payload.length > 0) {
      await fetch(`${CONFIG.URL}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.KEY,
          'Authorization': `Bearer ${CONFIG.KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      console.log(`✅ [REVIEW-IT] ${payload.length}개 데이터 최신화 완료`);
    }
  }

  setTimeout(sync, 1500);
})(window);