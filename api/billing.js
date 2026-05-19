// api/billing.js (카페24 정식 웹훅 스펙 반영본)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  try {
    // 카페24 웹훅은 기본적으로 아래와 같은 형태로 데이터를 보냅니다.
    // event_type 예시: 'app.deleted', 'app.expired', 'app.extended', 'app.paid', 'app.refund.requested', 'app.refund.completed'
    const { event_type, mall_id, plan_type, expire_date } = req.body; 

    if (!mall_id || !event_type) {
      return res.status(400).json({ error: '필수 파라미터(mall_id, event_type)가 누락되었습니다.' });
    }

    console.log(`[웹훅 수신] 상점: ${mall_id} | 이벤트: ${event_type}`);

    let nextStatus = 'inactive';
    
    // 카페24 이벤트 매칭 분기 처리
    switch (event_type) {
      case 'app.paid':       // 쇼핑몰에 설치된 앱이 결제된 경우
      case 'app.extended':   // 쇼핑몰에 설치된 앱의 만료일이 연장된 경우
        nextStatus = 'active';
        break;
        
      case 'app.deleted':    // 쇼핑몰에 설치된 앱이 삭제된 경우
      case 'app.expired':    // 쇼핑몰에 설치된 앱이 만료된 경우
      case 'app.refund.requested': // 결제 환불을 요청한 경우
      case 'app.refund.completed': // 결제 환불이 완료된 경우
        nextStatus = 'inactive';
        break;
        
      default:
        nextStatus = 'inactive';
    }

    // Supabase DB 갱신 (Upsert)
    const { error } = await supabase
      .from('active_malls')
      .upsert({ 
        mall_id: mall_id, 
        status: nextStatus,
        plan_type: plan_type || 'basic',
        expire_date: expire_date || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'mall_id' });

    if (error) throw error;

    // 카페24 서버에게 성공(200) 시그널 반환
    return res.status(200).json({ success: true, status_updated_to: nextStatus });
    
  } catch (error) {
    console.error('웹훅 핸들러 에러:', error);
    return res.status(500).json({ error: '내부 서버 에러가 발생했습니다.' });
  }
}