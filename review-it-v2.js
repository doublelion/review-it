/**
 * @Project: Review-It Universal Collector v11.0
 * @Description: 상세 페이지 기반 정밀 수집 + 자동 몰ID 감지 + 날짜/이름 정제 통합본
 */
(function (window) {
  // [1] 환경 감지 및 설정 자동화
  const getDynamicConfig = () => {
    // CAFE24 전역 객체 또는 호스트네임에서 Mall ID 추출
    const mallId = (window.CAFE24API && window.CAFE24API.getMallId)
      ? window.CAFE24API.getMallId()
      : window.location.hostname.split('.')[0].replace('m.', '');

    // URL 파라미터에서 상품 번호(product_no) 추출
    const urlParams = new URLSearchParams(window.location.search);
    const productNo = urlParams.get('product_no') || 'common';

    return {
      URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      MALL_ID: mallId,
      PRODUCT_NO: productNo,
      TARGET_BOARD_NO: '4',
      SPAM_KEYWORDS: /star|icon|btn|logo|dummy|ec2-common|rating/i,
      DEFAULT_IMG: `${window.location.origin}/web/upload/no-img.png`
    };
  };

  const CONFIG = getDynamicConfig();

  // [2] 상세 페이지 데이터 정밀 수집 함수
  async function fetchArticleDetail(articleNo) {
    try {
      const detailUrl = `/board/product/read.html?board_no=${CONFIG.TARGET_BOARD_NO}&no=${articleNo}`;
      const res = await fetch(detailUrl);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // 1. 작성자 정밀 추출 (.name 클래스 내 순수 텍스트)
      const nameEl = doc.querySelector('.description .name');
      let writer = "고객";
      if (nameEl) {
        writer = Array.from(nameEl.childNodes)
          .filter(node => node.nodeType === 3) // 텍스트 노드만 추출 (IP span 제외)
          .map(node => node.textContent.trim())
          .join('') || "고객";
      }

      // 2. 날짜 정밀 추출 및 정제 (YYYY-MM-DD 만 남김)
      const dateEl = doc.querySelector('.etcArea .txtNum');
      let rawDate = dateEl ? dateEl.innerText.trim() : "";
      let createdAt = rawDate.match(/^\d{4}-\d{2}-\d{2}/) 
        ? rawDate.match(/^\d{4}-\d{2}-\d{2}/)[0] 
        : new Date().toISOString().split('T')[0];

      // 3. 본문 내 첫 번째 유효 이미지 추출
      const detailImgs = Array.from(doc.querySelectorAll('.detail img, .fr-view img'))
        .map(img => img.getAttribute('src'))
        .filter(src => src && !CONFIG.SPAM_KEYWORDS.test(src));
      
      let thumb = detailImgs.length > 0 ? detailImgs[0] : '';
      if (thumb && thumb.startsWith('//')) thumb = 'https:' + thumb;

      // 4. 별점 이미지 alt값에서 숫자 추출 (예: 5점 -> 5)
      const starImg = doc.querySelector('.etcArea img[src*="star"], .etcArea img[alt*="점"]');
      const stars = starImg ? (starImg.getAttribute('alt').match(/\d/) ? parseInt(starImg.getAttribute('alt').match(/\d/)[0]) : 5) : 5;

      return { writer, createdAt, thumb, stars };
    } catch (e) {
      return { writer: "고객", createdAt: new Date().toISOString().split('T')[0], thumb: '', stars: 5 };
    }
  }

  // [3] 메인 동기화 로직
  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.MALL_ID} 데이터 정밀 수집 시작...`);
    
    // 리스트 아이템 선택자 (범용성 확보)
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr');
    const payload = [];

    for (const el of items) {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) continue;

      const href = link.getAttribute('href');
      
      // 게시판 번호 확인 및 게시글 번호 추출
      const boardMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      if (boardMatch && boardMatch[1] !== CONFIG.TARGET_BOARD_NO) continue;

      const articleNo = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/)?.[1];
      if (!articleNo) continue;

      // 상세 데이터 가져오기 (비동기 처리)
      const detail = await fetchArticleDetail(articleNo);

      payload.push({
        mall_id: CONFIG.MALL_ID,
        product_no: CONFIG.PRODUCT_NO,
        article_no: String(articleNo),
        board_no: CONFIG.TARGET_BOARD_NO,
        subject: link.innerText.trim() || "포토 리뷰",
        content: "상세보기 참조",
        writer: detail.writer,
        created_at: detail.createdAt,
        stars: detail.stars,
        image_urls: detail.thumb ? [detail.thumb] : [CONFIG.DEFAULT_IMG],
        is_visible: true
      });
    }

    if (payload.length > 0) {
      try {
        const res = await fetch(`${CONFIG.URL}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.KEY,
            'Authorization': `Bearer ${CONFIG.KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트(Upsert)
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) console.log(`✅ [REVIEW-IT] ${payload.length}개 리뷰 동기화 성공`);
      } catch (e) {
        console.error("❌ [REVIEW-IT] 전송 오류:", e);
      }
    }
  }

  // [4] 실행 시점 제어 (지연 로딩 대응)
  if (document.readyState === 'complete') {
    setTimeout(sync, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(sync, 1500));
  }
})(window);