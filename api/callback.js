const crypto = require('crypto');

// 환경변수 세팅
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 주의: 카페24 개발자센터의 '리다이렉트 URI' 설정과 정확히 100% 일치해야 합니다!
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    // 1. 권한 동의 화면을 거친 후 카페24가 넘겨주는 일회용 인증코드(code) 받기
    const { code, mall_id, state } = req.query;

    if (!code || !mall_id) {
      return res.status(400).send('인증 코드 또는 쇼핑몰 ID가 누락되었습니다.');
    }

    console.log(`[인증 성공] ${mall_id} 상점의 인증 코드(code) 획득 완료. 토큰 교환을 시작합니다.`);

    // 2. Base64 인코딩 (Client ID : Client Secret) -> 띄어쓰기 없이 콜론(:)으로 묶어야 함
    const credentials = Buffer.from(`${CAFE24_CLIENT_ID}:${CAFE24_CLIENT_SECRET}`).toString('base64');

    // 3. 카페24 서버에 Access Token 발급 요청
    const tokenUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('토큰 발급 실패:', tokenData);
      return res.status(400).send(`<h1>토큰 발급 실패</h1><p>${tokenData.error_description || '카페24 토큰 교환 중 오류가 발생했습니다.'}</p>`);
    }

    // 4. 발급받은 토큰 정보를 Supabase DB에 저장 (Upsert)
    // - access_token: API 호출 시 사용 (2시간 유효)
    // - refresh_token: access_token 만료 시 재발급용 (2주 유효)
    const { access_token, refresh_token, expires_at, refresh_token_expires_at } = tokenData;

    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/active_malls`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        mall_id: mall_id,
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expires_at,
        refresh_expires_at: refresh_token_expires_at,
        updated_at: new Date().toISOString(),
        status: 'active'
      })
    });

    if (!dbResponse.ok) {
      console.error('Supabase 토큰 저장 실패:', await dbResponse.text());
      return res.status(500).send('DB에 토큰을 저장하는 데 실패했습니다.');
    }

    console.log(`[설치 완료] ${mall_id} 상점의 토큰이 성공적으로 저장되었습니다.`);

    // 5. 완벽하게 설치가 끝났으므로, 축하 문구와 함께 대시보드(admin.html)로 이동시킵니다.
    // 보안을 위해 authSignature를 생성해서 넘깁니다.
    const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');

    // 리다이렉트 (설치 완료!)
    return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);

  } catch (error) {
    console.error('콜백 처리 중 서버 내부 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};