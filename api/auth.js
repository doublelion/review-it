const crypto = require('crypto');

// 환경변수
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 앱, 상품, 게시물 권한을 모두 포함
const CAFE24_SCOPE = 'mall.read_application,mall.write_application,mall.read_product,mall.read_community,mall.write_community';
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    const { mall_id, code, hmac } = req.query;

    if (!mall_id) {
      return res.status(400).send('mall_id가 누락되었습니다.');
    }

    // =====================================================================
    // STEP 1: 최초 앱 설치 진입 시 -> 카페24 권한 동의 화면으로 보내기
    // =====================================================================
    if (!hmac && !code) {
      console.log(`[앱 설치 시작] ${mall_id} 상점을 권한 요청 화면으로 이동시킵니다.`);
      const state = crypto.randomBytes(16).toString('hex');
      const authUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${CAFE24_CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(CAFE24_SCOPE)}`;
      return res.redirect(authUrl);
    }

    // =====================================================================
    // STEP 2: 카페24에서 이미 설치된 앱을 실행할 때 (HMAC 검증)
    // =====================================================================
    if (hmac) {
      // 🚨 핵심 수정: Vercel의 자동 한글 변환을 우회하기 위해 req.url에서 날것 그대로의 문자열을 추출합니다.
      const queryString = req.url.split('?')[1] || '';

      // hmac을 제외한 나머지 파라미터들만 추출
      const rawParams = queryString.split('&').filter(part => !part.startsWith('hmac='));

      // 키(key)를 기준으로 알파벳 오름차순 정렬
      rawParams.sort((a, b) => {
        const keyA = a.split('=')[0];
        const keyB = b.split('=')[0];
        return keyA.localeCompare(keyB);
      });

      // 다시 &로 연결하여 완벽한 원본 검증 문자열 생성 (예: user_name=%EA%B9...)
      const message = rawParams.join('&');

      // HMAC 생성 및 비교
      const calculatedHmac = crypto
        .createHmac('sha256', CAFE24_CLIENT_SECRET)
        .update(message)
        .digest('base64');

      if (hmac !== calculatedHmac) {
        console.error('HMAC 검증 실패!');
        console.error('- 원본 검증 문자열:', message);
        console.error('- 내 계산값:', calculatedHmac);
        console.error('- 카페24 값:', hmac);
        return res.status(401).send('보안 검증(HMAC)에 실패했습니다.');
      }

      // 3. 시간 유효성 체크
      if (req.query.timestamp) {
        const timestampNum = Number(req.query.timestamp);
        const requestTime = timestampNum < 10000000000 ? timestampNum * 1000 : timestampNum;
        const currentTime = Date.now();

        if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
          return res.status(401).send('요청 시간이 만료되었습니다. 다시 시도해주세요.');
        }
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