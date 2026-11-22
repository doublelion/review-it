import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 💡 [핵심 추가 1] CORS Preflight(OPTIONS) 요청 강력 캐싱
  // 브라우저가 본 요청(GET)을 보내기 전 확인하는 OPTIONS 요청을 24시간(86400초) 캐싱합니다.
  // 이 처리가 없으면 매 API 호출마다 CDN 요청이 2배(OPTIONS + GET)로 차감됩니다.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }

  // 💡 [핵심 수정 2] 브라우저 캐시(max-age) 대폭 증가
  // max-age=300 (5분): 동일 방문자는 5분 동안 새로고침/페이지 이동 시 Vercel CDN에 아예 접속하지 않고 브라우저에서 읽음
  // s-maxage=3600 (1시간): Vercel Edge 서버에 1시간 저장 (상품별/URL별로 자동 분리 저장됨)
  // stale-while-revalidate=86400: 캐시 만료 시 백그라운드 갱신
  res.setHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
  );

  const { mall_id, product_no } = req.query;

  if (!mall_id) {
    return res.status(400).json({ error: 'mall_id is required' });
  }

  try {
    const { data: mallData, error: mallError } = await supabase
      .from('active_malls')
      .select('status, plan_type')
      .eq('mall_id', mall_id)
      .single();

    if (mallError || !mallData || mallData.status !== 'active') {
      return res.status(403).json({ error: 'Unregistered or inactive mall.' });
    }

    // 💡 [요금제 로직 원복] 대표님이 구현해두신 3단계 요금제 데이터 제공량 제한 (건드리지 않음)
    let reviewLimit = 100; // Starter (기본 100개)

    const plan = mallData.plan_type || 'starter';
    if (plan === 'growth') {
      reviewLimit = 1000;  // Growth (1,000개)
    } else if (plan === 'pro') {
      reviewLimit = 5000;  // Pro (5,000개)
    }

    let query = supabase
      .from('reviews')
      .select('*')
      .eq('mall_id', mall_id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (product_no) {
      query = query.eq('product_no', product_no);
    }

    // 여기서 요금제별 한도(reviewLimit)가 최종 적용되어 데이터 추출량을 체크 및 통제합니다.
    const { data: reviews, error } = await query.limit(reviewLimit);

    if (error) throw error;

    return res.status(200).json(reviews);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}