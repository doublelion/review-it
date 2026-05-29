const crypto = require('crypto'); // 💡 입장권(HMAC) 생성을 위해 암호화 모듈을 추가합니다.

const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    const { code, state } = req.query;
    const mall_id = state;

    if (!code || !mall_id) {
      console.error('콜백 파라미터 누락:', req.query);
      return res.status(400).send('인증 코드 또는 쇼핑몰 ID(state)가 누락되었습니다.');
    }

    // 1. 카페24에 Access Token 발급 요청
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
      console.error('토큰 발급 에러:', tokenData);
      return res.status(400).send('카페24 토큰 발급에 실패했습니다.');
    }

    // =================================================================
    // 2. DB에 토큰 및 상점 상태(active) 저장
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
      console.error('Supabase 저장 에러:', dbError);
      return res.status(500).send('DB에 토큰 정보를 저장하는 중 에러가 발생했습니다.');
    }

    console.log(`[설치 대성공] ${mall_id} 토큰 DB 저장 완료`);

    // =================================================================
    // 💡 [수정] 스크립트 자동 주입 (전체 상점 조회 후 일괄 적용)
    // =================================================================
    try {
      // 1. 해당 상점의 모든 쇼핑몰 목록을 조회
      const shopListRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/shops`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Cafe24-Api-Version': '2024-06-25'
        }
      });

      const shopListData = await shopListRes.json();
      const shopIds = shopListData.shops.map(s => s.shop_no);

      const scriptUrls = [
        'https://review-it-tau.vercel.app/review-it.js',
        'https://review-it-tau.vercel.app/review-widget.js'
      ];

      // 2. 존재하는 모든 쇼핑몰(shop_no)에 대해 스크립트 등록
      for (const shop_no of shopIds) {
        for (const src of scriptUrls) {
          await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/scripts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Cafe24-Api-Version': '2024-06-25'
            },
            body: JSON.stringify({
              shop_no: shop_no, // 조회된 실제 shop_no 사용
              request: {
                src: src,
                display_location: 'ALL',
                skin_no: 1 // 대부분 1번 스킨을 사용함
              }
            })
          });
        }
      }
      console.log(`[스크립트 주입 완료] 적용된 상점 번호: ${shopIds.join(', ')}`);
    } catch (scriptErr) {
      console.error('🔥 스크립트 자동 주입 중 에러:', scriptErr);
    }

    // =================================================================
    // 💡 [핵심 수정] admin.html이 요구하는 보안 입장권(auth_sig)을 생성합니다.
    // =================================================================
    const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');

    // 입장권을 주소에 포함하여 관리자 페이지로 안전하게 이동시킵니다.
    return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);

  } catch (error) {
    console.error('🔥 콜백 처리 중 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};