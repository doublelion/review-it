const crypto = require('crypto');

const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

// 💡 카페24 API 버전을 상수로 관리하여 유지보수를 쉽게 합니다.
const CAFE24_API_VERSION = '2025-12-01';

module.exports = async (req, res) => {
  try {
    const { code, state } = req.query;
    const mall_id = state;

    if (!code || !mall_id) {
      console.error('❌ 콜백 파라미터 누락:', req.query);
      return res.status(400).send('인증 코드 또는 쇼핑몰 ID(state)가 누락되었습니다.');
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
    // 3. 스크립트 자동 주입 (API 버전 2025-12-01 반영)
    // =================================================================
    try {
      let shopIds = [1]; // 멀티쇼핑몰 권한 오류 대비 기본값 세팅

      try {
        // 해당 상점의 모든 멀티쇼핑몰 목록 조회 시도
        const shopListRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/shops`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Cafe24-Api-Version': CAFE24_API_VERSION // 💡 최신 버전 반영
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
        console.error('⚠️ [상점 조회 중 예외 발생] 기본값(1번 몰)으로 안전하게 진행합니다:', shopErr.message);
      }

      // 주입할 스크립트 파일 목록
      const scriptUrls = [
        'https://review-it-tau.vercel.app/review-it.js',
        'https://review-it-tau.vercel.app/review-widget.js'
      ];

      // 결정된 shopIds로 스크립트 주입 시작
      for (const shop_no of shopIds) {
        for (const src of scriptUrls) {
          console.log(`▶️ [스크립트 주입 시도] 상점 번호: ${shop_no}, 파일: ${src}`);

          const scriptRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/scripttags`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Cafe24-Api-Version': CAFE24_API_VERSION // 💡 최신 버전 반영
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
    // 4. 보안 입장권 생성 및 관리자 페이지 리다이렉트
    // =================================================================
    const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');

    return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);

  } catch (error) {
    console.error('🔥 콜백 처리 중 서버 에러 발생:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
};