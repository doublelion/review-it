const crypto = require('crypto');

// 환경변수
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// 쇼핑몰 정보 조회를 일단 제외하고 핵심 기능 권한만 채워 넣은 스코프
const CAFE24_SCOPE = 'mall.read_application,mall.write_application,mall.read_product,mall.read_community,mall.write_community';
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    const { mall_id, code, hmac } = req.query;

    if (!mall_id) {
      return res.status(400).send('mall_id가 누락되었습니다.');
    }

    // =====================================================================
    // STEP 1: 강제 권한 동의 화면 리다이렉트 함수
    // =====================================================================
    const redirectToAuth = () => {
      console.log(`[설치/재설치 시작] ${mall_id} 상점을 권한 요청 화면으로 이동시킵니다.`);
      const state = mall_id;
      const authUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${CAFE24_CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(CAFE24_SCOPE)}`;
      return res.redirect(authUrl);
    };

    // =====================================================================
    // STEP 2: 최초 진입 시 (HMAC 없음)
    // =====================================================================
    if (!hmac && !code) {
      return redirectToAuth();
    }

    // =====================================================================
    // STEP 3: 카페24에서 이미 설치된 앱을 실행할 때 (HMAC 검증 및 DB 확인)
    // =====================================================================
    if (hmac) {
      // 1. HMAC 보안 검증
      const queryString = req.url.split('?')[1] || '';
      const rawParams = queryString.split('&').filter(part => !part.startsWith('hmac='));

      rawParams.sort((a, b) => {
        const keyA = a.split('=')[0];
        const keyB = b.split('=')[0];
        return keyA.localeCompare(keyB);
      });

      const message = rawParams.join('&');
      const calculatedHmac = crypto
        .createHmac('sha256', CAFE24_CLIENT_SECRET)
        .update(message)
        .digest('base64');

      if (hmac !== calculatedHmac) {
        return res.status(401).send('보안 검증(HMAC)에 실패했습니다.');
      }

      // 2. 시간 유효성 체크
      if (req.query.timestamp) {
        const timestampNum = Number(req.query.timestamp);
        const requestTime = timestampNum < 10000000000 ? timestampNum * 1000 : timestampNum;
        const currentTime = Date.now();
        if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
          return res.status(401).send('요청 시간이 만료되었습니다. 다시 시도해주세요.');
        }
      }

      // 3. DB에서 토큰뿐만 아니라 "status" 상태도 함께 가져와서 검사합니다!
      const dbCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/active_malls?select=access_token,status&mall_id=eq.${mall_id}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      const dbMalls = await dbCheckRes.json();
      const mallData = dbMalls && dbMalls.length > 0 ? dbMalls[0] : null;

      // [방어 1] 앱 정보가 아예 없거나 토큰이 비어있는 경우 (신규 설치 or 앱 삭제 후 재설치)
      if (!mallData || !mallData.access_token) {
        console.log(`[설치 진입] ${mall_id} - 토큰이 없으므로 권한 요청 화면으로 이동합니다.`);
        return redirectToAuth();
      }

      // [방어 2] 토큰은 있지만 상태가 inactive인 경우 (단순 이용 기간 만료)
      if (mallData.status !== 'active') {
        console.log(`[재인증 유도] ${mall_id} - 만료/삭제된 상점, 재권한 승인을 위해 Auth 화면으로 이동합니다.`);
        return redirectToAuth(); // ◄── 여기가 핵심입니다! 알럿 없이 바로 권한 동의 화면으로 보냅니다.
      }

      // 만약 inactive 상태였지만 재설치 프로세스를 밟는 중(code가 있음)이라면 아래로 통과되어 재인증을 진행하게 됩니다.

      // 4. 정상 유저(active)라면 접속 기록(updated_at)만 갱신
      await fetch(`${SUPABASE_URL}/rest/v1/active_malls?on_conflict=mall_id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          mall_id: mall_id,
          updated_at: new Date().toISOString()
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