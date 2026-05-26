// api/billing.js (카페24 샘플 데이터 및 예외 처리 완벽 방어 버전)
import { createClient } from '@supabase/supabase-js';

// SUPABASE_KEY도 인식하도록 수정
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // 1. CORS 및 가벼운 OPTIONS 요청 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  try {
    // 💡 1. Vercel/Next.js 환경에 맞춘 강력한 Body 포장지 뜯기
    let body = req.body || {};

    // body가 문자열(String)로 들어왔다면 JSON으로 강제 변환
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { console.error('JSON 파싱 에러:', e); }
    } 
    // body가 버퍼(Buffer) 형태라면 문자열로 바꾼 뒤 JSON 변환
    else if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString('utf8')); } catch (e) { console.error('Buffer 파싱 에러:', e); }
    }

    // 💡 2. 카페24가 정확히 어떤 구조로 데이터를 주는지 전체 확인 (디버깅용)
    console.log('📦 [웹훅 원본 전체 데이터]:', JSON.stringify(body, null, 2));

    // 💡 3. 카페24 웹훅 특성 반영 (데이터가 resource { } 안에 숨어있을 수 있음)
    const event_type = body.event_type;
    const mall_id = body.mall_id || (body.resource && body.resource.mall_id);
    const plan_type = body.plan_type || 'basic';
    const expire_date = body.expire_date || null;

    console.log(`[파싱 완료] event_type: ${event_type}, mall_id: ${mall_id}`);

    // 💡 핵심 방어
    if (!mall_id || !event_type) {
      console.warn('⚠️ [경고] 필수 파라미터가 누락되었습니다. 원본 데이터를 확인하세요.');
      return res.status(200).json({ success: true, message: '파라미터 누락 스킵' });
    }


    let nextStatus = 'inactive';

    // 카페24 이벤트 정밀 매칭
    switch (event_type) {
      case 'app.paid':       // 결제됨
      case 'app.extended':   // 연장됨
        nextStatus = 'active';
        break;

      case 'app.deleted':    // 삭제됨
      case 'app.expired':    // 만료됨
      case 'app.refund.requested': // 환불요청
      case 'app.refund.completed': // 환불완료
        nextStatus = 'inactive';
        break;

      default:
        nextStatus = 'inactive';
    }

    // 💡 Supabase DB 작업 수행
    const { error } = await supabase
      .from('active_malls')
      .upsert({
        mall_id: mall_id.trim(), // 공백 방지
        status: nextStatus,
        plan_type: plan_type || 'basic',
        expire_date: expire_date || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'mall_id' });

    if (error) {
      console.error('❌ Supabase DB 갱신 실패:', error.message);
      // DB 에러 시 로그를 남기고 리턴 구조화
      throw error;
    }

    console.log(`✅ [웹훅 처리 완료] 상점: ${mall_id} -> 상태: ${nextStatus}`);
    return res.status(200).json({ success: true, status_updated_to: nextStatus });

  } catch (error) {
    console.error('🔥 [최상위 에러 핸들러] 웹훅 실패:', error.message);
    // 500 에러를 반환하되 메타데이터 확인용 응답 폼 제공
    return res.status(500).json({ error: '내부 서버 에러', details: error.message });
  }
}