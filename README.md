# 머뭄 — 마음을 머물다.

독립 Cloudflare Workers + D1 버전. 3D·명상·목탁·라디오·공개 캠프(방당 10명)를 포함합니다.

## 1. 코드 업로드
전체 ZIP을 받은 경우 압축을 풀어 **내용물**(public 폴더, scripts 폴더, worker.js, package.json, wrangler.jsonc 등)을 GitHub 저장소 최상위에 업로드하세요. ZIP 파일 자체를 올리면 배포되지 않습니다. 모든 public 파일이 포함된 ZIP 업로드에서는 아래 자동 가져오기 단계를 생략할 수 있습니다.

### public 파일이 없는 초기 저장소일 때만: 최초 파일 가져오기
GitHub **Actions → Import assets** 성공을 기다리세요. 이미지·음원·3D 파일을 기존 공개 사이트에서 SHA-256 검증하여 이 저장소 `public/`에 저장하는 일회성 작업입니다. 완료 후 런타임은 기존 사이트에 의존하지 않습니다.

## 2. Cloudflare 배포
Workers & Pages → Create application → GitHub 저장소 연결 → 이 저장소 선택.
- Worker 이름: `meomum`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Node: 22 이상
D1 `DB`는 최초 배포 시 자동 프로비저닝합니다. 기존 DB 사용 시 `wrangler.jsonc`에 해당 `database_id`를 추가하세요. 테이블은 첫 공동 캠프 요청 시 생성됩니다. 제공되는 workers.dev 주소로 접속하세요. 무료 한도가 있으므로 무제한 무료는 보장하지 않습니다.

## 로컬 배포
```sh
npm install
npx wrangler login
npm run build
npm run deploy
```

## 데이터·음원
이전 활성 방·접속자는 이전하지 않고 새 D1에서 시작합니다. 메모는 방문자 기기에 저장되며 주소가 바뀌면 자동 이전되지 않습니다. API는 별명·위치·접속 시각을 저장합니다. 대규모 홍보 전 남용 방지·요청 제한을 보완하세요.
`public/camp/assets/ASSET_CREDITS.txt`를 유지하세요. 명상음악 Ever Mindful: Kevin MacLeod, CC BY 4.0. 목탁은 사용자 제공 녹음으로 원본 재사용 조건은 독립 확인되지 않았습니다. 해외 라디오는 방송사 서버 직접 연결, KBS·MBC는 공식 사이트 링크입니다.

## 검증
기존 앱을 그대로 옮기고 서버 어댑터만 표준 Worker로 변경했습니다. 문법·파일 해시 검사를 수행했습니다. 사용자 Cloudflare 계정의 실제 배포·D1 자동 생성은 배포 후 확인해야 합니다.
