// api/auth.js (Vercel Serverless Function - Node.js)
const crypto = require('crypto');

// 카페24 개발자 센터에서 발급받은 App Secret Key (Vercel 환경변수에 등록 권장)
const CAFE24_CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET || 'XBhpYBU5I5GkmiFQljubyC';

// Supabase 정보 (Vercel 환경변수에 등록 권장)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ozxnynnntkjjjhyszbms.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_ppOXwf1JcyyAalzT7tgzdw_OZYfCFVt';

// api/auth.js 중 일부 수정
module.exports = async (req, res) => {
  try {
    const { mall_id, timestamp, hmac, user_id, user_type } = req.query;

    if (!mall_id) {
      return res.status(400).send('mall_id가 누락되었습니다.');
    }

    // 💡 [안전한 개발/테스트용 예외 처리] 
    // 카페24를 통하지 않고 프롬프트로 아이디만 입력한 경우 (hmac이 없을 때)
    if (!hmac) {
      // 허용할 개발용 테스트 쇼핑몰 ID 목록을 배열로 관리합니다.
      const ALLOWED_TEST_MALLS = ['ykinas', 'testmall123'];

      if (ALLOWED_TEST_MALLS.includes(mall_id)) {
        console.log(`[테스트 모드] 허용된 관리자(${mall_id}) 우회 접속 승인`);

        // Supabase에 상점 정보 저장/갱신
        await fetch(`${SUPABASE_URL}/rest/v1/stores`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ mall_id: mall_id, updated_at: new Date().toISOString(), is_active: true })
        });

        // 임시 서명 생성 후 admin.html로 바로 점프
        const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');
        return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);
      } else {
        // 목록에 없는 남의 상점 아이디를 치고 들어오면 가차 없이 403 에러로 튕겨냅니다.
        console.warn(`[보안 경고] 비인가 접근 시도 감지: ${mall_id}`);
        return res.status(403).send('<h1>잘못된 접근입니다.</h1><p>카페24 앱스토어를 통해 접속해주세요.</p>');
      }
    }

    // --- 이 밑으로는 정식 출시 후 카페24가 보낸 요청을 검증하는 원래 로직 ---
    const params = { mall_id, timestamp };
    if (user_id) params.user_id = user_id;
    if (user_type) params.user_type = user_type;

    const sortedQueryString = Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const calculatedHmac = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(sortedQueryString).digest('base64');

    if (hmac !== calculatedHmac) {
      return res.status(401).send('보안 검증(HMAC)에 실패했습니다.');
    }


    // 3. 시간 유효성 체크 (Replay Attack 방지 - 선택사항이지만 보안상 권장)
    // 현재 시간과 카페24가 요청을 보낸 시간(timestamp)의 차이가 너무 크면 차단합니다.
    const requestTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) { // 5분 이상 차이날 경우
      return res.status(401).send('요청 시간이 만료되었습니다. 다시 시도해주세요.');
    }

    // 4. Supabase DB에 로그인 기록 및 쇼핑몰 정보 동기화 (Upsert)
    // 무단 접근을 차단하고, 입점처 목록을 자동으로 관리하기 위함입니다.
    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/stores`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates' // 중복 시 업데이트(Upsert)
      },
      body: JSON.stringify({
        mall_id: mall_id,
        updated_at: new Date().toISOString(),
        is_active: true // 현재 앱 활성화 상태
      })
    });

    if (!supabaseResponse.ok) {
      console.error('Supabase 저장 실패:', await supabaseResponse.text());
    }

    // 5. 모든 검증이 완료되면 암호화된 토큰이나 검증 완료 세션을 들고 admin.html로 리다이렉트
    // 프론트엔드(admin.html)가 '이 사용자는 이미 검증되었다'는 것을 알 수 있도록 처리합니다.
    // 여기서는 임시로 mall_id와 검증완료 시그니처를 붙여서 넘깁니다.
    const authSignature = crypto.createHmac('sha256', CAFE24_CLIENT_SECRET).update(mall_id).digest('hex');

    return res.redirect(`/admin.html?mall_id=${mall_id}&auth_sig=${authSignature}`);

  } catch (error) {
    console.error('인증 처리 중 서버 에러:', error);
    return res.status(500).send('서버 내부 에러가 발생했습니다.');
  }
};