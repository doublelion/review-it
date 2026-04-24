(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879'
  };

  // 중복 전송 방지를 위한 캐시 (현재 세션에서 한 번 보낸 건 다시 안 보냄)
  const sentCache = new Set();

  async function sync() {
    const path = location.pathname;
    const isReadPage = document.querySelector('.xans-board-read, #board_read, [id*="readContent"]');
    
    if (isReadPage) {
      console.log("📸 [Review-it] 상세 페이지 분석 시작...");
      const params = new URLSearchParams(location.search);
      const no = params.get('no') || path.split('/').filter(Boolean).pop();
      
      if (sentCache.has(no)) return;

      const contentEl = document.querySelector('.detail, .content, #board_detail, .fr-view, .view_content, .articleContent');
      const subjectEl = document.querySelector('.subject, h3, .title, .boardView h2');
      
      if (!contentEl) return;

      const imgs = Array.from(contentEl.querySelectorAll('img'))
                    .map(i => i.src)
                    .filter(s => s.length > 30 && !/star|icon|gift|check/.test(s));

      await send({
        article_no: String(no),
        subject: subjectEl?.innerText.replace(/\[\d+\]$/, '').trim() || "리뷰",
        content: contentEl.innerText.substring(0, 1000).trim(), // 본문 너무 길면 절삭
        writer: document.querySelector('.name, .writer, .author')?.innerText.split('(')[0].trim() || "고객",
        image_urls: imgs.length ? imgs : []
      });
    } else if (/board|article/.test(path)) {
      // 리스트 페이지: 중복 번호 추출 방지
      console.log("📋 [Review-it] 리스트 페이지 스캔 중...");
      const links = document.querySelectorAll('a[href*="no="], a[href*="/article/"]');
      const articleIds = new Set();

      links.forEach(link => {
        const m = link.href.match(/no=(\d+)/) || link.href.match(/\/(\d+)\/?$/);
        if (m && link.innerText.trim().length > 2) articleIds.add(m[1]);
      });

      // 리스트에서는 최소한의 정보만 전송 (상세 페이지 접속 시 업데이트 되도록)
      for (const id of articleIds) {
        if (!sentCache.has(id)) {
          await send({ article_no: String(id), subject: "리스트 수집 데이터", content: "상세 내용 수집 대기 중" });
        }
      }
    }
  }

  async function send(data) {
    try {
      sentCache.add(data.article_no);
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: { 
          'apikey': CONFIG.sbKey, 
          'Authorization': `Bearer ${CONFIG.sbKey}`, 
          'Content-Type': 'application/json', 
          'Prefer': 'resolution=merge-duplicates' // UPSERT 동작 유도
        },
        body: JSON.stringify({ ...data, mall_id: CONFIG.mallId, is_visible: true })
      });
      
      if (res.status === 409) {
        console.warn(`⚠️ [${data.article_no}] 이미 존재함 (Conflict)`);
      } else if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ [${data.article_no}] 에러: ${res.status}`, errorText);
      } else {
        console.log(`✅ [${data.article_no}] 동기화 완료`);
      }
    } catch (e) {
      console.error("🚀 전송 실패:", e);
    }
  }

  // 카페24 동적 로딩 대응을 위해 2.5초 후 1회 실행
  window.addEventListener('load', () => setTimeout(sync, 2500));
})();