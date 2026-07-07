# 배포 전 테스트 체크리스트

## 자동 검증

배포 전 기본 검증은 다음 명령으로 실행한다.

```bash
pnpm verify
```

`pnpm verify`는 다음 작업을 순서대로 실행한다.

- `pnpm prisma:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

브라우저 smoke test는 별도로 실행한다.

새 환경에서 처음 실행할 때는 Playwright 브라우저를 먼저 설치한다.

```bash
pnpm exec playwright install chromium
```

```bash
pnpm test:e2e
```

`test:e2e`는 기존 로컬 개발 서버가 `127.0.0.1:3000`에 떠 있으면 재사용하고, 없으면 같은 포트로 개발 서버를 실행한 뒤 주요 페이지가 렌더링되는지 확인한다. 다른 배포/프리뷰 URL을 대상으로 실행하려면 `PLAYWRIGHT_BASE_URL`을 지정한다. 이 경우 로컬 개발 서버는 실행하지 않고 지정한 URL만 테스트한다.

```bash
PLAYWRIGHT_BASE_URL=https://배포도메인 pnpm test:e2e
```

`/concerts` 테스트는 DB 연결과 seed 데이터 상태에 영향을 받을 수 있으므로, 테스트 DB 또는 로컬 개발 DB가 준비된 상태에서 실행한다.

## 수동 E2E 시나리오

아래 흐름은 Supabase Auth, Supabase Storage, OpenAI Vision API처럼 외부 서비스 의존이 있어 배포 전 사람이 직접 확인한다.

1. 회원가입 또는 로그인한다.
2. 공연 목록에서 공연 상세 페이지로 이동한다.
3. 좌석 배치도 이미지를 업로드한다.
4. AI 좌석 구역 분석을 실행한다.
5. 구역명, 등급, 가격을 수정한다.
6. 구역 외곽선 polygon을 수정하고 저장한다.
7. 별도의 좌석 생성 단계를 거치지 않는지 확인한다.
8. 티켓팅 연습 화면으로 이동한다.
9. 사이트 방식과 난이도를 선택한다.
10. 대기열, 보안문자, 날짜/회차 선택 단계를 진행한다.
11. 좌석 배치도 위에서 구역을 선택하고 좌석 선택을 시도한다.
12. 성공 또는 실패 결과가 저장되는지 확인한다.
13. 좌석 구역 리뷰 화면에서 리뷰를 작성한다.
14. 리뷰 이미지 업로드가 동작하는지 확인한다.
15. 마이페이지에서 내 리뷰와 티켓팅 연습 기록이 표시되는지 확인한다.
16. 마이페이지 또는 리뷰 화면에서 내 리뷰 삭제가 동작하는지 확인한다.

## 공연 정보 동기화 확인

KOPIS API 키와 동기화 secret이 설정된 환경에서 공연 정보 동기화를 확인한다.

```bash
curl -X POST http://localhost:3000/api/admin/concerts/sync \
  -H "Authorization: Bearer $CONCERT_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"monthsAhead":6,"rows":20,"pages":1}'
```

키워드/지역/장르 조건이 필요한 경우 다음처럼 요청한다.

```bash
curl -X POST http://localhost:3000/api/admin/concerts/sync \
  -H "Authorization: Bearer $CONCERT_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"monthsAhead":6,"rows":20,"pages":1,"genreCode":"AAAA","regionCode":"11","keyword":"사랑"}'
```

동기화 후 `/concerts`에서 다가오는 공연이 표시되는지 확인한다. `/concerts?q=공연명`, `/concerts?region=서울`, `/concerts?genre=뮤지컬` 검색/필터도 확인한다. API 키가 없거나 secret이 틀리면 동기화 API는 실패해야 한다.

## 배포 후 Smoke Test

배포 URL에서 최소한 다음 항목을 확인한다.

- `/` 접속 가능
- `/concerts` 접속 가능
- `/login` 접속 가능
- `/my` 비로그인 접근 시 로그인 페이지로 이동
- `/api/health` 응답 정상

```bash
curl https://배포도메인/api/health
```
