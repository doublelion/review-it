(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    // 연결 오류 방지를 위해 기본 이미지를 카페24 내부 경로로 변경
    defaultImg: '/web/upload/no-img.png' 
  };

  async function sync() {
    if (!/board|article/.test(location.pathname)) return;

    // 상세 페이지 컨테이너 확인
    const read = document.querySelector('.xans-board-read, #board_read, .ec-base-table.typeWrite');
    
    if (read) {
      console.log("📸 [상세페이지] 정밀 수집 중...");
      const no = new URLSearchParams(location.search).get('no') || location.pathname.split('/').pop();
      if (!no || isNaN(no)) return;

      // 본문 영역 타겟팅 강화
      const contentEl = document.querySelector('.detail, .content, #board_detail, .view_content');
      const content = contentEl ? contentEl.innerText.trim() : "";
      
      // 이미지 추출 (가장 중요한 부분)
      const imgs = contentEl ? Array.from(contentEl.querySelectorAll('img:not([src*="star"])'))
                    .map(i => i.src).filter(s => s && s.length > 30) : [];

      await send({
        article_no: String(no),
        subject: (document.querySelector('.subject, h3, .title') || {innerText:'리뷰'}).innerText.replace(/\[\d+\]$/, '').trim(),
        content: content, 
        writer: (document.querySelector('.name, .writer') || {innerText:'고객'}).innerText.split('(')[0].trim(),
        image_urls: imgs.length > 0 ? imgs : [CONFIG.defaultImg]
      });
    } else {
      console.log("📋 [목록페이지] 기본 정보 수집 중...");
      // 목록에서는 제목과 번호만 미리 선점 (본문은 비워둠)
      document.querySelectorAll('a[href*="no="], a[href*="/article/"]').forEach(async (link) => {
        const match = link.href.match(/no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
        if (match) {
          await send({ 
            article_no: String(match[1]), 
            subject: link.innerText.replace(/\[\d+\]$/, '').trim(), 
            content: "" // 본문은 상세페이지에서 채울 것이므로 빈값 전송
          });
        }
      });
    }
  }

  async function send(data) {
    await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
      method: 'POST',
      headers: { 'apikey': CONFIG.sbKey, 'Authorization': `Bearer ${CONFIG.sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ ...data, mall_id: CONFIG.mallId, is_visible: true })
    });
  }
  setTimeout(sync, 2500);
})();