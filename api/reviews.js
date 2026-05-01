import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { mall_id, product_no } = req.query;

  // 특정 상품의 리뷰만 가져오기
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('mall_id', mall_id)
    .eq('product_no', product_no)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json(reviews);
}