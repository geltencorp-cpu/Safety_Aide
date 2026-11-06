# 안전비서 상세페이지

중대재해처벌법 대응 안전관리 시스템 **안전비서** 소개 웹사이트입니다.

- `index.html` : 홈 + 업종별 상세페이지(제조업·서비스업·건설업·소상공인·시장)
- `assets/` : 이미지와 아이콘
- `cloudflare-worker/worker.js` : 상담 신청을 Discord로 전달하는 Cloudflare Worker 코드

## 상담 신청 연결
1. `cloudflare-worker/worker.js`를 Cloudflare Worker로 배포합니다.
2. Worker 설정에 `DISCORD_WEBHOOK_URL`(Secret)과 `ALLOWED_ORIGINS`(Text)를 추가합니다.
3. `index.html`의 `LEAD_ENDPOINT` 값을 배포한 Worker 주소로 바꿉니다.
