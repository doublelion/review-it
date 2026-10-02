// api/sync-reviews.js (Vercel Serverless Function)
import { createClient } from '@supabase/supabase-js';

// 환경변수에 Supabase 정보 세팅 필요
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 호출 시 mall_id와 해당 몰의 access_token을 전달받음
  const { mall_id, access_token } = req.query;

  if (!mall_id || !access_token) {
    return res.status(400).json({ error: "mall_id와 access_token이 필요합니다." });
  }

  try {
    // 1. 카페24 상품후기 게시판(board_no: 4) API 호출
    const cafe24Res = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/4/articles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2025-12-01'
      }
    });

    if (!cafe24Res.ok) {
      throw new Error(`Cafe24 API Error: ${cafe24Res.status}`);
    }

    const data = await cafe24Res.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      return res.status(200).json({ message: "동기화할 리뷰가 없습니다.", count: 0 });
    }

    // 2. Supabase 스키마에 맞게 데이터 정제
    const syncData = articles.map(article => ({
      mall_id: mall_id,
      board_no: '4',
      article_no: String(article.article_no),
      product_no: article.product_no ? String(article.product_no) : null,
      author_name: article.writer,
      content: article.content || '',
      created_at: article.created_date,
      // 필요한 경우 별점(rating) 추출 로직 추가
      is_visible: true
    }));

    // 3. Supabase DB 일괄 적재 (Upsert로 중복 방지)
    const { error } = await supabase
      .from('reviews')
      .upsert(syncData, { onConflict: 'mall_id, board_no, article_no' });

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      count: syncData.length, 
      message: `${syncData.length}개의 리뷰가 성공적으로 동기화되었습니다.` 
    });

  } catch (error) {
    console.error('[SYNC ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
}