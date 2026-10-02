// api/sync-reviews.js (Vercel Serverless Function)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 💡 무조건 200 OK로 응답하여 서버 크래시(500)를 원천 차단합니다.
  try {
    const { mall_id } = req.query;

    if (!mall_id) {
      return res.status(200).json({ success: false, error: "mall_id가 필요합니다." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY; 
    
    // [방어 1] 환경변수 누락 시 크래시 방지
    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ success: false, error: "Vercel에 SUPABASE_URL 또는 SUPABASE_KEY 환경변수가 없습니다." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // [방어 2] DB에서 토큰을 찾지 못해도 뻗지 않고 메시지로 반환 (single 대신 maybeSingle 사용)
    const { data: mallData, error: dbError } = await supabase
      .from('active_malls')
      .select('access_token')
      .eq('mall_id', mall_id)
      .maybeSingle();

    if (dbError) {
      return res.status(200).json({ success: false, error: "DB 조회 에러", details: dbError });
    }
    
    if (!mallData || !mallData.access_token) {
      return res.status(200).json({ success: false, error: "우리 DB에 해당 상점의 토큰이 없습니다. (상점이 앱을 삭제했거나 연동 실패)" });
    }

    // [방어 3] 과거 리뷰 한 번에 500개까지 싹쓸이 수집 (?limit=500)
    const cafe24Res = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/4/articles?limit=500`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mallData.access_token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2023-03-01'
      }
    });

    if (!cafe24Res.ok) {
      const errText = await cafe24Res.text();
      return res.status(200).json({ success: false, error: `Cafe24 API 거절 (${cafe24Res.status})`, details: errText });
    }

    const data = await cafe24Res.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      return res.status(200).json({ success: true, message: "게시판에 과거 리뷰가 0개입니다.", count: 0 });
    }

    // Supabase 스키마에 맞게 데이터 정제
    const syncData = articles.map(article => ({
      mall_id: mall_id,
      board_no: '4',
      article_no: String(article.article_no),
      product_no: article.product_no ? String(article.product_no) : null,
      author_name: article.writer,
      content: article.content || '본문 없음',
      created_at: article.created_date,
      is_visible: true
    }));

    // [방어 4] DB 저장 중 에러 발생 시 크래시 방지
    const { error: upsertError } = await supabase
      .from('reviews')
      .upsert(syncData, { onConflict: 'mall_id, board_no, article_no' });

    if (upsertError) {
      return res.status(200).json({ success: false, error: "Supabase 저장 실패", details: upsertError });
    }

    // 완벽한 성공!
    res.status(200).json({ 
      success: true, 
      count: syncData.length, 
      message: `${syncData.length}개의 리뷰가 성공적으로 자동 동기화되었습니다.` 
    });

  } catch (error) {
    // 모든 종류의 서버 붕괴를 잡아내서 화면에 뿌려줌
    res.status(200).json({ success: false, error: "예기치 못한 서버 에러 발생", details: error.message });
  }
}