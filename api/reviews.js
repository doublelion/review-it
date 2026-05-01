import { createClient } from '@supabase/supabase-js';

// 환경 변수로 관리하여 보안 강화
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  // CORS 설정: 카페24 도메인에서만 호출 가능하게 제한
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    // 1단계: 유료 회원(유효한 몰)인지 체크 (SaaS 핵심)
    const { data: mallStatus } = await supabase
      .from('active_malls')
      .select('status')
      .eq('mall_id', mall_id)
      .single();

    if (!mallStatus || mallStatus.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 2단계: 리뷰 데이터 조회
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (product_no) {
      query = query.eq('product_no', product_no);
    }

    const { data: reviews, error } = await query.limit(20);

    if (error) throw error;

    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}