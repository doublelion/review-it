import { createClient } from '@supabase/supabase-js';

// Vercel 환경변수(Environment Variables)에 등록하세요.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mall_id } = req.query;

  try {
    // 1. 유료 회원 여부 및 상점 상태 체크 (SaaS 수익 보호의 핵심)
    const { data: mall, error: mallError } = await supabase
      .from('stores')
      .select('status')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mall || mall.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 2. POST 요청: 수집된 리뷰 데이터 Upsert (중복 처리)
    if (req.method === 'POST') {
      const payload = req.body;
      const { error } = await supabase
        .from('reviews')
        .upsert(payload, { onConflict: 'mall_id,article_no' });

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 3. GET 요청: 위젯에 뿌려줄 리뷰 데이터 반환
    const { data: reviews, error: reviewError } = await supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (reviewError) throw reviewError;
    return res.status(200).json(reviews);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}