# 흑석도시락

별점 말고, 흑석동이 실제로 많이 결제한 집.
BC카드 eat.pl 잇플 데이터(k-skill `bccard-eatpl-search` 스킬)로 흑석동 맛집을 매출 순위로 보여 주는 모바일 우선 웹 서비스입니다.

## 구성
- `index.html`, `style.css`, `app.js` — 화면 (빌드 없음)
- `api/places.js` — Vercel 서버 함수. k-skill 프록시를 흑석동 도로명별로 호출해 합치고 중앙대 / 흑석역·현충로 / 서달로·한강으로 분류
- 맛집 카드의 "eat.pl에서 자세히 보기" 링크가 잇플로 보내는 핵심 동선 (referrer 유지)

## 배포 (Vercel)
1. vercel.com 에 GitHub 로 로그인 → Add New → Project → `heukseokdosirak` Import
2. Framework Preset: **Other**, 그대로 Deploy
3. 나온 주소(예: `heukseokdosirak.vercel.app`)를 공모전 참가 신청에 서비스 도메인으로 등록
4. 주소가 다르면 `index.html` 의 `og:image` 주소를 그 주소로 바꾸기

## 데이터 고지
eat.pl 잇플 · BC카드 결제 데이터 기반. 순위는 최근 1개월 결제 기준이며 영업 예상 시간은 공식 영업시간이 아닙니다. 이 서비스는 BC카드·잇플의 공식 서비스가 아닙니다.


> 이 서비스는 [moonsinmouse-stack/yeouidosirak](https://github.com/moonsinmouse-stack/yeouidosirak)(여의도시락)를 바탕으로 흑석동용으로 바꾼 것입니다.
