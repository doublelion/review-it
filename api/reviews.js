import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // 1. 완벽한 CORS 개방 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Cafe24-Api-Version, X-Cafe24-Client-Id'
  );

  // 2. 브라우저 사전 요청(OPTIONS) 캐싱 (Vercel 비용 절감)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  const { mall_id, product_no } = req.query;

  // 몰 ID는 모든 작업의 필수 값
  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    if (req.method === 'GET') {
      // 3. 요금제 및 상점 활성화 상태 완벽 체크
      const { data: mallData, error: mallError } = await supabase
        .from('active_malls')
        .select('status, plan_type')
        .eq('mall_id', mall_id)
        .single();

      if (mallError || !mallData || mallData.status !== 'active') {
        return res.status(403).json({ error: 'Unregistered or inactive mall.' });
      }

      // 4. 요금제별 데이터 제공량 제한 (PO님 기획 반영)
      const plan = mallData.plan_type || 'starter';
      let maxLimit = 100; // Starter

      if (plan === 'growth') {
        maxLimit = 1000;
      } else if (plan === 'pro') {
        maxLimit = 5000;
      }

      // 프론트엔드 위젯이 요청한 갯수(limit)와 요금제 최대 한도 중 더 작은 값을 적용하여 과부하 방지
      const requestedLimit = parseInt(req.query.limit) || 15;
      const finalLimit = Math.min(requestedLimit, maxLimit);

      // 5. 리뷰 쿼리 동적 빌드 (Supabase 체이닝)
      let query = supabase
        .from('reviews')
        .select('*')
        .eq('mall_id', mall_id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      // 상품 상세페이지에서 호출했을 경우 해당 상품 리뷰만 필터링
      if (product_no) {
        query = query.eq('product_no', product_no);
      }

      // 6. 데이터 최종 조회 및 반환
      const { data: reviews, error: reviewError } = await query.limit(finalLimit);

      if (reviewError) throw reviewError;

      return res.status(200).json(reviews);
    }

    // POST 요청(리뷰 등록/수정)이 이 파일로 들어온다면 여기에서 처리해야 합니다.
    // POST 로직이 다른 파일(예: api/widget.js)에 있다면 아래 에러 처리가 맞습니다.
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('🔥 [API Error]:', error.message);
    return res.status(500).json({ error: error.message });
  }
}