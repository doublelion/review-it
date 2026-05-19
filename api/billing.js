// api/billing.js (카페24 샘플 데이터 및 예외 처리 완벽 방어 버전)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    // 💡 안전하게 Body 데이터 가져오기 (비어있을 경우 대비 빈 객체 처리)
    const body = req.body || {};
    const { event_type, mall_id, plan_type, expire_date } = body;

    console.log(`[웹훅 수신 데이터] event_type: ${event_type}, mall_id: ${mall_id}`);

    // 💡 핵심 방어: 카페24 테스트 발송이나 가짜 데이터로 인해 mall_id가 없으면 DB를 찌르지 않고 리턴
    if (!mall_id || !event_type) {
      console.warn('⚠️ [경고] 필수 파라미터가 누락된 웹훅 요청이 들어왔습니다. (테스트 샘플 데이터 가능성)');
      // 카페24 시스템이 에러로 인식하지 않도록 200 응답을 주되, 내부 처리는 건너뜁니다.
      return res.status(200).json({ success: true, message: '파라미터 누락으로 스킵 처리되었습니다.' });
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