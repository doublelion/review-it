// 파일 경로: api/webhook.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 카페24 API 버전 규격 적용
const CAFE24_API_VERSION = '2026-03-01';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { mall_id, event_type, data } = req.body;

    if (!event_type || !event_type.includes('article_created')) {
      return res.status(200).send('Not a target event');
    }

    const boardNo = data?.board_no;
    const articleNo = data?.article_no;

    if (String(boardNo) !== '4' || !articleNo) {
      return res.status(200).send('Not a review board');
    }

    console.log(`🔔 [Webhook] 리뷰 웹훅 수신: ${mall_id} (글번호: ${articleNo})`);

    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select('access_token')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData) throw new Error('Unregistered mall');
    const accessToken = mallData.access_token;

    const articleRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/${boardNo}/articles/${articleNo}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Cafe24-Api-Version': CAFE24_API_VERSION
      }
    });
    
    if (!articleRes.ok) throw new Error('Failed to fetch article');
    const { article } = await articleRes.json();

    const productNo = article.product_no;
    let productName = null;
    let productImage = null;

    if (productNo) {
      const prodRes = await fetch(`https://${mall_id}.cafe24api.com/api/v2/admin/products/${productNo}?fields=product_name,list_image`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Cafe24-Api-Version': CAFE24_API_VERSION
        }
      });
      
      if (prodRes.ok) {
        const { product } = await prodRes.json();
        productName = product.product_name;
        productImage = product.list_image;
      }
    }

    // 💡 [핵심 픽스]: 기존 리뷰의 노출 상태(is_visible) 값 보존 로직 추가
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('is_visible')
      .eq('mall_id', mall_id)
      .eq('article_no', String(article.article_no))
      .single();

    // DB에 기존 리뷰가 존재하면 그 상태를 유지하고, 완전한 신규 리뷰라면 true로 설정
    const finalIsVisible = existingReview ? existingReview.is_visible : true;

    const reviewPayload = {
      mall_id: mall_id,
      article_no: String(article.article_no),
      product_no: productNo || null,
      product_name: productName,        
      product_image: productImage,      
      member_id: article.member_id || 'guest',
      writer: article.writer || '고객',
      author_name: article.writer || '고객',
      subject: article.subject || '포토 리뷰입니다.',
      content: article.content || '',
      created_at: article.created_date,
      is_visible: finalIsVisible // 고정값이 아닌 판별된 상태값 주입
    };

    const { error: upsertError } = await supabase
      .from('reviews')
      .upsert(reviewPayload, { onConflict: 'mall_id,article_no' });

    if (upsertError) throw upsertError;

    console.log(`✅ [Webhook] 리뷰 DB 자동 저장 완료: ${productName || '상품명 없음'} (노출 상태: ${finalIsVisible})`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('🔥 [Webhook] 에러 발생:', error.message);
    return res.status(500).json({ error: error.message });
  }
}