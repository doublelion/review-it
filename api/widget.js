// api/widget.js
import { createClient } from '@supabase/supabase-js'; // Supabase 사용 예시

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { mall_id } = req.query;

  // 1. DB에서 해당 쇼핑몰의 상태 조회
  const { data: mall, error } = await supabase
    .from('stores')
    .select('status')
    .eq('mall_id', mall_id)
    .single();

  // 2. 차단 로직: 앱 삭제 유저이거나 미결제 유저인 경우
  if (!mall || mall.status === 'unpaid' || mall.status === 'deleted') {
    return res.status(200).send(`
      console.log('Review-it: 서비스가 비활성화 상태입니다. 결제 상태를 확인해주세요.');
    `);
  }

  // 3. 정상 유저: 실제 위젯 스크립트 코드 전송
  const widgetCode = `
    (function() {
      const container = document.getElementById('rit-widget-container');
      if (container) {
        // 여기에 실제 리뷰를 불러오는 로직 삽입
        container.innerHTML = '리뷰 위젯이 활성화되었습니다.';
        console.log('Review-it: Loaded for ${mall_id}');
      }
    })();
  `;

  res.setHeader('Content-Type', 'application/javascript');
  return res.send(widgetCode);
}