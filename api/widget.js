import { createClient } from '@supabase/supabase-js';

// Vercel 환경변수(Environment Variables)에 등록하세요.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 💡 CORS Preflight 요청 캐싱 (CDN 비용 절감)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    // =================================================================
    // [GET 요청] 위젯 렌더링용 데이터 반환 (요금제 한도 적용 및 CDN 캐싱)
    // =================================================================
    if (req.method === 'GET') {
      // 💡 GET 요청에만 Vercel Edge 캐시 적용 (POST 요청 시 캐싱 방지)
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');

      const { data: mallData, error: mallError } = await supabase
        .from('active_malls')
        .select('status, plan_type, mall_stats ( total_reviews )')
        .eq('mall_id', mall_id)
        .single();

      if (mallError || !mallData || mallData.status !== 'active') {
        return res.status(403).json({ error: 'Unregistered or inactive mall.' });
      }

      const currentPlan = mallData.plan_type || 'starter';
      const totalReviews = mallData.mall_stats?.[0]?.total_reviews || 0;

      // 💡 요금제별 최대 노출 허용량 동적 설정
      let reviewLimit = 100;
      if (currentPlan === 'growth') reviewLimit = 1000;
      if (currentPlan === 'pro') reviewLimit = 5000;

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

      
      const { data: reviews, error: reviewError } = await query.limit(reviewLimit);
      if (reviewError) throw reviewError;

      // 💡 배열 대신 객체 반환 (프론트엔드 넛지 배너 대응 완벽 호환)
      return res.status(200).json({
        meta: {
          current_plan: currentPlan,
          total_reviews: totalReviews,
          is_limit_reached: isLimitReached,
          locked_reviews_count: lockedReviewsCount
        },
        reviews: reviews
      });
    }

    // =================================================================
    // [POST 요청] 수집된 리뷰 데이터 Upsert (상태 보존 방어 로직)
    // =================================================================
    if (req.method === 'POST') {
      // POST는 캐싱하지 않음. 상점 활성화 여부만 빠르게 체크
      const { data: mall, error: mallError } = await supabase
        .from('active_malls')
        .select('status')
        .eq('mall_id', mall_id)
        .single();

      if (mallError || !mall || mall.status !== 'active') {
        return res.status(403).json({ error: 'Unregistered or inactive mall.' });
      }

      const payload = req.body;

      if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).json({ error: 'Empty payload' });
      }

      const articleNos = payload.map(item => item.article_no);

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('article_no, is_visible')
        .eq('mall_id', mall_id)
        .in('article_no', articleNos);

      const existingStatusMap = new Map();
      if (existingReviews) {
        existingReviews.forEach(r => existingStatusMap.set(r.article_no, r.is_visible));
      }

      const safePayload = payload.map(item => {
        if (existingStatusMap.has(item.article_no)) {
          // 기존 DB에 값이 있으면 운영자가 설정한 값(is_visible)을 절대 건드리지 않음
          item.is_visible = existingStatusMap.get(item.article_no);
        } else {
          // 신규 유입 리뷰는 기본적으로 노출(true) 처리
          item.is_visible = item.is_visible !== undefined ? item.is_visible : true;
        }
        return item;
      });

      const { error } = await supabase
        .from('reviews')
        .upsert(safePayload, { onConflict: 'mall_id,article_no' });

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}