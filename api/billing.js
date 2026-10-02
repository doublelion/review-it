// 파일 경로: api/billing.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  console.log('--- 🔍 웹훅 디버깅 시작 ---');
  console.log('바디 정보 (raw):', JSON.stringify(req.body, null, 2));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { }
    else if (Buffer.isBuffer(body)) try { body = JSON.parse(body.toString('utf8')); } catch (e) { }

    const event_type = body.event_type || req.query.event_type;
    const mall_id = body.mall_id || (body.resource && body.resource.mall_id);
    const expire_date = body.expire_date || (body.resource && body.resource.expire_date);

    // 💡 [핵심] 결제 금액 또는 옵션명을 유연하게 파싱하여 요금제를 식별합니다.
    const price = body.price || body.payment_amount || (body.resource && (body.resource.price || body.resource.payment_amount)) || 5000;
    const optionName = body.option_name || (body.resource && body.resource.option_name) || '';

    console.log(`[파싱 완료] event_type: \({event_type}, mall_id:\){mall_id}, price: \({price}, option:\){optionName}`);

    if (!mall_id || !event_type) {
      console.warn('⚠️ [경고] 필수 파라미터가 누락되었습니다.');
      return res.status(200).json({ success: true, message: '파라미터 누락 스킵' });
    }

    let nextStatus = 'inactive';
    let isDeleted = false;
    let planType = 'starter'; 

    // 금액 또는 옵션명 키워드로 3-Tier 요금제를 자동 분류합니다.
    const numPrice = Number(price);
    if (numPrice >= 29000 || optionName.includes('프로') || optionName.includes('Pro')) {
      planType = 'pro';
    } else if (numPrice >= 14000 || optionName.includes('그로스') || optionName.includes('Growth')) {
      planType = 'growth';
    } else {
      planType = 'starter';
    }

    switch (event_type) {
      case 'app.paid':
      case 'app.extended':
        nextStatus = 'active';
        break;
      case 'app.deleted':
        nextStatus = 'inactive';
        isDeleted = true;
        break;
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

    if (expire_date) updatePayload.expire_date = expire_date;

    // 결제가 정상적으로 이루어지거나 연장되었을 때만 DB에 요금제를 업데이트합니다.
    if (nextStatus === 'active') {
      updatePayload.plan_type = planType;
      console.log(`🚀 [요금제 적용] \({mall_id} 상점이\){planType} 플랜으로 자동 설정되었습니다.`);
    }

    // 앱 삭제나 만료 시 재설치를 위해 토큰을 파기합니다.
    if (isDeleted) {
      updatePayload.access_token = null;
      console.log(`[토큰 초기화] ${mall_id} 상점의 토큰을 파기하여 재설치를 허용합니다.`);
    }

    const { error } = await supabase
      .from('active_malls')
      .update(updatePayload)
      .eq('mall_id', mall_id.trim());

    if (error) throw error;

    console.log(`✅ [웹훅 처리 완료] 상점: \({mall_id} -> 상태:\){nextStatus}, 적용플랜: ${planType}`);
    return res.status(200).json({ success: true, status_updated_to: nextStatus, plan: planType });

  } catch (error) {
    console.error('🔥 웹훅 실패:', error.message);
    return res.status(500).json({ error: '내부 서버 에러', details: error.message });
  }
}