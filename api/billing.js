import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 💡 CORS Preflight(OPTIONS) 요청 강력 캐싱 (유지)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }

  
  // 💡 브라우저 캐시(max-age) 및 Vercel Edge 캐싱 설정 (유지)
  res.setHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  );

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    // 💡 [핵심 보정 1] active_malls와 mall_stats를 조인하여 요금제와 총 리뷰 수를 한 번에 조회 (서버 부하 최소화)
    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select(`
        status, 
        plan_type,
        mall_stats ( total_reviews )
      `)
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData || mallData.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    const currentPlan = mallData.plan_type || 'starter';
    const totalReviews = mallData.mall_stats?.[0]?.total_reviews || 0;

    // 💡 [요금제 로직] 3단계 요금제 노출 허용량 제한
    let reviewLimit = 100; // Starter
    if (currentPlan === 'growth') reviewLimit = 1000;
    if (currentPlan === 'pro') reviewLimit = 5000;

    // 💡 [핵심 보정 2] 초과 여부 계산 (대시보드 업그레이드 유도용)
    const isLimitReached = totalReviews >= reviewLimit;
    const lockedReviewsCount = isLimitReached ? (totalReviews - reviewLimit) : 0;

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

    // 💡 [핵심 보정 3] 단순 배열 반환에서 meta 데이터를 포함한 객체 형태로 응답 구조 변경
    return res.status(200).json({
      meta: {
        current_plan: currentPlan,
        total_reviews: totalReviews,
        is_limit_reached: isLimitReached,
        locked_reviews_count: lockedReviewsCount
      },
      reviews: reviews
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}