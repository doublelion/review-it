const crypto = require('crypto');

const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

const CAFE24_API_VERSION = '2026-03-01';

module.exports = async (req, res) => {
  try {
    const code = req.query.code;
    // state가 없으면 카페24가 기본으로 던져주는 mall_id를 낚아챕니다.
    const mall_id = req.query.mall_id || req.query.state;

    if (!code || !mall_id) {
      console.error('❌ 콜백 파라미터 누락:', req.query);
      return res.status(400).send('인증 코드 또는 쇼핑몰 ID가 누락되었습니다.');
    }

    // =================================================================
    // 1. 카페24에 Access Token 발급 요청
    // =================================================================
    const credentials = Buffer.from(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch(`https://${mall_id}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('❌ 토큰 발급 에러:', tokenData);
      return res.status(400).send('카페24 토큰 발급에 실패했습니다.');
    }

    // =================================================================
    // 2. DB (Supabase)에 토큰 및 상점 상태(active) 저장
    // =================================================================
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = tokenData.expires_at;
    const refreshExpiresAt = tokenData.refresh_token_expires_at;

    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/active_malls?on_conflict=mall_id`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        mall_id: mall_id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        status: 'active',
        updated_at: new Date().toISOString()
      })
    });

    if (!supabaseResponse.ok) {
      const dbError = await supabaseResponse.text();
      console.error('❌ Supabase 저장 에러:', dbError);
      return res.status(500).send('DB에 토큰 정보를 저장하는 중 에러가 발생했습니다.');
    }

    console.log(`🎉 [설치 대성공] ${mall_id} 토큰 DB 저장 완료`);

    // =================================================================
    // 3. 스크립트 자동 주입
    // =================================================================
    try {
      let shopIds = [1];

      try {
        const shopListRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/shops`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Cafe24-Api-Version': CAFE24_API_VERSION
          }
        });

        if (shopListRes.ok) {
          const shopListData = await shopListRes.json();
          const fetchedShops = shopListData?.shops || [];
          if (fetchedShops.length > 0) {
            shopIds = fetchedShops.map(s => s.shop_no);
            console.log(`🔍 [상점 조회 성공] 검색된 멀티쇼핑몰 목록: ${shopIds}`);
          }
        } else {
          const shopErrorDetail = await shopListRes.text();
          console.warn(`⚠️ [상점 조회 실패] 상태 코드: ${shopListRes.status}, 사유: ${shopErrorDetail}. 기본값(1번 몰)으로 진행합니다.`);
        }
      } catch (shopErr) {
        console.error('⚠️ [상점 조회 중 예외 발생] 기본값(1번 몰)으로 진행:', shopErr.message);
      }

      const scriptUrls = [
        'https://review-it-tau.vercel.app/review-it.js',
        'https://review-it-tau.vercel.app/review-widget.js'
      ];

      for (const shop_no of shopIds) {
        for (const src of scriptUrls) {
          const scriptRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/scripttags`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Cafe24-Api-Version': CAFE24_API_VERSION
            },
            body: JSON.stringify({
              shop_no: shop_no,
              request: {
                client_id: CAFE24_CLIENT_ID,
                src: src,
                display_location: ["ALL"]
              }
            })
          });

          if (!scriptRes.ok) {
            const errorDetail = await scriptRes.text();
            console.error(`❌ [스크립트 주입 실패 - 상점 ${shop_no}] 상세 사유:`, errorDetail);
          } else {
            console.log(`✅ [스크립트 주입 성공 - 상점 ${shop_no}] ${src} 등록 완료!`);
          }
        }
      }

    } catch (scriptErr) {
      console.error('🔥 스크립트 자동 주입 프로세스 치명적 에러:', scriptErr);
    }

    // =================================================================
    // 4. 초기 리뷰 데이터 동기화 (상품 구매후기 게시판: 기본 board_no = 4)
    // =================================================================
    try {
      console.log(`🔄 [리뷰 동기화 시작] ${mall_id}의 초기 리뷰 데이터를 가져옵니다.`);
      const boardNo = 4; // 상품 구매후기 게시판 번호 (몰마다 다를 수 있으나 4번이 표준)

      const articlesRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/${boardNo}/articles?limit=15`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Cafe24-Api-Version': CAFE24_API_VERSION
        }
      });

      if (articlesRes.ok) {
        const articlesData = await articlesRes.json();
        const articles = articlesData.articles || [];

        if (articles.length > 0) {
          // Supabase 'reviews' 테이블에 데이터 매핑 및 저장
          const reviewsToInsert = articles.map(article => ({
            mall_id: mall_id,
            article_id: String(article.article_no),
            product_no: article.product_no || null,
            member_id: article.member_id || 'guest',

            // 💡 DB의 Not-Null 제약조건을 통과하기 위해 명시적으로 추가
            writer: article.writer || '고객',
            author_name: article.writer || '고객',

            subject: article.subject || '포토 리뷰입니다.',
            content: article.content || '본문을 불러오는 중입니다...',
            created_at: article.created_date
          }));

          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(reviewsToInsert)
          });

          if (!insertRes.ok) {
            const insertError = await insertRes.text();
            console.error('❌ 리뷰 Supabase 저장 에러:', insertError);
          } else {
            console.log(`✅ [리뷰 동기화 성공] ${reviewsToInsert.length}개의 리뷰 저장 완료!`);
          }
        } else {
          console.log(`ℹ️ [리뷰 동기화] 가져올 기존 리뷰가 없습니다.`);
        }
      } else {
        const articleErrorDetail = await articlesRes.text();
        console.warn(`⚠️ [리뷰 동기화 실패] 상태 코드: ${articlesRes.status}, 사유: ${articleErrorDetail}`);
      }
    } catch (syncErr) {
      console.error('🔥 초기 리뷰 동기화 프로세스 에러:', syncErr);
    }

    // =================================================================
    // 5. 보안 입장권 생성 및 관리자 페이지 리다이렉트
    // =================================================================
    const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');

    return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);

  } catch (error) {
    console.error('🔥 콜백 처리 중 서버 에러 발생:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
};