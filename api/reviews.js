// 파일 경로: api/reviews.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// api/reviews.js 상단에 긴급 차단 삽입
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // 브라우저와 CDN에 10분간 캐싱시켜 요청 재진입 자체를 차단
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  
  // DB 조회 없이 빈 배열 또는 점검 메시지 즉시 반환
  return res.status(200).json([]);
}

// export default async function handler(req, res) {

//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET');

//   res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

//   const { mall_id, product_no } = req.query;

//   if (!mall_id) {
//     return res.status(400).json({ error: 'mall_id is required' });
//   }

//   try {
//     const { data: mallData, error: mallError } = await supabase
//       .from('active_malls')
//       .select('status, plan_type')
//       .eq('mall_id', mall_id)
//       .single();

//     if (mallError || !mallData || mallData.status !== 'active') {
//       return res.status(403).json({ error: 'Unregistered or inactive mall.' });
//     }


//     let reviewLimit = 100; 
    
//     const plan = mallData.plan_type || 'starter';
//     if (plan === 'growth') {
//       reviewLimit = 1000;
//     } else if (plan === 'pro') {
//       reviewLimit = 5000; 
//     }

//     let query = supabase
//       .from('reviews')
//       .select('*')
//       .eq('mall_id', mall_id)
//       .eq('is_visible', true)
//       .order('created_at', { ascending: false });

//     if (product_no) {
//       query = query.eq('product_no', product_no);
//     }

//     const { data: reviews, error } = await query.limit(reviewLimit);

//     if (error) throw error;

//     return res.status(200).json(reviews);
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// }