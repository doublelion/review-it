(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879'
  };

  async function sync() {
    const path = location.pathname;
    if (!/board|article/.test(path)) return;

    // 1. 상세 페이지인지 확인 (글 번호가 경로 끝에 있거나 no= 가 있는 경우)
    const isReadPage = document.querySelector('.xans-board-read, #board_read, [id*="readContent"]');
    
    if (isReadPage) {
      console.log("📸 [Review-it] 상세 페이지 감지! 분석 시작...");
      
      const no = new URLSearchParams(location.search).get('no') || path.split('/').filter(Boolean).pop();
      
      // 카페24의 온갖 본문/이미지 클래스 다 뒤지기
      const contentEl = document.querySelector('.detail, .content, #board_detail, .fr-view, .view_content, .articleContent');
      const subjectEl = document.querySelector('.subject, h3, .title, .boardView h2');
      
      if (!contentEl) {
        console.error("❌ 본문 영역을 찾을 수 없습니다. 스킨 구조 확인 필요");
        return;
      }

      const imgs = Array.from(contentEl.querySelectorAll('img')).map(i => i.src)
                    .filter(s => s.length > 30 && !s.includes('star') && !s.includes('icon'));

      await send({
        article_no: String(no),
        subject: subjectEl?.innerText.replace(/\[\d+\]$/, '').trim() || "리뷰",
        content: contentEl.innerText.trim(),
        writer: document.querySelector('.name, .writer, .author')?.innerText.split('(')[0].trim() || "고객",
        image_urls: imgs.length ? imgs : ['/web/upload/no-img.png']
      });
    } else {
      // 2. 리스트 페이지
      console.log("📋 [Review-it] 리스트 페이지 스캔 중...");
      document.querySelectorAll('a[href*="no="], a[href*="/article/"]').forEach(async (link) => {
        const m = link.href.match(/no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
        if (m && link.innerText.trim().length > 2) {
          await send({ article_no: String(m[1]), subject: link.innerText.trim(), content: "" });
        }
      });
    }
  }

  async function send(data) {
    const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
      method: 'POST',
      headers: { 
        'apikey': CONFIG.sbKey, 
        'Authorization': `Bearer ${CONFIG.sbKey}`, 
        'Content-Type': 'application/json', 
        'Prefer': 'resolution=merge-duplicates' 
      },
      body: JSON.stringify({ ...data, mall_id: CONFIG.mallId, is_visible: true })
    });
    if (res.ok) console.log(`✅ [${data.article_no}] 동기화 완료: ${data.subject.substring(0,10)}...`);
  }

  setTimeout(sync, 2500);
})();