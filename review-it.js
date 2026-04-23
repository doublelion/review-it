/**
 * @Project: Review-It Collector Engine (SaaS Edition)
 */
const SUPABASE_URL = 'https://ozxnynnntkjjjhyszbms.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt';

(function () {
  // ✅ 1. 동적 Mall ID 추출 (카페24 환경 대응)
  const getMallId = () => {
    // 카페24 API 호출 시도, 실패 시 호스트네임의 첫 파트 추출
    return window.CAFE24API?.getMallId() || window.location.hostname.split('.')[0];
  };

  const MALL_ID = getMallId();
  console.log(`🚀 [Review-it] Monitoring for: ${MALL_ID}`);

  // ✅ 2. 데이터 전송 함수
  const syncToDB = async (items) => {
    if (!items || items.length === 0) return;

    for (const item of items) {
      const subject = item.querySelector('.subject')?.innerText.trim() || "";
      const contentRaw = item.innerHTML;
      const articleNo = item.getAttribute('data-no');

      // 🚫 가드 로직: 유효한 게시글 번호와 제목이 있어야 수집
      if (!articleNo || !subject || subject === "제목 없음" || subject.length < 2) {
        continue;
      }

      // 📦 전송 데이터 패키징 (MALL_ID 변수 적용)
      const payload = {
        mall_id: MALL_ID, 
        article_no: String(articleNo),
        subject: subject,
        writer: item.querySelector('.name, .writer')?.innerText.trim() || "고객",
        date: item.querySelector('.date')?.innerText.trim() || new Date().toISOString().split('T')[0],
        stars: 5,
        content: contentRaw,
        image_urls: []
      };

      try {
        await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트 처리
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Sync fail:", err);
      }
    }
  };

  // ✅ 3. 리스트 감지 및 실행 (최대 10회 시도 후 종료)
  let attempts = 0;
  const waitForReviews = () => {
    // 카페24 기본 게시판 및 커스텀 클래스 대응
    const items = document.querySelectorAll('.boardComment li, .commentList li, .rev-item, .xans-board-listall li');

    if (items.length > 0) {
      syncToDB(items);
    } else if (attempts < 10) {
      attempts++;
      setTimeout(waitForReviews, 800);
    }
  };

  waitForReviews();

})();