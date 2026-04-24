(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // 발급받은 Anon Key 입력
    mallId: 'ecudemo389879'      // 몰 아이디
  };

  const sentMap = new Map();

  async function sync() {
    // 1. 상세 페이지 감지 (카페24 표준)
    if (!document.querySelector('.xans-board-readpackage, .xans-board-read, #board_read')) return;

    const articleNo = getArticleNo();
    if (!articleNo || sentMap.has(articleNo)) return;

    console.log('📸 [REVIEW-IT] 데이터 수집 시작:', articleNo);

    // 2. 데이터 추출
    const data = extractData(articleNo);

    // 3. 유효성 검증
    if (!data.subject || data.content.length < 5) {
      console.log('⛔ [REVIEW-IT] 내용 부족으로 스킵');
      return;
    }

    // 4. 전송
    await send(data);
    sentMap.set(articleNo, true);
  }

  function getArticleNo() {
    const url = new URL(location.href);
    return url.searchParams.get('no') || location.pathname.match(/\/(\d+)\/?$/)?.[1];
  }

  function extractData(articleNo) {
    // 본문 영역
    const contentEl = document.querySelector('.fr-view-article, .detail, #prdReviewContent, .boardView .content');
    
    // 제목
    const subjectEl = document.querySelector('.head h3, .subject, .boardView .title, h3');

    // 작성자 (IP 제거 로직 포함)
    const writerEl = document.querySelector('.description .name, .name, .boardView .writer');
    const rawWriter = writerEl?.innerText || '고객';
    const cleanWriter = rawWriter.split('(')[0].replace(/ip:/gi, '').trim();

    // 별점 (SQL의 stars 컬럼과 매칭)
    const ratingImg = document.querySelector('.etcArea img[src*="star-rating"], .point img[src*="star"]');
    let starCount = 5; // 기본값
    if (ratingImg) {
      const altText = ratingImg.alt || '';
      const match = altText.match(/\d/);
      if (match) starCount = parseInt(match[0]);
    }

    // 이미지 추출 (SQL의 image_urls jsonb 컬럼과 매칭)
    const imgs = contentEl
      ? Array.from(contentEl.querySelectorAll('img'))
          .map(i => i.src)
          .filter(src => {
            return src && 
                   src.length > 30 && 
                   (src.includes('/web/upload/') || src.includes('file_directory')) && 
                   !src.includes('icon') && 
                   !src.includes('clear.gif');
          })
      : [];

    return {
      mall_id: CONFIG.mallId,
      article_no: String(articleNo),
      subject: subjectEl?.innerText.trim() || '',
      content: contentEl?.innerText.trim() || '',
      writer: cleanWriter,
      stars: starCount,        // SQL stars 컬럼명 일치
      image_urls: imgs,        // SQL image_urls 컬럼명 일치 (배열로 전달하면 jsonb가 자동 처리)
      is_visible: true
    };
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
            // 중요: unique_mall_article 제약조건을 이용한 Upsert 처리
            'Prefer': 'resolution=merge-duplicates' 
          },
          body: JSON.stringify(data)
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      console.log(`✅ [REVIEW-IT] 전송 성공: ${data.article_no} (${data.stars}점)`);
    } catch (e) {
      console.error('🔥 [REVIEW-IT] 오류 발생:', e.message);
    }
  }

  // 카페24 렌더링 속도를 고려하여 2초 후 실행
  setTimeout(sync, 2000);
})();