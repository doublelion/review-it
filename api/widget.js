import { createClient } from '@supabase/supabase-js';

// Vercel 환경변수(Environment Variables)에 등록하세요.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mall_id } = req.query;

  try {
    // 1. 유료 회원 여부 및 상점 상태 체크
    const { data: mall, error: mallError } = await supabase
      .from('active_malls')
      .select('status')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mall || mall.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 2. POST 요청: 수집된 리뷰 데이터 Upsert (중복 처리)
    if (req.method === 'POST') {
      const payload = req.body; // uniquePayload.slice(0, 15) 처리된 배열이 들어온다고 가정

      if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).json({ error: 'Empty payload' });
      }

      const { error } = await supabase
        .from('reviews')
        .upsert(payload, { onConflict: 'mall_id,article_id' }); // 💡 article_no를 article_id로 변경!
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // 3. GET 요청: 위젯에 뿌려줄 리뷰 데이터 반환
    if (req.method === 'GET') {
      // 프론트에서 ?limit=15 형태로 보내면 그 값을 쓰고, 없으면 기본값 15 적용
      const displayLimit = parseInt(req.query.limit) || 15;

      const { data: reviews, error: reviewError } = await supabase
        .from('reviews')
        .select('*')
        .eq('mall_id', mall_id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(displayLimit); // 💡 요청한 개수(15개)만큼만 정확히 조회!

      if (reviewError) throw reviewError;
      return res.status(200).json(reviews);
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}