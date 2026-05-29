// api/billing.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  console.log('--- 🔍 웹훅 디버깅 시작 ---');
  console.log('바디 정보 (raw):', JSON.stringify(req.body, null, 2));
  console.log('쿼리 정보 (URL param):', JSON.stringify(req.query, null, 2));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { }
    else if (Buffer.isBuffer(body)) try { body = JSON.parse(body.toString('utf8')); } catch (e) { }

    // 💡 [수정] 바디에 없으면 우리가 URL에 달아둔 query에서 강제로 가져옵니다!
    const event_type = body.event_type || req.query.event_type;
    const mall_id = body.mall_id || (body.resource && body.resource.mall_id);
    const expire_date = body.expire_date || (body.resource && body.resource.expire_date);

    console.log(`[파싱 완료] event_type: ${event_type}, mall_id: ${mall_id}`);

    if (!mall_id || !event_type) {
      console.warn('⚠️ [경고] 필수 파라미터가 누락되었습니다.');
      return res.status(200).json({ success: true, message: '파라미터 누락 스킵' });
    }

    let nextStatus = 'inactive';
    let isDeleted = false;

    switch (event_type) {
      case 'app.paid':
      case 'app.extended':
        nextStatus = 'active';
        break;
      case 'app.deleted':
        nextStatus = 'inactive';
        isDeleted = true; // 💡 삭제됨 감지
        break;
      case 'app.expired':
      case 'app.refund':
        nextStatus = 'inactive';
        break;
      default:
        nextStatus = 'inactive';
    }

    let updatePayload = {
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (expire_date) updatePayload.expire_date = expire_date;

    // 💡 [핵심] 앱 삭제 시, 토큰을 완전히 지워버려 재설치(권한동의)가 열리도록 합니다!
    if (isDeleted) {
      updatePayload.access_token = null;
      console.log(`[토큰 초기화] ${mall_id} 상점의 토큰을 파기하여 재설치를 허용합니다.`);
    }

    // upsert 대신 update를 사용하여 다른 필수 정보(refresh token 등)가 날아가는 것을 방지
    const { error } = await supabase
      .from('active_malls')
      .update(updatePayload)
      .eq('mall_id', mall_id.trim());

    if (error) throw error;

    console.log(`✅ [웹훅 처리 완료] 상점: ${mall_id} -> 상태: ${nextStatus}`);
    return res.status(200).json({ success: true, status_updated_to: nextStatus });

  } catch (error) {
    console.error('🔥 웹훅 실패:', error.message);
    return res.status(500).json({ error: '내부 서버 에러', details: error.message });
  }
}