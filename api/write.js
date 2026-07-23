import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // CORS 설정 (어떤 쇼핑몰에서든 API를 찔러 넣을 수 있도록 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 사전 요청(Preflight) 통과
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 💡 [핵심] 수집기나 웹훅에서 보내는 모든 데이터를 스키마에 맞게 받습니다.
  const {
    mall_id,
    article_no,
    product_no,
    product_name,    // 💡 새로 추가된 상품명
    product_image,   // 💡 새로 추가된 상품 이미지
    writer,
    subject,
    content,
    stars,           // ERD에 맞게 rating -> stars로 변경
    image_urls       // ERD에 맞게 JSONB 배열로 받음
  } = req.body;

  // 1. 필수 값 체크 (article_no 식별자 필수)
  if (!mall_id || !article_no || !content) {
    return res.status(400).json({ message: '필수 데이터가 누락되었습니다.' });
  }

  // 2. 리뷰 저장 (insert 대신 upsert를 사용하여 중복 방지 및 업데이트)
  const { data, error } = await supabase
    .from('reviews')
    .upsert([{
      mall_id,
      article_no: String(article_no),
      product_no: product_no || null,
      product_name: product_name || null,
      product_image: product_image || null,
      writer: writer || '고객',
      author_name: writer || '고객',
      subject: subject || '포토 리뷰입니다.',
      content,
      stars: stars || 5,
      image_urls: image_urls || [],
      is_visible: true
    }], { onConflict: 'mall_id,article_no' }); // mall_id와 article_no가 같으면 덮어쓰기

  if (error) {
    console.error('🔥 DB 쓰기 에러:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ message: '리뷰가 성공적으로 등록/갱신되었습니다.', data });
}