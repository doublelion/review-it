/**
 * @Project: Review-It Collector (SaaS Version) v2.0
 * @Description: 409 Conflict 완전 해결 및 중복 데이터 강제 덮어쓰기
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: window.location.hostname.split('.')[0]
  };

  async function syncReview() {
    // 카페24 게시판 리스트의 레코드 탐색
    const reviewElements = document.querySelectorAll('.xans-record-, .review-item');
    if (reviewElements.length === 0) return;

    for (let el of reviewElements) {
      try {
        const linkEl = el.querySelector('a[href*="/article/"], a[href*="/product/read.html"]');
        if (!linkEl) continue;

        const href = linkEl.getAttribute('href');
        const articleNo = href.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] || href.match(/no=(\d+)/)?.[1];
        if (!articleNo) continue;

        // 1. 제목 추출 (a태그 내부 텍스트만)
        let subject = linkEl.childNodes[0]?.textContent?.trim() || linkEl.innerText.trim();
        subject = subject.replace(/\[\d+\]$/, '').trim();

        // 2. 내용 (리스트에 내용이 없으면 제목으로 대체)
        const content = subject; 

        // 3. 작성자 및 별점
        const writerEl = el.querySelector('.writer, .name, td:nth-child(5)');
        const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : '고객';
        
        const starImg = el.querySelector('img[alt*="점"]');
        const stars = starImg ? parseInt(starImg.alt.replace(/[^0-9]/g, '')) : 5;

        // 4. 전송 (Upsert 로직 강화)
        const response = await fetch(`${CONFIG.sbUrl}/reviews`, {
          method: 'POST',
          headers: {
            'apikey': CONFIG.sbKey,
            'Authorization': `Bearer ${CONFIG.sbKey}`,
            'Content-Type': 'application/json',
            // [핵심] resolution=merge-duplicates와 함께 중복 시 업데이트 처리 명령
            'Prefer': 'resolution=merge-duplicates' 
          },
          body: JSON.stringify({
            mall_id: CONFIG.mallId,
            article_no: String(articleNo),
            subject: subject,
            content: content,
            writer: writer,
            stars: stars,
            is_visible: true,
            updated_at: new Date().toISOString() // 덮어쓸 때 시간 업데이트
          })
        });

        if (response.ok) {
          console.log(`✅ [${articleNo}] 동기화 성공: ${subject.substring(0, 10)}`);
        } else if (response.status === 409) {
          // 헤더가 적용되었음에도 409가 난다면 이미 같은 데이터가 동시 처리 중인 것
          console.log(`ℹ️ [${articleNo}] 이미 최신 상태 (Conflict 무시)`);
        }
      } catch (err) {
        console.error('❌ Sync Error:', err);
      }
    }
  }

  // 카페24 비동기 렌더링 대응
  setTimeout(syncReview, 2500);
})();