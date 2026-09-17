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

    // 2. POST 요청: 수집된 리뷰 데이터 Upsert (중복 처리 방어 로직 추가)
    if (req.method === 'POST') {
      const payload = req.body;

      if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).json({ error: 'Empty payload' });
      }

      // 💡 [핵심 픽스] 새로 들어온 데이터의 글 번호(article_no)만 추출
      const articleNos = payload.map(item => item.article_no);

      // 💡 기존 DB에서 해당 글 번호들의 is_visible 상태만 빠르게 조회
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('article_no, is_visible')
        .eq('mall_id', mall_id)
        .in('article_no', articleNos);

      // 💡 매칭을 위한 Map 객체 생성
      const existingStatusMap = new Map();
      if (existingReviews) {
        existingReviews.forEach(r => existingStatusMap.set(r.article_no, r.is_visible));
      }

      // 💡 Payload에 기존 노출 상태 덮어씌우기 (기존에 끈 건 끈 상태로 유지)
      const safePayload = payload.map(item => {
        if (existingStatusMap.has(item.article_no)) {
          item.is_visible = existingStatusMap.get(item.article_no);
        } else {
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

    // 3. GET 요청: 위젯에 뿌려줄 리뷰 데이터 반환
    if (req.method === 'GET') {
      const displayLimit = parseInt(req.query.limit) || 15;

      const { data: reviews, error: reviewError } = await supabase
        .from('reviews')
        .select('*')
        .eq('mall_id', mall_id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(displayLimit);

      if (reviewError) throw reviewError;
      return res.status(200).json(reviews);
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}