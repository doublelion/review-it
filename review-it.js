(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_xxx',
    mallId: 'ecudemo389879'
  };

  const sentMap = new Map();

  async function sync() {
    if (!isDetailPage()) return;

    const articleNo = getArticleNo();
    if (!articleNo) return;

    if (sentMap.has(articleNo)) return;

    console.log('📸 상세페이지 수집 시작:', articleNo);

    const data = extractData(articleNo);

    if (!validate(data)) {
      console.log('⛔ 데이터 부족 → 스킵', articleNo);
      return;
    }

    await send(data);
    sentMap.set(articleNo, true);
  }

  function isDetailPage() {
    return document.querySelector('.xans-board-read, #board_read, .boardView');
  }

  function getArticleNo() {
    const url = new URL(location.href);
    return url.searchParams.get('no') ||
           location.pathname.match(/\/(\d+)\/?$/)?.[1];
  }

  function extractData(articleNo) {
    const contentEl =
      document.querySelector('#prdReviewContent') ||
      document.querySelector('.boardView .content') ||
      document.querySelector('.fr-view');

    const subjectEl =
      document.querySelector('.boardView .title') ||
      document.querySelector('.subject') ||
      document.querySelector('h3');

    const writerEl =
      document.querySelector('.boardView .writer') ||
      document.querySelector('.name');

    const imgs = contentEl
      ? Array.from(contentEl.querySelectorAll('img'))
          .map(i => i.src)
          .filter(src => src && src.length > 30 && !src.includes('icon'))
      : [];

    return {
      article_no: String(articleNo),
      subject: subjectEl?.innerText.trim() || '',
      content: contentEl?.innerText.trim() || '',
      writer: writerEl?.innerText.split('(')[0].trim() || '고객',
      image_urls: imgs
    };
  }

  function validate(data) {
    if (!data.article_no) return false;
    if (!data.subject || data.subject.length < 2) return false;
    if (!data.content || data.content.length < 10) return false;
    return true;
  }

  async function send(data) {
    try {
      const res = await fetch(
        `${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`,
        {
          method: 'POST',
          headers: {
            apikey: CONFIG.sbKey,
            Authorization: `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            ...data,
            mall_id: CONFIG.mallId,
            is_visible: true
          })
        }
      );

      if (!res.ok) {
        const err = await res.text();
        console.error('❌ 저장 실패:', res.status, err);
        return;
      }

      console.log(`✅ 저장 완료: ${data.article_no}`);
    } catch (e) {
      console.error('🔥 네트워크 오류', e);
    }
  }

  setTimeout(sync, 2000);
})();