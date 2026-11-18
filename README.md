# 우리집 보드 (세윤이네)

가족 일정·픽업·루틴·한마디와 아이 공부방(한글·셈·구구단·파닉스), 놀이터(세계 시계 지도·이착륙·여행)를 한곳에 모은 웹앱입니다.

- 실제 주소: https://urijip-board.pages.dev (Cloudflare Pages)
- 화면: `public/index.html`(보드), `public/study.html`(공부방), `public/games.html`(놀이터)
- 공통 스타일: `public/app.css`, `public/theme.css`, `public/skins.css`(배경별 색 규칙은 맨 아래)
- 서버 규칙: `lib/family.mjs` (Cloudflare `functions/api/family.js`와 PC용 `dev-server.mjs`가 함께 씀)
- 공부방 도움 코드: `public/hangul.js`(한글 나누기·합치기·받침 소리), `public/progress.js`(연속 공부·오늘 목표·틀린 문제를 다음 판 맨 앞에)
- 응답 머리말(보안·캐시): `public/_headers`, 끊김 대비: `public/sw.js` (화면을 고쳐 올리면 `VERSION`을 올려 주세요)
- 세계지도 자료 만들기: `tools/map/build-map.mjs` (Natural Earth 공개 자료) → `node tools/map/shrink-map.mjs` 로 줄이기
- 글꼴: 원본은 `tools/fonts/src`, 화면 문구를 많이 바꾸면 `python3 tools/fonts/subset.py` (fonttools·brotli 필요)

## 내 PC에서 보기
```
node dev-server.mjs   # http://localhost:8830  (가족 데이터는 .dev-data.json)
npm test              # 서버 규칙·한글 도움 코드 단위 테스트 (node --test)
```

## 다시 올리기 (Cloudflare Pages)
```
npx wrangler@4.40.0 pages deploy public --project-name urijip-board --branch main
```

## 고칠 때 지켜 주세요
- 화면 문구는 아이 한 명(세윤) 기준입니다.
- 글꼴 역할: 제목 느좋체, 본문 Hada, 시계·숫자 깍두기, 배우는 한글 글자 서울알림체, 쪽지·칭찬 야옹엄마체.
- 틀 색은 고정색 대신 배경별 `--tint`, `--tint-soft`, `--tint-ink`를 씁니다.
