// 파일 경로: api/reviews.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // 💡 [핵심 방어막] Vercel Edge Cache 적용
  // 쇼핑몰 방문자 1,000명이 동시에 접속해도, 60초 동안은 우리 DB를 단 1번만 타격합니다.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    // 1단계: 유효 상점 체크 및 요금제(plan_type) 동시 조회
    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select('status, plan_type')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData || mallData.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 2단계: 요금제별 노출 제한(Limit) 동적 할당
    let reviewLimit = 100; // Starter 기본값
    
    const plan = mallData.plan_type || 'starter';
    if (plan === 'growth') {
      reviewLimit = 1000;
    } else if (plan === 'pro') {
      reviewLimit = 5000; // '무제한'이더라도 서버 보호를 위한 하드 리밋
    }

    // 3단계: 리뷰 데이터 조회
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (product_no) {
      query = query.eq('product_no', product_no);
    }

    const { data: reviews, error } = await query.limit(reviewLimit);

    if (error) throw error;

    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}