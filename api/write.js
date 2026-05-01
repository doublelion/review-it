import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { mall_id, product_no, writer, content, rating, image_url } = req.body;

  // 1. 필수 값 체크
  if (!mall_id || !product_no || !content || !rating) {
    return res.status(400).json({ message: '필수 데이터가 누락되었습니다.' });
  }

  // 2. 리뷰 저장
  const { data, error } = await supabase
    .from('reviews')
    .insert([{ mall_id, product_no, writer, content, rating, image_url }]);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ message: '리뷰가 성공적으로 등록되었습니다.', data });
}