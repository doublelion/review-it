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
    // 1. 본문 영역 (상세페이지 전용)
    const contentEl = document.querySelector('.fr-view-article, .detail, #prdReviewContent, .boardView .content');

    // 2. 제목 추출 로직 (리스트의 a태그 vs 상세의 h3)
    // 리스트 페이지의 a 태그 내 제목을 먼저 찾고, 없으면 상세페이지 h3를 찾습니다.
    const listTitleLink = document.querySelector(`a[href*="/${articleNo}/"]`);
    let titleText = "";

    if (listTitleLink) {
      // a 태그 안에 있는 텍스트 중 댓글 수([1]) 등 불필요한 태그를 제외하고 순수 텍스트만 추출
      titleText = listTitleLink.childNodes[0]?.textContent?.trim() || listTitleLink.innerText.trim();
    } else {
      const subjectEl = document.querySelector('.head h3, .subject, .boardView .title, h3');
      titleText = subjectEl?.innerText.trim() || "";
    }

    // 3. 작성자 (IP 제거 로직)
    const writerEl = document.querySelector('.description .name, .name, .boardView .writer');
    const rawWriter = writerEl?.innerText || '고객';
    const cleanWriter = rawWriter.split('(')[0].replace(/ip:/gi, '').trim();

    // 4. 별점 추출
    const ratingImg = document.querySelector('.etcArea img[src*="star-rating"], .point img[src*="star"]');
    let starCount = 5;
    if (ratingImg) {
      const altText = ratingImg.alt || '';
      const match = altText.match(/\d/);
      if (match) starCount = parseInt(match[0]);
    }

    // 5. 이미지 추출
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
      subject: titleText,      // 수정된 제목 변수 적용
      content: contentEl?.innerText.trim() || '',
      writer: cleanWriter,
      stars: starCount,
      image_urls: imgs,
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