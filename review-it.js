/**
 * @Project: Review-It Collector Engine (SaaS v1.0)
 * @Description: 카페24 쇼핑몰 리뷰 자동 수집 스크립트
 */

(function () {
  // [보안 가이드] 추후 실제 배포시에는 이 설정을 외부 JSON이나 API에서 불러오도록 확장 가능합니다.
  const CONFIG = {
    SB_URL: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    SB_KEY: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // Client-side anon key
    SYNC_INTERVAL: 1000,
    MAX_ATTEMPTS: 10
  };

  // 1. Mall ID 추출 (카페24 전용 로직 강화)
  const getMallId = () => {
    try {
      // 카페24 글로벌 객체 확인
      if (window.CAFE24API && typeof window.CAFE24API.getMallId === 'function') {
        return window.CAFE24API.getMallId();
      }
      // EC_COMMON_UTIL 등 카페24 내부 변수 활용 시도
      if (window.EC_COMMON_UTIL && window.EC_COMMON_UTIL.getMallId) {
        return window.EC_COMMON_UTIL.getMallId();
      }
    } catch (e) {
      console.warn("[Review-It] API 추출 실패, 호스트네임으로 대체합니다.");
    }
    return window.location.hostname.split('.')[0] || 'unknown_mall';
  };

  const MALL_ID = getMallId();

  // 2. 이미지 URL 추출 도우미
  const extractImages = (element) => {
    const imgs = element.querySelectorAll('img');
    const urls = [];
    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.includes('icon') && !src.includes('star')) { // 아이콘 제외
        urls.push(src.startsWith('//') ? 'https:' + src : src);
      }
    });
    return urls;
  };

  // 3. 별점 추출 도우미 (이미지 alt값이나 클래스명 분석)
  const extractStars = (element) => {
    const starText = element.innerText + element.innerHTML;
    const match = starText.match(/star(\d)/i) || starText.match(/(\d)개/);
    return match ? parseInt(match[1]) : 5; // 기본값 5점
  };

  // 4. 데이터 전송 (Upsert)
  const syncToDB = async (items) => {
    console.log(`📦 [Review-It] ${items.length}개의 리뷰 후보 발견. 동기화 시작...`);

    for (const item of items) {
      const articleNo = item.getAttribute('data-no') || item.id?.replace(/[^0-9]/g, '');
      const subjectEl = item.querySelector('.subject, .title, strong');
      const subject = subjectEl?.innerText.trim() || "";

      // 🚫 가드 로직: 유효성 검사
      if (!articleNo || !subject || subject.length < 2) continue;

      const payload = {
        mall_id: MALL_ID,
        article_no: String(articleNo),
        subject: subject,
        writer: item.querySelector('.name, .writer, .author')?.innerText.trim() || "고객",
        content: item.innerHTML, // 전체 HTML 보존 (상세 노출용)
        stars: extractStars(item),
        image_urls: extractImages(item),
        is_visible: true, // 기본 노출
        created_at: new Date().toISOString()
      };

      try {
        const response = await fetch(`${CONFIG.SB_URL}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.SB_KEY,
            'Authorization': `Bearer ${CONFIG.SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // 핵심: 중복 데이터는 업데이트
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ [Review-It] 리뷰 저장 완료: ${articleNo}`);
        }
      } catch (err) {
        console.error("❌ [Review-It] 동기화 실패:", err);
      }
    }
  };

  // 5. 실행 엔진 (리뷰 리스트 탐지)
  let attempts = 0;
  const startCollector = () => {
    // 카페24의 다양한 테마 레이아웃 대응 셀렉터
    const selectors = [
      '.boardComment li', 
      '.commentList li', 
      '.xans-product-review .record', 
      '.review_list_item',
      '.xans-board-listall li'
    ];
    
    const items = document.querySelectorAll(selectors.join(', '));

    if (items.length > 0) {
      syncToDB(items);
    } else if (attempts < CONFIG.MAX_ATTEMPTS) {
      attempts++;
      setTimeout(startCollector, CONFIG.SYNC_INTERVAL);
    } else {
      console.log("ℹ️ [Review-It] 수집할 리뷰가 발견되지 않았습니다.");
    }
  };

  // 페이지 로드 후 실행
  if (document.readyState === 'complete') {
    startCollector();
  } else {
    window.addEventListener('load', startCollector);
  }
})();