/**
 * @Project: Review-It Universal Collector v10.0
 * @Strategy: 상세 페이지(View Page) 정밀 스캔을 통한 원본 데이터 확보
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

      // 1. 작성자 추출 (.name 클래스 하위의 순수 텍스트만)
      const nameEl = doc.querySelector('.description .name');
      let writer = "고객";
      if (nameEl) {
        // ip 표시용 span 등을 제외한 텍스트 노드만 추출
        writer = Array.from(nameEl.childNodes)
          .filter(node => node.nodeType === 3)
          .map(node => node.textContent.trim())
          .join('') || "고객";
      }

      // 2. 날짜 추출 (.etcArea 내의 .txtNum 클래스)
      const dateEl = doc.querySelector('.etcArea .txtNum');
      let createdAt = dateEl ? dateEl.innerText.trim() : new Date().toISOString();

      // 3. 이미지 추출 (본문 내 이미지 중 스팸 제외 첫 번째)
      const detailImgs = Array.from(doc.querySelectorAll('.detail img'))
        .map(img => img.getAttribute('src'))
        .filter(src => src && !CONFIG.SPAM_KEYWORDS.test(src));

      let thumb = detailImgs.length > 0 ? detailImgs[0] : '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      return { writer, createdAt, thumb };
    } catch (e) {
      return { writer: "고객", createdAt: new Date().toISOString(), thumb: '' };
    }
  }

  async function sync() {
    const items = document.querySelectorAll('.xans-record-');
    const payload = [];

    for (const el of items) {
      const link = el.querySelector('a[href*="article/"]');
      if (!link) continue;

      const articleNo = link.getAttribute('href').match(/\/(\d+)\/?$/)?.[1];
      if (!articleNo) continue;

      // 상세 페이지에서 정확한 이름과 날짜 가져오기
      const detail = await fetchArticleDetail(articleNo);

      payload.push({
        mall_id: CONFIG.MALL_ID,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim(),
        content: "상세보기 참조",
        writer: detail.writer,      // 정확한 작성자 이름 (하드코딩 없음)
        created_at: detail.createdAt, // 정확한 작성일시
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
      console.log(`✅ [REVIEW-IT] ${payload.length}개 동기화 완료`);
    }
  }

  setTimeout(sync, 1500);
})(window);