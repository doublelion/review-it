/**
 * @Project: Review-It Universal Collector & Engine
 * @Version: v1.2.0 (Success Edition)
 */
(function (window) {
  const getDynamicConfig = () => {
    // [보정] mall_id 추출 시 카페24 도메인 찌꺼기 제거
    let mallId = window.location.hostname.split('.')[0];

    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      mallId: mallId,
      defaultImg: 'https://review-it-tau.vercel.app/assets/no-img.png',
      targetBoardNo: '4', // ykinas 상점의 포토리뷰 게시판 번호
      // 필터링할 이미지 키워드
      spamKeywords: /star|icon|btn|logo|dummy|ec2-common|rating/i
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    console.log(`🚀 [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 동기화 시작...`);

    // 카페24 스킨별 게시판 레코드 선택자 강화
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group, .notice_view');
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="board_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');

      // 1. 게시판 번호 추출 로직 정교화
      const boardNoMatch = href.match(/board_no=(\d+)/) || href.match(/\/article\/[^/]+\/(\d+)\//);
      const currentBoardNo = boardNoMatch ? boardNoMatch[1] : null;

      if (currentBoardNo !== CONFIG.targetBoardNo) return;

      // 2. 게시글 번호 추출
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 3. 작성자 정제
      let writerEl = el.querySelector('.writer, .name, .displaynone + span, td:nth-child(3)');
      let cleanWriter = writerEl ? writerEl.innerText.trim().split('[')[0].replace(/[*]/g, '') : "고객";

      // 4. [핵심] 이미지 추출 및 별점 아이콘 필터링
      let allImgs = Array.from(el.querySelectorAll('img')).map(img => img.getAttribute('src'));
      let validImg = allImgs.find(src =>
        src &&
        !CONFIG.spamKeywords.test(src) &&
        !src.includes('.svg') &&
        (src.includes('/product/') || src.includes('/board/') || src.includes('/file_data/'))
      );

      let thumbUrl = validImg || CONFIG.defaultImg;
      if (thumbUrl.startsWith('//')) { thumbUrl = 'https:' + thumbUrl; }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: link.innerText.trim() || "포토 리뷰입니다.",
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter || "고객",
        stars: 5,
        image_urls: [thumbUrl],
        is_visible: true,
        is_best: false
      });
    });

    console.log(`📊 [REVIEW-IT] 식별된 Mall ID: ${CONFIG.mallId}`);
    console.log(`📊 [REVIEW-IT] 수집된 리뷰 개수: ${payload.length}개`);

    if (payload.length === 0) {
      console.warn("⚠️ [REVIEW-IT] 데이터가 0개입니다. Selector 또는 게시판 번호(4번)를 확인하세요.");
      return;
    }

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트(Upsert)
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log(`✅ [REVIEW-IT] ${CONFIG.mallId} 상점 데이터 전송 성공!`);
      } else {
        const err = await res.json();
        console.error("❌ [REVIEW-IT] 전송 실패:", err.message);
      }
    } catch (e) {
      console.error("❌ [REVIEW-IT] 네트워크 오류:", e);
    }
  }

  // 카페24 게시판은 데이터 로딩 속도가 느릴 수 있으므로 1초 지연 실행 (안정성 확보)
  setTimeout(() => {
    if (document.readyState === 'complete') { sync(); }
    else { window.addEventListener('load', sync); }
  }, 1000);

})(window);