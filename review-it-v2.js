/**
 * @Project: Review-It Collector v7.4
 * @Feature: 최신 div 기반 스킨 대응 + 클래스명 기반 정밀 추출 + 동적 게시판 번호 대응
 */
(function () {
  const CONFIG = {
    sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
    sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
    mallId: 'ecudemo389879',
    boardNo: '4' // 실제 수집 대상 리뷰 게시판 번호
  };

  async function sync() {
    console.log('🚀 [REVIEW-IT] 범용 스킨 데이터 수집 시작...');

    // 1. 레코드 선택자 확장 (기존 tr + 새롭게 발견된 div.xans-record- 대응)
    const items = document.querySelectorAll('.xans-record-, tr[id^="record"], .boardList tr, .border-b.group');
    const payload = [];

    items.forEach(el => {
      // [A] 게시글 링크 및 번호 추출
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // [B] 작성자(아이디) 추출 - 순서가 아닌 클래스 및 구조 기반으로 변경
      // 6번 게시판 예시의 <span>와****</span> 구조 대응
      let writerEl = el.querySelector('.writer, .name, .displaynone + span, div.mt-3 > span:first-child');
      
      // 만약 위에서 못찾았다면, 텍스트 패턴으로 찾기 (마스킹된 아이디 특성 활용)
      if (!writerEl) {
        const spans = el.querySelectorAll('span');
        for (let s of spans) {
          if (s.innerText.includes('**')) { // 마스킹 흔적 찾기
            writerEl = s;
            break;
          }
        }
      }

      let rawWriter = writerEl ? writerEl.innerText.trim() : "고객";
      let cleanWriter = rawWriter.split('[')[0].split('(')[0].replace(/[*]/g, '').trim();

      // [C] 제목 추출 (Q. 등을 제외한 순수 텍스트)
      let subjectText = link.innerText.replace(/^Q\./, '').replace(/^질문/, '').trim() || "포토 리뷰입니다.";

      // [D] 별점 추출 (Q&A 게시판은 별점이 없을 수 있으므로 기본값 5점)
      let extractedStars = 5;
      const starImg = el.querySelector('img[src*="star"], img[src*="rating"]');
      if (starImg) {
        const match = starImg.src.match(/star(\d)/) || starImg.src.match(/rating(\d)/);
        if (match) extractedStars = parseInt(match[1]);
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.boardNo, // 수집 시점의 게시판 번호
        subject: subjectText,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter || "고객",
        stars: extractedStars,
        image_urls: [],
        is_visible: true
      });
    });

    if (payload.length === 0) {
      console.warn("⚠️ 수집할 리뷰를 찾지 못했습니다.");
      return;
    }

    // [E] 중복 제거 및 전송
    const uniquePayload = Array.from(new Map(payload.map(item => [item.article_no, item])).values());

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.KEY || CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(uniquePayload)
      });

      if (res.ok) {
        console.log(`✅ [${CONFIG.mallId}] ${uniquePayload.length}개 동기화 완료`);
      }
    } catch (e) { console.error("❌ 오류:", e); }
  }

  sync();
})();