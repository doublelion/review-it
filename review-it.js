/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.6 (Option A - Background Fetch Applied)
 * @Update: 독립 도메인 대응 강화, 작성자 몰아이디 매핑, 제목 본문 혼입 방지 정교화, 백그라운드 게시판 스크래핑 추가
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

    const payload = [];
    let items; // forEach에서 사용할 수 있도록 외부에서 변수 선언

    // [추가된 로직] 백그라운드에서 게시판 HTML을 강제로 가져옵니다.
    try {
      // targetBoardNo를 이용해 리뷰 게시판 1페이지 URL 생성
      const boardUrl = `/board/product/list.html?board_no=${CONFIG.targetBoardNo}`;
      const response = await fetch(boardUrl);
      const htmlText = await response.text();

      // 가져온 HTML을 임시 DOM으로 파싱
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // 현재 페이지(document)가 아닌, 백그라운드로 가져온 게시판 페이지(doc)에서 리뷰 요소 찾기
      items = doc.querySelectorAll(`
          .xans-board-listpackage .xans-record-, 
          .xans-product-review .xans-record-,
          tr[id^="record"], 
          .boardList tr, 
          .border-b.group,
          li.review_list_item
      `);

      console.log(`✅ [REVIEW-IT] 백그라운드 게시판 로드 성공! (${items.length}개 요소 발견)`);
    } catch (error) {
      console.error("❌ [REVIEW-IT] 백그라운드 게시판 로드 실패:", error);
      return; // 실패하면 여기서 스크립트 중단
    }

    // HTML을 성공적으로 가져왔을 때만 아래 forEach 실행
    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"], a[href*="no="]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // ❌ 기존 코드: 작성자를 파싱하지 않고 mallId로 덮어씌움
      // let cleanWriter = CONFIG.mallId || "customer";

      // ✅ 수정된 코드: 카페24 스킨 DOM에서 실제 작성자 이름을 스크래핑
      let authorNameEl = el.querySelector('.writer, .name, td.name, span.name, td:nth-child(3)');
      let cleanWriter = "고객";
      if (authorNameEl) {
        // 복제본을 만들어 displaynone 클래스(ip 정보 등)를 제거 후 텍스트 추출
        let clone = authorNameEl.cloneNode(true);
        let hidden = clone.querySelector('.displaynone');
        if (hidden) hidden.remove();

        let tempName = clone.innerText.replace(/\(ip:.*\)/gi, '').trim();
        if (tempName) cleanWriter = tempName;
      }

      // 썸네일 및 별점 추출
      let thumbUrl = CONFIG.defaultImg;

      // 1순위: 소비자가 직접 올린 실제 후기 이미지
      let reviewImg = el.querySelector('img[src*="/board/"]:not([src*="icon"])');

      // 2순위: 현재 행(el) 내부에 존재하는 상품 이미지 영역 매칭
      let productImg = el.querySelector('.typeProduct img, td.thumb img, .product-img img, img[src*="/product/"]:not([src*="icon"])');

      // 3순위: 행 내부에는 없지만 상/하단 상품 정보 박스가 떠 있는 경우 
      // (주의: 백그라운드 로드시에는 document가 아닌 doc에서 찾아야 함)
      if (!reviewImg && !productImg) {
        productImg = document.querySelector('.typeProduct img, .xans-board-product img, .xans-board-product-4 img');
      }

      // 우선순위에 따라 이미지 주소 확정
      if (reviewImg && reviewImg.getAttribute('src')) {
        // 1순위: 소비자가 직접 올린 실제 후기 이미지
        thumbUrl = reviewImg.getAttribute('src');
      } else if (productImg && productImg.getAttribute('src')) {
        // 2순위: 상품 썸네일을 가져왔을 경우 (강제 치환 로직 제거, 원본 그대로 수집)
        thumbUrl = productImg.getAttribute('src');
      }

      // 깨진 이미지 및 기본 아이콘 필터링
      if (thumbUrl.match(/star|icon|btn|logo|dummy|ec2-common|echosting|thumb\/75x75|rating|댓글/i)) {
        thumbUrl = CONFIG.defaultImg;
      }

      // URL 주소 절대경로 표준화 처리
      if (thumbUrl.startsWith('//')) {
        thumbUrl = 'https:' + thumbUrl;
      } else if (thumbUrl.startsWith('/')) {
        thumbUrl = window.location.origin + thumbUrl;
      }

      let extractedStar = 5;
      const starImg = el.querySelector('img[src*="icon-star-rating"]');
      if (starImg) {
        const match = starImg.getAttribute('src').match(/icon-star-rating(\d+)/);
        if (match && match[1]) extractedStar = parseInt(match[1], 10);
      }

      let subjectEl = el.querySelector('.subject, .title, .board_title, .td_subject');
      let targetText = link ? link.innerText : (subjectEl ? subjectEl.innerText : "");
      let cleanSubject = "포토 리뷰입니다.";

      if (targetText) {
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
        writer: cleanWriter,
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

    // Supabase 전송
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

  setTimeout(sync, 2000);
})(window);