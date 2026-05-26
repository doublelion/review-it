const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    // 💡 api/auth.js에서 보낸 state 값을 mall_id로 꺼내 씁니다.
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
    // 💡 [수정됨] 날짜 계산 오류 해결! 
    // 카페24가 주는 텍스트 날짜(예: "2026-05-26T17:33:00.000")를 그대로 DB에 넣습니다.
    // =================================================================
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = tokenData.expires_at; 
    const refreshExpiresAt = tokenData.refresh_token_expires_at;

    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/active_malls`, {
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

    // 3. 모든 처리 완료 후 관리자 페이지로 이동
    return res.redirect(`/admin.html?mall_id=${mall_id}`);

  } catch (error) {
    // 🔥 만약 또 500 에러가 난다면, Vercel 로그에 이 부분이 어떻게 찍히는지 꼭 확인해 주세요!
    console.error('🔥 콜백 처리 중 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};