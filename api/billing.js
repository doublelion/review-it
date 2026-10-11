// 파일 경로: api/billing.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { }
    } else if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString('utf8')); } catch (e) { }
    }

    const resObj = body.resource || {};
    const event_type = body.event_type || req.query.event_type;
    const mall_id = body.mall_id || resObj.mall_id;

    // 만료일 파싱
    const expire_date = body.expire_date || resObj.expire_date || resObj.expiration_date;

    // 결제 금액 파싱 (숫자만 추출)
    const rawPrice = resObj.order_price || resObj.payment_amount || resObj.price || body.price || 0;
    const price = Number(String(rawPrice).replace(/[^0-9]/g, '')) || 0;

    // 옵션/상품명 파싱
    const optionName = (resObj.item_name || resObj.option_name || resObj.service_name || body.option_name || '').toLowerCase();

    console.log(`[웹훅 수신] 이벤트: ${event_type}, 몰ID: ${mall_id}, 금액: ${price}, 옵션명: ${optionName}`);

    if (!mall_id || !event_type) {
      console.warn('⚠️ 필수 파라미터 누락으로 처리 건너뜀');
      return res.status(200).json({ success: true, message: '파라미터 누락 스킵' });
    }

    let nextStatus = 'inactive';
    let isDeleted = false;
    let planType = 'starter';

    // 💡 실제 등록 요금제 기준 정확한 3-Tier 판별 (Starter: 5,000 / Growth: 14,900 / Pro: 29,900)
    if (price >= 20000 || optionName.includes('pro') || optionName.includes('프로')) {
      planType = 'pro';
    } else if (price >= 10000 || optionName.includes('growth') || optionName.includes('그로스')) {
      planType = 'growth';
    } else {
      planType = 'starter';
    }

    switch (event_type) {
      case 'app.paid':
      case 'app.extended':
        nextStatus = 'active';
        break;
      case 'app.installed':
        nextStatus = 'active';
        break;
      case 'app.deleted':
      case 'app.expired':
      case 'app.refund':
        nextStatus = 'inactive';
        isDeleted = true;
        break;
      default:
        nextStatus = 'inactive';
    }

    let updatePayload = {
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (expire_date) {
      updatePayload.expire_date = expire_date;
    }

    // 결제 완료 또는 활성화 상태일 때만 해당 요금제 부여
    if (nextStatus === 'active') {
      updatePayload.plan_type = planType;
    }

    // 앱 삭제/환불 시 토큰 파기 (재설치 허용 목적)
    if (isDeleted) {
      updatePayload.access_token = null;
    }

    const { error } = await supabase
      .from('active_malls')
      .update(updatePayload)
      .eq('mall_id', mall_id.trim());

    if (error) {
      console.error('Supabase DB 업데이트 에러:', error);
      return res.status(200).json({ success: false, error: error.message });
    }

    console.log(`✅ [웹훅 처리 성공] ${mall_id} -> 상태: ${nextStatus}, 플랜: ${planType}`);
    return res.status(200).json({ success: true, status: nextStatus, plan: planType });

  } catch (error) {
    console.error('🔥 웹훅 예외 발생:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}