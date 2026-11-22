const crypto = require('crypto');

const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CAFE24_SCOPE = 'mall.read_application,mall.write_application,mall.read_product,mall.read_community,mall.write_community';
const REDIRECT_URI = 'https://review-it-tau.vercel.app/api/callback';

module.exports = async (req, res) => {
  try {
    const { mall_id, code, hmac, auth_sig } = req.query;

    if (!mall_id) {
      return res.status(400).send('mall_id가 누락되었습니다.');
    }

    if (auth_sig) {
      const expectedSig = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');
      if (auth_sig === expectedSig) {
        return res.status(200).json({ verified_mall_id: mall_id });
      } else {
        return res.status(403).json({ error: "권한이 없습니다. 변조된 요청입니다." });
      }
    }

    // =====================================================================
    // STEP 1: 강제 권한 동의 화면 리다이렉트 함수 (사전 유효성 검사 추가)
    // =====================================================================
    const redirectToAuth = async () => {
      console.log(`[설치/재설치 시작] ${mall_id} 상점을 권한 요청 화면으로 이동시킵니다.`);

      // 💡 [핵심 방어 로직 추가]
      // 브라우저 리다이렉트 전, 해당 mall_id.cafe24api.com이 실제로 존재하는지
      // Vercel 서버에서 가볍게 Ping(GET)을 때려보고, 없으면 안전하게 튕겨냅니다.
      try {
        const pingRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/oauth/authorize`, {
           method: 'HEAD' // 바디 없이 헤더만 요청해서 부하 최소화
        });
        
        // 400 에러(client_id 누락 등)가 뜨더라도 호스트 서버 자체는 살아있다는 증거이므로 통과시킵니다.
        // 하지만 호스트 자체를 찾을 수 없다면 fetch 자체가 실패(catch)로 빠지게 됩니다.
      } catch (pingError) {
        console.error(`[🚨 접근 에러] 존재하지 않는 카페24 몰 아이디: ${mall_id}`);
        // 브라우저 기본 에러(NXDOMAIN) 화면 대신, 안전하게 알럿을 띄우고 메인으로 돌려보내는 HTML 응답
        return res.status(404).send(`
          <script>
            alert("존재하지 않거나 오타가 포함된 카페24 쇼핑몰 아이디입니다. 다시 확인해 주세요.");
            window.location.href = "/index.html";
          </script>
        `);
      }

      const state = mall_id;
      const authUrl = `https://${mall_id}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${CAFE24_CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(CAFE24_SCOPE)}`;
      return res.redirect(authUrl);
    };

    // =====================================================================
    // STEP 2: 최초 진입 시 (HMAC 없음)
    // =====================================================================
    if (!hmac && !code) {
      return await redirectToAuth();
    }

    // =====================================================================
    // STEP 3: 카페24에서 이미 설치된 앱을 실행할 때 (HMAC 검증 및 DB 확인)
    // =====================================================================
    if (hmac) {
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

      if (req.query.timestamp) {
        const timestampNum = Number(req.query.timestamp);
        const requestTime = timestampNum < 10000000000 ? timestampNum * 1000 : timestampNum;
        const currentTime = Date.now();
        if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
          return res.status(401).send('요청 시간이 만료되었습니다. 다시 시도해주세요.');
        }
      }

      const dbCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/active_malls?select=access_token,status&mall_id=eq.${mall_id}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const dbMalls = await dbCheckRes.json();
      const mallData = dbMalls && dbMalls.length > 0 ? dbMalls[0] : null;

      if (!mallData || !mallData.access_token) {
        console.log(`[설치 진입] ${mall_id} - 토큰이 없으므로 권한 요청 화면으로 이동합니다.`);
        return await redirectToAuth();
      }

      if (mallData.status !== 'active') {
        console.log(`[재인증 유도] ${mall_id} - 만료/삭제된 상점, 재권한 승인을 위해 Auth 화면으로 이동합니다.`);
        return await redirectToAuth();
      }

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

      const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');
      return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);
    }

  } catch (error) {
    console.error('인증 처리 중 서버 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};