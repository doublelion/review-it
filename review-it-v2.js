/**
 * @Project: Review-It Collector (SaaS)
 * @Version: 3.0 (Front-API Driven)
 * @Updated: 2026-04-29
 * @Description: 카페24 Front API 연동을 통한 무결점 데이터 수집 (스킨 독립형)
 */

(function () {
  const CONFIG = {
    // [중요] 카페24 개발자 센터에서 발급받은 '앱 클라이언트 ID'를 입력해야 합니다.
    clientId: '7a4DjaLfJqbDfwo2yPxdTH',
    boardNo: 4, // 상품후기 게시판 번호
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: CAFE24API.MALL_ID || window.location.hostname.split('.')[0]
  };

  async function sendToSupabase(payload) {
    if (payload.length === 0) return;

    try {
      const response = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // DB의 UNIQUE 제약조건과 결합되어 중복 방지
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ REVIEW-IT: API를 통해 ${payload.length}개의 리뷰 완벽 동기화`);
      } else {
        console.error('❌ Supabase 전송 실패:', await response.json());
      }
    } catch (err) {
      console.error('❌ Network Error:', err);
    }
  }

  function fetchReviewsFromAPI() {
    if (typeof CAFE24API === 'undefined') {
      return console.error('❌ REVIEW-IT: CAFE24API 객체를 찾을 수 없습니다.');
    }

    console.log('🚀 [REVIEW-IT] Front API 리뷰 수집 엔진 가동...');

    // 1. 카페24 API 초기화
    CAFE24API.init(CONFIG.clientId);

    // 2. 4번 게시판(상품후기) 데이터 직접 호출 (embed를 통해 첨부파일까지 한 번에 가져옴)
    const endpoint = `/api/v2/boards/${CONFIG.boardNo}/articles?limit=20&embed=attach_files`;

    CAFE24API.get(endpoint, function (err, res) {
      if (err) {
        console.error('❌ 카페24 API 호출 에러:', err);
        return;
      }

      const articles = res.articles || [];
      const payload = articles.map(article => {

        // 첨부파일 배열 추출 (이미지 여러 장 지원)
        const imageUrls = article.attach_files
          ? article.attach_files.map(file => file.url)
          : [];

        // 데이터 정제
        return {
          mall_id: CONFIG.mallId,
          article_no: String(article.article_no),
          subject: article.title,
          content: article.content.replace(/<[^>]*>?/gm, '').trim(), // HTML 태그 제거 및 본문 확보
          writer: article.writer || '고객',
          stars: 5, // 별점은 카페24 설정에 따라 추가 파싱이 필요할 수 있음
          image_urls: imageUrls,
          is_visible: true,
          updated_at: new Date().toISOString()
        };
      });

      // 3. Supabase로 일괄 전송
      sendToSupabase(payload);
    });
  }

  // 브라우저 렌더링에 구애받지 않으므로 즉시, 혹은 API 객체 로딩 후 실행
  if (document.readyState === 'complete') {
    fetchReviewsFromAPI();
  } else {
    window.addEventListener('load', fetchReviewsFromAPI);
  }
})();