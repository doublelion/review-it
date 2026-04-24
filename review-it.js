(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // 실제 발급받은 키로 교체
    mallId: 'ecudemo389879'      // 해당 몰 아이디
  };

  const sentMap = new Map();

  async function sync() {
    // 1. 상세 페이지 여부 확인 (카페24 표준 클래스/ID 기반)
    if (!isDetailPage()) return;

    // 2. 게시글 번호 추출
    const articleNo = getArticleNo();
    if (!articleNo || sentMap.has(articleNo)) return;

    console.log('📸 [REVIEW-IT] 수집 시작:', articleNo);

    // 3. 데이터 추출
    const data = extractData(articleNo);

    // 4. 유효성 검사 (최소한 내용이 있어야 함)
    if (!validate(data)) {
      console.log('⛔ [REVIEW-IT] 데이터 부적합 (내용 부족 등):', articleNo);
      return;
    }

    // 5. 서버 전송
    await send(data);
    sentMap.set(articleNo, true);
  }

  function isDetailPage() {
    // xans-board-readpackage 클래스가 있으면 상세페이지로 판단
    return document.querySelector('.xans-board-readpackage, .xans-board-read');
  }

  function getArticleNo() {
    const url = new URL(location.href);
    // URL 파라미터 'no' 혹은 경로상의 숫자 추출
    const no = url.searchParams.get('no') || location.pathname.match(/\/(\d+)\/?$/)?.[1];
    return no;
  }

  function extractData(articleNo) {
    // 본문 영역 선택 (에디터 클래스 우선)
    const contentEl = document.querySelector('.fr-view-article') || 
                      document.querySelector('.detail') || 
                      document.querySelector('#prdReviewContent');

    // 제목 선택
    const subjectEl = document.querySelector('.head h3') || 
                      document.querySelector('.subject') || 
                      document.querySelector('h3');

    // 작성자 선택
    const writerEl = document.querySelector('.description .name') || 
                      document.querySelector('.name');

    // 별점 추출 (이미지 alt 속성에서 '5' 추출)
    const ratingEl = document.querySelector('.etcArea img[src*="icon-star-rating"]');
    const rating = ratingEl ? ratingEl.alt.replace(/[^0-9]/g, '') : '5';

    // 이미지 필터링 (실제 사용자가 올린 리뷰 이미지만)
    const imgs = contentEl
      ? Array.from(contentEl.querySelectorAll('img'))
          .map(i => i.src)
          .filter(src => {
            return src && 
                   src.length > 30 && 
                   src.includes('/web/upload/') && // 카페24 업로드 경로
                   !src.includes('icon') &&        // 아이콘 제외
                   !src.includes('clear.gif');     // 투명픽셀 제외
          })
      : [];

    return {
      article_no: String(articleNo),
      subject: subjectEl?.innerText.trim() || '',
      content: contentEl?.innerText.trim() || '',
      writer: writerEl?.innerText.replace(/\(ip:.*\)/g, '').trim() || '고객',
      rating: parseInt(rating) || 5,
      image_urls: imgs,
      collected_at: new Date().toISOString()
    };
  }

  function validate(data) {
    // 제목이나 내용이 너무 짧으면 수집하지 않음 (스팸 방지)
    return data.article_no && (data.subject.length > 1 || data.content.length > 5);
  }

  async function send(data) {
    try {
      const res = await fetch(
        `${CONFIG.sbUrl}/reviews`,
        {
          method: 'POST',
          headers: {
            apikey: CONFIG.sbKey,
            Authorization: `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트(Upsert)
          },
          body: JSON.stringify({
            ...data,
            mall_id: CONFIG.mallId,
            is_visible: true
          })
        }
      );

      if (!res.ok) throw new Error(await res.text());
      console.log(`✅ [REVIEW-IT] 동기화 완료: ${data.article_no}`);
    } catch (e) {
      console.error('🔥 [REVIEW-IT] 전송 오류:', e.message);
    }
  }

  // 카페24 동적 로딩 대응을 위해 1.5초 후 실행
  setTimeout(sync, 1500);
})();