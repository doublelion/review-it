(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', // 제공해주신 키 적용
    mallId: 'ecudemo389879'
  };

  async function syncAll() {
    // 1. 카페24 리뷰 리스트 행 찾기
    const reviewRows = document.querySelectorAll('.review-item, .xans-record-');
    
    for (const row of reviewRows) {
      const linkEl = row.querySelector('a[href*="/article/"], a[href*="/product/read.html"]');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href');
      const articleNoMatch = href.match(/\/(\d+)\/?(?:\?.*)?$/) || href.match(/no=(\d+)/);
      if (!articleNoMatch) continue;
      const articleNo = articleNoMatch[1];

      // 2. 제목 추출 및 [댓글수] 제거
      let subject = linkEl.childNodes[0]?.textContent?.trim() || linkEl.innerText.trim();
      subject = subject.replace(/\[\d+\]$/, '').trim();

      // 3. 작성자 및 별점 추출 (SQL stars 컬럼 대응)
      const writerEl = row.querySelector('td:nth-child(5), .writer, .name');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : '고객';
      
      const starImg = row.querySelector('img[alt*="점"]');
      const stars = starImg ? parseInt(starImg.alt.replace(/[^0-9]/g, '')) : 5;

      // 4. Supabase SQL 스키마와 1:1 매칭되는 데이터 구조 (400 에러 방지)
      const payload = {
        mall_id: CONFIG.mallId,
        article_no: articleNo,
        subject: subject || "내용 없음",
        content: "리스트 수집 데이터", 
        writer: writer,
        stars: stars,           // SQL의 stars 컬럼과 이름 일치 필수
        image_urls: [],         // 리스트에선 일단 빈 배열로 (jsonb 대응)
        is_visible: true
      };

      await sendToSupabase(payload);
    }
  }

  async function sendToSupabase(data) {
    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          // 409 에러를 해결하고 덮어쓰기(Upsert)를 허용하는 핵심 헤더
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        console.log(`✅ [${data.article_no}] 동기화 성공: ${data.subject.substring(0, 10)}...`);
      } else {
        const errLog = await res.text();
        console.error(`❌ [${data.article_no}] 오류: ${res.status}`, errLog);
      }
    } catch (e) {
      console.error('🔥 네트워크 오류:', e);
    }
  }

  setTimeout(syncAll, 2000);
})();