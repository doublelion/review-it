const crypto = require('crypto');

// 환경변수
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID; // 💡 필수 추가: 앱 생성 시 받은 Client ID
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 💡 필수 추가: 우리 앱의 권한 스코프 (카페24 앱 설정에 등록한 것과 동일해야 함)
// 예시: 상품 읽기, 리뷰 읽기/쓰기 권한 등
const CAFE24_SCOPE = 'mall.read_product,mall.read_community,mall.write_community';

// 💡 필수 추가: 카페24에서 권한 승인 후 코드를 보내줄 리다이렉트 주소
// 대표님이 설정하신 Callback 주소를 사용해야 합니다. 
// (Supabase Callback이 OAuth 코드를 처리할 수 있도록 설정되어 있어야 합니다.)
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback'; // 주의: 아래 설명을 꼭 읽어주세요!

module.exports = async (req, res) => {
  try {
    const { mall_id, timestamp, hmac, user_id, user_type, code } = req.query;

    if (!mall_id) {
      return res.status(400).send('mall_id가 누락되었습니다.');
    }

    // =====================================================================
    // STEP 1: 최초 앱 설치 진입 시 -> 카페24 권한 동의 화면으로 보내기
    // 카페24 앱스토어에서 '설치'를 누르면 최초에 HMAC 없이 접근할 수 있습니다.
    // 이때는 바로 로그인 페이지로 보내는 것이 아니라, "권한 동의 화면"으로 리다이렉트 해야 합니다.
    // =====================================================================
    if (!hmac && !code) {
      console.log(`[앱 설치 시작] ${mall_id} 상점을 권한 요청 화면으로 이동시킵니다.`);

      const state = crypto.randomBytes(16).toString('hex'); // CSRF 방지용 임의의 문자열

      // 권한 요청 URL 생성
      const authUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${CAFE24_CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(CAFE24_SCOPE)}`;

      // 🚨 이곳이 바로 대표님이 찾으시던 "권한 동의 화면"을 띄우는 핵심 로직입니다!
      return res.redirect(authUrl);
    }

    // =====================================================================
    // STEP 2: [보류] 권한 동의 후 토큰 발급 로직 (callback에서 처리해야 함)
    // =====================================================================
    // (주의) 카페24가 인증 코드(code)를 대표님이 설정한 리다이렉트 주소로 보내줍니다.
    // 현재 대표님의 설정: https://ozxnynnntkjjjhyszbms.supabase.co/auth/v1/callback
    // 이 주소가 1분짜리 `code`를 받아서 `Access Token`으로 교환할 수 있는 로직이 마련되어 있나요?
    // 그렇지 않다면, 우리의 Vercel 서버로 리다이렉트 받아서 직접 토큰을 교환해야 합니다.


    // =====================================================================
    // STEP 3: 카페24에서 이미 설치된 앱을 실행할 때 (HMAC 검증)
    // =====================================================================
    if (hmac) {
      const params = { mall_id, timestamp };
      if (user_id) params.user_id = user_id;
      if (user_type) params.user_type = user_type;

      const sortedQueryString = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
      const calculatedHmac = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(sortedQueryString).digest('base64');

      if (hmac !== calculatedHmac) {
        return res.status(401).send('보안 검증(HMAC)에 실패했습니다.');
      }

      // 3. 시간 유효성 체크
      const requestTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
        return res.status(401).send('요청 시간이 만료되었습니다. 다시 시도해주세요.');
      }

      // 4. Supabase DB에 활성화 기록 갱신
      await fetch(`${SUPABASE_URL}/rest/v1/active_malls`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          mall_id: mall_id,
          updated_at: new Date().toISOString(),
          status: 'active'
        })
      });

      // 5. 검증 완료 후 admin.html로 리다이렉트
      const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');
      return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);
    }

  } catch (error) {
    console.error('인증 처리 중 서버 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};