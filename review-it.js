/**
 * REVIEW-IT Collector v1.3 (Anti-409 Conflict)
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879'
  };

  async function syncAll() {
    // 1. 카페24 리스트 아이템 선택자 강화
    const rows = document.querySelectorAll('.xans-record-, .review-item');
    if (rows.length === 0) return;

    for (const row of rows) {
      const linkEl = row.querySelector('a[href*="/article/"], a[href*="/product/read.html"]');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href');
      const articleNo = href.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] || href.match(/no=(\d+)/)?.[1];
      if (!articleNo) continue;

      // 제목 추출 (a태그 안의 순환 구조 대응)
      let subject = linkEl.childNodes[0]?.textContent?.trim() || linkEl.innerText.trim();
      subject = subject.replace(/\[\d+\]$/, '').trim();

      const writerEl = row.querySelector('.writer, .name, td:nth-child(5)');
      const writer = writerEl ? writerEl.innerText.split('(')[0].trim() : '고객';

      const starImg = row.querySelector('img[alt*="점"]');
      const stars = starImg ? parseInt(starImg.alt.replace(/[^0-9]/g, '')) : 5;

      const payload = {
        mall_id: CONFIG.mallId,
        article_no: articleNo,
        subject: subject || "제목 없음",
        content: "리스트 수집 데이터",
        writer: writer,
        stars: stars,
        image_urls: [],
        is_visible: true,
        updated_at: new Date().toISOString() // 업데이트 시간 갱신
      };

      await sendRequest(payload);
    }
  }

  async function sendRequest(data) {
    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          // [핵심] 409 에러 해결사: 중복 발생 시 업데이트 처리
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify(data)
      });

      // 201(생성) 또는 204(성공적 처리)면 성공
      if (res.ok) {
        console.log(`✅ [${data.article_no}] 동기화 완료: ${data.subject.substring(0, 8)}...`);
      } else {
        const errText = await res.text();
        // 이미 덮어쓰기 로직이 작동 중이라도 간혹 발생하는 409는 여기서 로그만 남기고 무시
        if (res.status === 409) {
          console.log(`ℹ️ [${data.article_no}] 이미 최신 상태입니다.`);
        } else {
          console.error(`❌ [${data.article_no}] 에러 (${res.status}):`, errText);
        }
      }
    } catch (e) {
      console.error('🔥 네트워크 오류:', e);
    }
  }

  setTimeout(syncAll, 2000);
})();