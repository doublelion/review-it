/**
 * @Project: Review-It Universal Collector Engine
 * @Version: v1.0.8
 * @Update: 
 *  1. [핵심] 쇼퍼블 버튼 연동을 위한 product_no 추출 및 전송 로직 유지
 *  2. [버그 픽스] 백그라운드 이미지 파싱 시 document -> doc 오참조 버그 해결
 *  3. [데이터 동기화] DB 컬럼 추가에 따른 product_name, product_image 스크래핑 및 페이로드 추가
 */

(function (window) {
  // 🧹 맥 에디터 쓰레기 태그 및 CSS 정제 함수
  const cleanEditorText = (text) => {
    if (!text) return "";
    return text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/p\.p1\s*\{[^}]*\}/gi, '')
      .replace(/span\.s1\s*\{[^}]*\}/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getDynamicConfig = () => {
    let cafe24MallId = null;

    if (typeof window.CAFE24API !== 'undefined' && window.CAFE24API.MALL_ID) {
      cafe24MallId = window.CAFE24API.MALL_ID;
    } else if (typeof window.SHOP_ID !== 'undefined' && window.SHOP_ID) {
      cafe24MallId = window.SHOP_ID;
    } else if (typeof EC_SHOP_ID !== 'undefined' && EC_SHOP_ID) {
      cafe24MallId = EC_SHOP_ID;
    }

    let host = window.location.hostname;
    let fallbackMallId = host.split('.').filter(part => !['www', 'm', 'cafe24', 'com', 'co', 'kr'].includes(part))[0];

    const finalMallId = cafe24MallId || fallbackMallId || 'default_mall';

    console.log("▶ [REVIEW-IT Collector] 현재 완벽히 인식된 Mall ID:", finalMallId);

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
      console.log(`⏳ [REVIEW-IT Collector] 동기화 쿨타임 대기 중입니다.`);
      return;
    }

    const payload = [];
    let items;

    try {
      const boardUrl = `/board/product/list.html?board_no=${CONFIG.targetBoardNo}`;
      const response = await fetch(boardUrl);
      const htmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      items = doc.querySelectorAll(`
          .xans-board-listpackage .xans-record-, 
          .xans-product-review .xans-record-,
          tr[id^="record"], 
          .boardList tr, 
          .border-b.group,
          li.review_list_item
      `);

      console.log(`✅ [REVIEW-IT Collector] 백그라운드 게시판 로드 성공! (${items.length}개 요소 발견)`);
    } catch (error) {
      console.error("❌ [REVIEW-IT Collector] 백그라운드 게시판 로드 실패:", error);
      return;
    }

    items.forEach(el => {
      const link = el.querySelector('a[href*="article_no="], a[href*="/article/"], a[href*="no="]');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleNoMatch = href.match(/article_no=(\d+)/) || href.match(/\/(\d+)\/?$/) || href.match(/\/(\d+)\/($|\?)/);
      const articleNo = articleNoMatch ? articleNoMatch[1] : null;
      if (!articleNo) return;

      // 💡 1. 상품 번호(product_no) 추출
      let extractedProductNo = null;
      const productLink = el.querySelector('a[href*="product_no="]');
      if (productLink) {
        const pMatch = productLink.getAttribute('href').match(/product_no=(\d+)/);
        if (pMatch) extractedProductNo = pMatch[1];
      }

      // 💡 2. 새로 추가된 상품명(product_name) 추출 로직
      let extractedProductName = null;
      const pNameEl = el.querySelector('.product-name, .prd-name, .typeProduct a, td.thumb + td a, .product_name, .name a');
      if (pNameEl) {
        extractedProductName = pNameEl.innerText.replace(/\n/g, '').trim();
      }

      let authorNameEl = el.querySelector('.writer, .name, td.name, span.name, td:nth-child(3)');
      let cleanWriter = "고객";
      if (authorNameEl) {
        let clone = authorNameEl.cloneNode(true);
        let hidden = clone.querySelector('.displaynone');
        if (hidden) hidden.remove();

        let tempName = clone.innerText.replace(/\(ip:.*\)/gi, '').trim();
        if (tempName) cleanWriter = tempName;
      }

      let thumbUrl = CONFIG.defaultImg;
      let reviewImg = el.querySelector('img[src*="/board/"]:not([src*="icon"])');
      let productImg = el.querySelector('.typeProduct img, td.thumb img, .product-img img, img[src*="/product/"]:not([src*="icon"])');

      if (!reviewImg && !productImg) {
        productImg = doc.querySelector('.typeProduct img, .xans-board-product img, .xans-board-product-4 img');
      }

      // 💡 3. 새로 추가된 상품 이미지(product_image) 전용 추출 로직
      let extractedProductImg = null;
      if (productImg && productImg.getAttribute('src')) {
        let src = productImg.getAttribute('src');
        if (!src.match(/star|icon|btn|logo|dummy|ec2-common|echosting/i)) {
          extractedProductImg = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? window.location.origin + src : src);
        }
      }

      if (reviewImg && reviewImg.getAttribute('src')) {
        thumbUrl = reviewImg.getAttribute('src');
      } else if (productImg && productImg.getAttribute('src')) {
        thumbUrl = productImg.getAttribute('src');
      }

      if (thumbUrl.match(/star|icon|btn|logo|dummy|ec2-common|echosting|thumb\/75x75|rating|댓글/i)) {
        thumbUrl = CONFIG.defaultImg;
      }

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

      // 💡 페이로드(전송 데이터) 구성
      const reviewData = {
        mall_id: CONFIG.mallId,
        article_no: String(articleNo),
        board_no: CONFIG.targetBoardNo,
        subject: cleanSubject,
        content: "본문을 불러오는 중입니다...",
        writer: cleanWriter,
        stars: extractedStar,
        image_urls: thumbUrl ? [thumbUrl] : [],
        is_visible: true
      };

      // 💡 새롭게 추출한 데이터들을 Supabase 컬럼에 맞게 추가
      if (extractedProductNo) reviewData.product_no = extractedProductNo;
      if (extractedProductName) reviewData.product_name = extractedProductName;
      if (extractedProductImg) reviewData.product_image = extractedProductImg;

      payload.push(reviewData);
    });

    if (payload.length === 0) return;

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
        console.log(`✅ [REVIEW-IT Collector] 동기화 완료 (${limitedPayload.length}건) - 상품명/이미지 포함`);
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