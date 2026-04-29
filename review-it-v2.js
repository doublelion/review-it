(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879'
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 데이터 수집 시작...');
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"]');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) return;

      const articleNo = link.href.match(/article_no=(\d+)/)?.[1] || link.href.match(/\/(\d+)\/?$/)?.[1];
      if (!articleNo) return;

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        subject: link.innerText.trim(),
        content: "구매해 주셔서 감사합니다!",
        writer: "고객",
        stars: 5,
        image_urls: ["https://ecudemo389879.cafe24.com/web/upload/no-img.png"], // 테스트용 기본이미지
        is_visible: true
      });
    });

    if (payload.length === 0) return console.error("❌ 수집할 리뷰를 찾지 못했습니다. 게시판 페이지가 맞나요?");

    const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.sbKey,
        'Authorization': `Bearer ${CONFIG.sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) console.log(`✅ 성공: ${payload.length}개 데이터가 Supabase에 저장되었습니다!`);
    else console.error("❌ 저장 실패:", await res.json());
  }

  sync();
})();