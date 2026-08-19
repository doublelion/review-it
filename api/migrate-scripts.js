// api/migrate-scripts.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const CAFE24_CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CAFE24_API_VERSION = '2026-03-01';

export default async function handler(req, res) {
  try {
    // 1. 활성 상점 토큰 조회
    const { data: malls, error } = await supabase
      .from('active_malls')
      .select('mall_id, access_token')
      .eq('status', 'active');

    if (error || !malls) throw error;

    const newScriptUrl = 'https://review-it-tau.vercel.app/review-detail.js';
    const results = [];

    // 2. 각 상점별로 review-detail.js 주입
    for (const mall of malls) {
      const response = await fetch(`https://${mall.mall_id}.cafe24api.com/api/v2/admin/scripttags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mall.access_token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': CAFE24_API_VERSION
        },
        body: JSON.stringify({
          shop_no: 1,
          request: {
            client_id: CAFE24_CLIENT_ID,
            src: newScriptUrl,
            display_location: ["ALL"]
          }
        })
      });

      results.push({
        mall_id: mall.mall_id,
        success: response.ok
      });
    }

    return res.status(200).json({ message: 'Migration complete', results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}