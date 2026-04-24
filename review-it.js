(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    // 기획자님이 주신 실제 키 적용
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt', 
    mallId: 'ecudemo389879'
  };

  async function syncAll() {
    // 1. 카페24 리스트의 각 리뷰 행(tr)을 모두 잡습니다.
    const reviewRows = document.querySelectorAll('.review-item, .xans-record-');
    console.log(`🔎 [REVIEW-IT] ${reviewRows.length}개의 리뷰 항목 감지됨.`);
    
    for (const row of reviewRows) {
      // 2. 제목이 들어있는 a 태그 찾기
      const linkEl = row.querySelector('a[href*="/article/"], a[href*="/product/read.html"]');
      if (!linkEl) continue;

      // 3. 글번호(article_no) 추출
      const href = linkEl.getAttribute('href');
      const articleNoMatch = href.match(/\/(\d+)\/?(?:\?.*)?$/) || href.match(/no=(\d+)/);
      if (!articleNoMatch) continue;
      const articleNo = articleNoMatch[1];

      // 4. 제목(subject) 추출 - a태그 안의 순수 텍스트만 (댓글수 제외)
      let subject = linkEl.childNodes[0]?.textContent?.trim() || linkEl.innerText.trim();
      subject = subject.replace(/\[\d+\]$/, '').trim(); // [1] 같은 댓글수 제거

      // 5. 작성자(writer) 추출
      const writerEl = row.querySelector('td:nth-child(5), .writer, .name');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : '고객';

      // 6. 별점(stars) 추출
      const starImg = row.querySelector('img[alt*="점"]');
      const stars = starImg ? parseInt(starImg.alt.replace(/[^0-9]/g, '')) : 5;

      // 7. 데이터 패키징
      const payload = {
        mall_id: CONFIG.mallId,
        article_no: articleNo,
        subject: subject || "내용 없음",
        writer: writer,
        stars: stars,
        content: "리스트 수집 데이터", // 리스트 페이지 특성상 본문은 생략
        is_visible: true,
        updated_at: new Date().toISOString()
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
          // 409 에러 방지의 핵심: 중복 시 업데이트(UPSERT) 수행
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        console.log(`✅ [${data.article_no}] 수집 완료: ${data.subject.substring(0, 15)}...`);
      } else {
        const errorText = await res.text();
        console.error(`❌ [${data.article_no}] 전송 실패:`, errorText);
      }
    } catch (e) {
      console.error('🔥 네트워크 오류:', e);
    }
  }

  // 카페24의 동적 요소를 기다리기 위해 2.5초 후 실행
  console.log('🚀 [REVIEW-IT] 수집기 가동 중...');
  setTimeout(syncAll, 2500);
})();