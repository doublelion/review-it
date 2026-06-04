/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.6
 * @Update: 독립 도메인 대응 강화, 작성자 몰아이디 매핑, 제목 본문 혼입 방지 정교화
 */
(function (window) {
  const getDynamicConfig = () => {
    // 💡 [핵심 해결] CAFE24API 전역 객체에서 MALL_ID를 최우선으로 추출합니다.
    let cafe24MallId = null;

    if (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) {
      cafe24MallId = window.CAFE24API.MALL_ID;
    } else if (typeof window.SHOP_ID !== 'undefined' && window.SHOP_ID) {
      cafe24MallId = window.SHOP_ID;
    } else if (typeof EC_SHOP_ID !== 'undefined' && EC_SHOP_ID) {
      cafe24MallId = EC_SHOP_ID;
    }

    // 전역 변수가 모두 없을 경우를 대비한 최후의 호스트네임 파싱 백업 로직
    let host = window.location.hostname;
    let fallbackMallId = host.split('.').filter(part => !['www', 'm', 'cafe24', 'com', 'co', 'kr'].includes(part))[0];

    const finalMallId = cafe24MallId || fallbackMallId || 'default_mall';

    console.log("▶ [REVIEW-IT] 현재 완벽히 인식된 Mall ID:", finalMallId); // 디버깅용

    // 위젯용과 수집기용 리턴값이 살짝 다르므로, 적용하시는 스크립트에 맞춰 아래 return 블록을 유지해 주세요.

    /* --- [수집기 (Collector) 적용 시 return 문] --- */
    return {
      sbUrl: 'https://ozxnynnntkjjjhyszbms.supabase.co/rest/v1',
      sbKey: 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt',
      mallId: finalMallId,
      targetBoardNo: '4',
      defaultImg: 'https://review-it-tau.vercel.app/assets/rit_noimg.jpg'
    };
  };

  const CONFIG = getDynamicConfig();

  async function sync() {
    const lastSync = localStorage.getItem('rit_last_sync');
    const now = new Date().getTime();
    const COOLDOWN_MS = 1000 * 60 * 60; // 1시간 쿨타임

    if (lastSync && (now - parseInt(lastSync) < COOLDOWN_MS)) {
      console.log(`⏳ [REVIEW-IT] 동기화 쿨타임 대기 중입니다.`);
      return;
    }

    const items = document.querySelectorAll(`
      .xans-board-listpackage .xans-record-, 
      .xans-product-review .xans-record-,
      tr[id^="record"], 
      .boardList tr, 
      .border-b.group,
      li.review_list_item
    `);
    const payload = [];

    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"], a[href*="no="]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 💡 [요청 반영] 작성자명을 화면의 실명/쇼핑몰명 대신 현재 인식된 '몰 아이디(Mall ID)'로 변경
      let cleanWriter = CONFIG.mallId || "customer";

      // 썸네일 및 별점 추출
      // ====== [기존 썸네일 추출 코드 (이 부분을 찾아서 지우세요)] ======
      // let thumbEl = el.querySelector('img[src*="/product/"], img[src*="/board/"]');
      // let thumbUrl = thumbEl ? thumbEl.getAttribute('src') : CONFIG.defaultImg;

      // ====== [최종 고도화: 전역 및 모듈형 상품 정보 완벽 대응형 썸네일 로직] ======
      let thumbUrl = CONFIG.defaultImg; // 기본값: 최후의 보루

      // 1순위: 소비자가 직접 올린 실제 후기 이미지 (보통 /board/ 경로를 탐)
      let reviewImg = el.querySelector('img[src*="/board/"]:not([src*="icon"])');

      // 2순위: 현재 행(el) 내부에 존재하는 상품 이미지 영역 매칭
      let productImg = el.querySelector('.typeProduct img, td.thumb img, .product-img img, img[src*="/product/"]:not([src*="icon"])');

      // 3순위 (💡 초강력 전역 백업): 행 내부에는 없지만, 보내주신 코드처럼 페이지 상/하단에 상품 정보 박스가 떠 있는 경우
      if (!reviewImg && !productImg) {
        productImg = document.querySelector('.typeProduct img, .xans-board-product img, .xans-board-product-4 img');
      }

      // 우선순위에 따라 이미지 주소 확정
      if (reviewImg && reviewImg.getAttribute('src')) {
        thumbUrl = reviewImg.getAttribute('src');
      } else if (productImg && productImg.getAttribute('src')) {
        thumbUrl = productImg.getAttribute('src');
      }

      // [안전장치] 깨진 이미지 엑스박스나 카페24 기본 기본티콘, 별점 아이콘 필터링 강화
      if (thumbUrl.match(/star|icon|btn|logo|dummy|ec2-common|echosting|thumb\/75x75|rating|댓글/i)) {
        thumbUrl = CONFIG.defaultImg;
      }

      // URL 주소 절대경로 표준화 처리
      if (thumbUrl.startsWith('//')) {
        thumbUrl = 'https:' + thumbUrl;
      } else if (thumbUrl.startsWith('/')) {
        thumbUrl = window.location.origin + thumbUrl;
      }
      // =========================================================================

      let extractedStar = 5;
      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) extractedStar = parseInt(match[1], 10);
      }

      // 💡 [제목 추출 정교화] td.subject 전체 innerText 대신, 실제 제목이 적힌 링크(link)의 텍스트를 최우선으로 신뢰합니다.
      let subjectEl = el.querySelector('.subject, .title, .board_title, .td_subject');
      let targetText = link ? link.innerText : (subjectEl ? subjectEl.innerText : "");
      let cleanSubject = "포토 리뷰입니다.";

      if (targetText) {
        // 공백 압축 및 줄바꿈 차단
        let temp = targetText.split('\n')[0].replace(/^제목\s*:?\s*/i, '').trim();
        temp = temp.replace(/\s+/g, ' ').trim();

        if (temp.length > 0) {
          cleanSubject = temp;
          if (cleanSubject.length > 25) {
            cleanSubject = cleanSubject.substring(0, 25) + '...';
          }
        }
      }

      payload.push({
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter, // 몰 아이디 저장 완료
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      });
    });

    if (payload.length === 0) return;

    // 중복 제거
    const uniqueMap = new Map();
    payload.forEach(item => {
      if (!uniqueMap.has(item.article_no)) uniqueMap.set(item.article_no, item);
    });
    const limitedPayload = Array.from(uniqueMap.values()).slice(0, 20);

    if (limitedPayload.length === 0) return;

    try {
      const res = await fetch(`${CONFIG.sbUrl}/reviews?on_conflict=mall_id,article_no`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.sbKey,
          'Authorization': `Bearer ${CONFIG.sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(limitedPayload)
      });

      if (res.ok) {
        console.log(`✅ [REVIEW-IT] 동기화 완료 (${limitedPayload.length}건)`);
        localStorage.setItem('rit_last_sync', new Date().getTime().toString());
      } else {
        console.error("❌ 데이터 전송 실패:", await res.text());
      }
    } catch (e) {
      console.error(e);
    }
  }
  // ====== [기존 실행 코드 지우기] ======
  // setTimeout(sync, 2000); 


  // ====== [새로 추가할 스마트 폴링 & 범용 실행 코드] ======
  function startSmartSync() {
    let attempts = 0;
    const maxAttempts = 10; // 최대 10번 (10초) 동안 끈질기게 위젯 렌더링을 기다립니다.

    const interval = setInterval(() => {
      attempts++;

      // 💡 [핵심] 카페24 기본 구조 + 알파리뷰 등 서드파티 위젯 범용 클래스 동시 탐색
      const targetItems = document.querySelectorAll(`
        .xans-board-listpackage .xans-record-, 
        .xans-product-review .xans-record-,
        tr[id^="record"], 
        .boardList tr, 
        .border-b.group,
        li.review_list_item,
        [class*="alpha-review"], [class*="ar-item"], 
        .crema_product_reviews > li,
        [class*="vreview-"],
        .review-widget-item
      `);

      // 타겟 요소가 화면에 그려졌다면 즉시 수집(sync) 실행 후 반복 종료
      if (targetItems.length > 0) {
        clearInterval(interval);
        console.log(`▶ [REVIEW-IT] 리뷰 위젯 렌더링 감지 완료 (시도 횟수: ${attempts}회) - 수집 시작`);

        // sync 함수 내부에서 items를 다시 찾지 않도록 수정할 수도 있지만,
        // 기존 sync() 함수 로직을 그대로 재활용하기 위해 그대로 호출합니다.
        sync();
      }
      // 10초가 지나도 아무것도 뜨지 않으면 깔끔하게 포기 (불필요한 리소스 낭비 방지)
      else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.log("▶ [REVIEW-IT] 리뷰 요소를 찾지 못했습니다. (알파위젯 등 렌더링 지연 또는 리뷰 없음)");
      }
    }, 1000); // 1초마다 화면 감시
  }

  // DOM이 준비되면 스마트 탐색 시작
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSmartSync);
  } else {
    startSmartSync();
  }
  // =========================================================================
})(window);