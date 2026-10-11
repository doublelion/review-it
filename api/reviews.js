// 파일 경로: api/reviews.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 💡 [방어막 유지] 방문자 폭주 시 Vercel CDN 요청 차감을 막아주는 브라우저/엣지 캐시
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select('status, plan_type')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData || mallData.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 💡 [요금제 로직 원복] 대표님이 구현해두신 3단계 요금제 데이터 제공량 제한
    let reviewLimit = 100; // Starter (기본 100개)
    
    const plan = mallData.plan_type || 'starter';
    if (plan === 'growth') {
      reviewLimit = 1000;  // Growth (1,000개)
    } else if (plan === 'pro') {
      reviewLimit = 5000;  // Pro (5,000개)
    }

    let query = supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (product_no) {
      query = query.eq('product_no', product_no);
    }

    // 여기서 요금제별 한도(reviewLimit)가 최종 적용되어 데이터 추출량을 체크 및 통제합니다.
    const { data: reviews, error } = await query.limit(reviewLimit);

    if (error) throw error;

    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}