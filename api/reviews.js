import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }

  res.setHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  );

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    // 💡 [수정 1] 에러의 원인이었던 mall_stats 조인을 제거하고 active_malls만 단독 조회
    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select('status, plan_type')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData || mallData.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    const currentPlan = mallData.plan_type || 'starter';

    // 요금제별 최대 노출 허용량 제한 (basic/starter: 100, growth: 1000, pro: 5000)
    let reviewLimit = 100;
    if (currentPlan === 'growth') reviewLimit = 1000;
    if (currentPlan === 'pro') reviewLimit = 5000;

    let query = supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (product_no) {
      query = query.eq('product_no', product_no);
    }

    const { data: reviews, error } = await query.limit(reviewLimit);

    if (error) throw error;

    // 💡 [수정 2] 프론트엔드 위젯 스크립트들이 즉시 렌더링할 수 있도록 순수 배열(reviews) 반환
    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  
}