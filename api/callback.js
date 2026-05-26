// api/callback.js
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    // Vercel은 req.query를 통해 파라미터를 자동 해석합니다. (url.parse 불필요)
    const { code, mall_id } = req.query;

    if (!code || !mall_id) {
      console.error('콜백 파라미터 누락:', req.query);
      return res.status(400).send('인증 코드 또는 쇼핑몰 ID가 누락되었습니다.');
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

    // ==========================================
    // 💡 중요: 발급받은 tokenData(access_token 등)를 
    // Supabase DB에 저장하는 로직이 여기에 들어가야 합니다!
    // ==========================================
    console.log('토큰 발급 성공:', mall_id);

    // 2. 모든 처리 완료 후 관리자 페이지로 이동
    return res.redirect(`/admin.html?mall_id=${mall_id}`);

  } catch (error) {
    console.error('콜백 처리 중 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};