// api/permissions.xml (또는 api/permissions.js)
module.exports = (req, res) => {
  // 1. 브라우저와 카페24 시스템이 이 응답을 정식 XML 문서로 인식하도록 헤더 설정
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');

  // CORS 허용 (카페24 서버에서 이 XML을 긁어갈 수 있도록 처리)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 2. 카페24 규격에 맞춘 app_permission XML 데이터 생성
  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<app_permission>
    <item>
        <no>1</no>
        <text>리뷰 대시보드 및 설정</text>
        <url>https://review-it-tau.vercel.app/admin.html</url>
    </item>
</app_permission>`;

  // 3. 200 OK 사인과 함께 XML 데이터 전송
  return res.status(200).send(xmlContent);
};