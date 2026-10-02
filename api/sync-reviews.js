// api/sync-reviews.js (Vercel Serverless Function)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { mall_id } = req.query; // 💡 토큰을 파라미터로 받지 않습니다.

  if (!mall_id) {
    return res.status(400).json({ error: "mall_id가 필요합니다." });
  }

  try {
    // 1. 우리 DB(active_malls)에서 해당 상점의 가장 최신 Access Token을 알아서 꺼내옵니다.
    const { data: mallData, error: dbError } = await supabase
      .from('active_malls')
      .select('access_token')
      .eq('mall_id', mall_id)
      .single();

    if (dbError || !mallData || !mallData.access_token) {
      throw new Error("DB에 해당 상점의 유효한 토큰이 없습니다.");
    }

    const access_token = mallData.access_token;

    // 2. 카페24 상품후기 게시판(board_no: 4) API 호출
    const cafe24Res = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/4/articles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2023-03-01' 
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

    // 3. Supabase 스키마에 맞게 데이터 정제
    const syncData = articles.map(article => ({
      mall_id: mall_id,
      board_no: '4',
      article_no: String(article.article_no),
      product_no: article.product_no ? String(article.product_no) : null,
      author_name: article.writer,
      content: article.content || '',
      created_at: article.created_date,
      is_visible: true
    }));

    // 4. Supabase DB 일괄 적재 (Upsert로 중복 방지)
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