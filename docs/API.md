# API 문서

이 문서는 `src/app/api/**/route.ts` 구현 기준으로 API 주소, 요청 방식, 요청값, 응답값, 주요 에러 상황을 정리한다.

## 공통 규칙

- Base URL: 배포 환경 도메인 또는 로컬 개발 서버 `http://localhost:3000`
- 인증: 일반 사용자 API는 Supabase 세션 쿠키가 필요하다. 문서의 요청란에 `인증 필요`로 표시했다.
- 관리자 동기화 API는 `Authorization: Bearer {CONCERT_SYNC_SECRET}` 또는 `x-sync-secret: {CONCERT_SYNC_SECRET}` 헤더가 필요하다.
- JSON 요청은 `Content-Type: application/json`을 사용한다.
- 파일 업로드 요청은 `multipart/form-data`를 사용한다.

### 성공 응답 형식

대부분의 API는 다음 형식으로 응답한다.

```json
{
  "data": {}
}
```

`/api/health`만 예외적으로 다음 형식으로 응답한다.

```json
{
  "ok": true
}
```

### 에러 응답 형식

```json
{
  "error": {
    "message": "에러 메시지",
    "status": 400
  }
}
```

## API 목록

| Method | Endpoint | 설명 | 요청 | 응답 | 주요 에러 상황 |
| ------ | -------- | ---- | ---- | ---- | -------------- |
| GET | `/api/health` | 서버 상태 확인 | 없음 | `200` `{ ok: true }` | - |
| GET | `/api/home` | 홈 화면용 추천 공연과 최신 리뷰 조회 | 없음 | `200` `{ data: { featuredConcerts, recentReviews } }` | - |
| GET | `/api/concerts` | 공연 목록 조회 | Query: `scope?: upcoming \| latest \| samples \| all`, `q?: string`, `region?: string`, `genre?: string` | `200` `{ data: { concerts } }` | `400` 공연 목록 조회 조건 오류 |
| GET | `/api/concerts/{concertId}` | 공연 상세 조회 | Path: `concertId: uuid` | `200` `{ data: { concert } }` | `400` 공연 ID 오류, `404` 공연 없음 |
| GET | `/api/admin/concerts/sync` | 공연 정보 동기화 | 관리자 secret 필요. Query: `monthsAhead?: 1~12`, `rows?: 1~50`, `pages?: 1~5`, `genreCode?: string`, `regionCode?: string`, `keyword?: string` | `200` `{ data: { result } }` | `401` 권한 없음, `422` 입력값 오류, `500` 동기화 실패 |
| POST | `/api/admin/concerts/sync` | 공연 정보 동기화 | 관리자 secret 필요. JSON Body: `monthsAhead?: 1~12`, `rows?: 1~50`, `pages?: 1~5`, `genreCode?: string`, `regionCode?: string`, `keyword?: string` | `200` `{ data: { result } }` | `400` 요청 형식 오류, `401` 권한 없음, `422` 입력값 오류, `500` 동기화 실패 |
| GET | `/api/users/me` | 현재 로그인 사용자와 프로필 조회 | 인증 필요 | `200` `{ data: { user, profile } }` | `401` 로그인 필요 |
| POST | `/api/users/me` | 현재 로그인 사용자의 프로필 생성 또는 보장 | 인증 필요 | `200` `{ data: { user, profile } }` | `401` 로그인 필요 |
| PATCH | `/api/users/me` | 현재 로그인 사용자 프로필 수정 | 인증 필요. JSON Body: `nickname?: string`, `profileImageUrl?: string \| null` | `200` `{ data: { profile } }` | `401` 로그인 필요, `422` 프로필 입력값 오류 |
| GET | `/api/users/me/reviews` | 내가 작성한 리뷰 목록 조회 | 인증 필요 | `200` `{ data: { reviews } }` | `401` 로그인 필요 |
| GET | `/api/users/me/practice-sessions` | 내 티켓팅 연습 기록 목록 조회 | 인증 필요 | `200` `{ data: { practiceSessions } }` | `401` 로그인 필요 |
| POST | `/api/seat-maps/upload` | 좌석 배치도 이미지 업로드 | 인증 필요. Form Data: `file: png/jpeg`, `concertId: uuid`, `imageWidth?: number`, `imageHeight?: number` | `201` `{ data: { seatMap } }` | `400` 업로드 요청 형식 오류, `401` 로그인 필요, `404` 공연 없음, `422` 파일/입력값 오류, `500` Storage 또는 저장 실패 |
| GET | `/api/seat-maps/{seatMapId}` | 좌석 배치도 상세 및 구역 조회 | 인증 필요. Path: `seatMapId: uuid` | `200` `{ data: { seatMap } }` | `400` 좌석 배치도 ID 오류, `401` 로그인 필요, `404` 좌석 배치도 없음 |
| POST | `/api/seat-maps/{seatMapId}/analyze` | AI 좌석 구역 분석 실행 | 인증 필요. Path: `seatMapId: uuid` | `200` `{ data: { seatMap, zoneCount } }` | `400` 좌석 배치도 ID 오류, `401` 로그인 필요, `403` 분석 권한 없음, `404` 좌석 배치도 없음, `500` AI 분석 실패 |
| POST | `/api/seat-maps/{seatMapId}/seat-zones` | 좌석 배치도에 수동 좌석 구역 추가 | 인증 필요. Path: `seatMapId: uuid`. JSON Body: `name: string`, `grade: string`, `price?: number \| null`, `bbox?: { x, y, width, height }` | `200` `{ data: { seatZone } }` | `400` 좌석 배치도 ID 오류, `401` 로그인 필요, `404` 좌석 배치도 없음, `409` 분석 미완료, `422` 좌석 구역 입력값 오류 |
| POST | `/api/seat-maps/{seatMapId}/virtual-seats` | 좌석 배치도 전체 좌석 수 기준으로 구역별 가상 좌석 생성 | 인증 필요. Path: `seatMapId: uuid`. JSON Body: `totalSeatCount: 1~30000`, `overwrite?: boolean` | `201` `{ data: { totalSeatCount, zoneCount, seatCount, allocations } }` | `400` 좌석 배치도 ID 오류, `401` 로그인 필요, `404` 좌석 배치도 없음, `409` 분석 미완료/구역 없음/기존 좌석 존재, `422` 좌석 수 오류, `500` 좌석 생성 실패 |
| PATCH | `/api/seat-zones/{zoneId}` | 좌석 구역 정보 수정 | 인증 필요. Path: `zoneId: uuid`. JSON Body: `name: string`, `grade: string`, `price?: number \| null`, `polygon?: { x, y }[]` | `200` `{ data: { seatZone, seatCount } }` | `400` 좌석 구역 ID 오류, `401` 로그인 필요, `403` 수정 권한 없음, `404` 좌석 구역 없음, `422` 좌석 구역 입력값 오류 |
| DELETE | `/api/seat-zones/{zoneId}` | 좌석 구역 삭제 | 인증 필요. Path: `zoneId: uuid` | `200` `{ data: { deleted: true } }` | `400` 좌석 구역 ID 오류, `401` 로그인 필요, `403` 삭제 권한 없음, `404` 좌석 구역 없음 |
| GET | `/api/seat-zones/{zoneId}/virtual-seats` | 좌석 구역의 가상 좌석 목록 조회 | 인증 필요. Path: `zoneId: uuid` | `200` `{ data: { zone, virtualSeats } }` | `400` 좌석 구역 ID 오류, `401` 로그인 필요, `404` 좌석 구역 없음 |
| POST | `/api/seat-zones/{zoneId}/virtual-seats` | 좌석 구역 단위 가상 좌석 생성 | 인증 필요. Path: `zoneId: uuid`. JSON Body: `rows?: 1~20`, `seatsPerRow?: 1~30`, `overwrite?: boolean` | `201` `{ data: { zone, virtualSeats } }` | `400` 좌석 구역 ID 오류, `401` 로그인 필요, `403` 생성 권한 없음, `404` 좌석 구역 없음, `409` 기존 좌석 존재, `422` 좌석 데이터 입력값 오류 |
| GET | `/api/seat-zones/{zoneId}/reviews` | 좌석 구역 리뷰 목록과 평점 요약 조회 | 인증 필요. Path: `zoneId: uuid` | `200` `{ data: { zone, reviews, summary } }` | `400` 좌석 구역 ID 오류, `401` 로그인 필요, `404` 좌석 구역 없음 |
| POST | `/api/seat-zones/{zoneId}/reviews` | 좌석 구역 리뷰 작성 | 인증 필요. Path: `zoneId: uuid`. Form Data: `viewScore: 1~5`, `soundScore: 1~5`, `distanceScore: 1~5`, `satisfactionScore: 1~5`, `content: 10~1000자`, `image?: png/jpeg` | `201` `{ data: { review } }` | `400` 좌석 구역 ID/요청 형식 오류, `401` 로그인 필요, `404` 좌석 구역 없음, `422` 리뷰 입력값/이미지 오류, `500` Storage 또는 저장 실패 |
| POST | `/api/concerts/{concertId}/reviews` | 공연 상세 화면에서 수동 좌석 정보 기반 리뷰 작성 | 인증 필요. Path: `concertId: uuid`. Form Data: `seatFloor: floor \| 1~10`, `seatSection: 3자 영문/숫자`, `seatRow: string`, `seatNumber: string`, `viewScore: 1~5`, `soundScore: 1~5`, `distanceScore: 1~5`, `satisfactionScore: 1~5`, `content: 10~1000자`, `images?: png/jpeg[]` 또는 `image?: png/jpeg` | `201` `{ data: { review } }` | `400` 공연 ID/요청 형식 오류, `401` 로그인 필요, `404` 리뷰 작성 대상 공연 없음, `422` 리뷰 입력값/이미지 오류, `500` Storage 또는 저장 실패 |
| POST | `/api/practice-sessions` | 티켓팅 연습 세션 시작 | 인증 필요. JSON Body: `concertId: uuid`, `templateType: nol_old \| nol_new \| yes24 \| melon`, `difficulty?: easy \| normal \| hard`, `startDelayMs?: 0~60000` | `201` `{ data: { practiceSession } }` | `401` 로그인 필요, `404` 공연 없음, `409` 분석된 좌석 구역 또는 좌석 데이터 없음, `422` 연습 시작 입력값 오류, `500` 연습 준비 실패 |
| GET | `/api/practice-sessions/{sessionId}` | 티켓팅 연습 세션 상세 조회 | 인증 필요. Path: `sessionId: uuid` | `200` `{ data: { practiceSession } }` | `400` 연습 세션 ID 오류, `401` 로그인 필요, `404` 연습 세션 없음 |
| PATCH | `/api/practice-sessions/{sessionId}/complete` | 티켓팅 연습 세션 완료 처리 | 인증 필요. Path: `sessionId: uuid`. JSON Body: `status: success \| failed`, `scheduleId?: uuid`, `selectedZoneId?: uuid \| null`, `selectedSeatId?: uuid \| null`, `elapsedMs: 0~600000`, `failReason?: string \| null` | `200` `{ data: { practiceSession } }` | `400` 연습 세션 ID 오류, `401` 로그인 필요, `404` 연습 세션 없음, `422` 완료 입력값/회차/좌석 검증 오류 |
| PATCH | `/api/reviews/{reviewId}` | 리뷰 수정 | 인증 필요. Path: `reviewId: uuid`. JSON Body: `viewScore: 1~5`, `soundScore: 1~5`, `distanceScore: 1~5`, `satisfactionScore: 1~5`, `content: 10~1000자` | `200` `{ data: { review } }` | `400` 리뷰 ID 오류, `401` 로그인 필요, `403` 수정 권한 없음, `404` 리뷰 없음, `422` 리뷰 수정 입력값 오류 |
| DELETE | `/api/reviews/{reviewId}` | 리뷰 삭제 | 인증 필요. Path: `reviewId: uuid` | `200` `{ data: { deleted: true } }` | `400` 리뷰 ID 오류, `401` 로그인 필요, `403` 삭제 권한 없음, `404` 리뷰 없음 |
| POST | `/api/reviews/{reviewId}/reports` | 리뷰 신고 | 인증 필요. Path: `reviewId: uuid`. JSON Body: `reason: spam \| abuse \| privacy \| irrelevant \| other`, `details?: string` | `201` `{ data: { report, alreadyReported: false } }`, 중복 신고 시 `200` `{ data: { report, alreadyReported: true } }` | `400` 리뷰 ID 오류 또는 본인 리뷰 신고, `401` 로그인 필요, `404` 리뷰 없음, `422` 신고 입력값 오류 |
