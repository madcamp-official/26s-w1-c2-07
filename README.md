# 26s-w1-c2-07

## 공통과제 I : 웹 기반 프로젝트 (2인 1팀)

**목적:** 공통 과제를 함께 수행하며 웹 개발의 전체 흐름을 빠르게 익히고 협업에 적응하기

**결과물:** 기획부터 배포까지 완료된 웹 서비스와 관련 문서 일체

---

## 기획안

> 프로젝트 주제, 목적, 핵심 기능, 예상 사용자, 팀원별 역할 등 정리

- **주제:** 콘서트 티켓팅 연습, 콘서트 정보 제공, 좌석 리뷰 기능을 통합한 웹 기반 콘서트 정보 플랫폼
- **목적:** 인기 콘서트 티켓팅 과정에서 발생하는 빠른 좌석 선택과 좌석 정보 부족 문제를 해결하고, 사용자가 사전에 티켓팅을 연습하며 공연 정보를 한곳에서 확인할 수 있도록 지원한다.
- **핵심 기능:**
  - **티켓팅 연습:** 주요 티켓팅 사이트별 예매 흐름을 바탕으로 대기열, 보안 문자, 화면 전환, 좌석 선택, 시간 제한 환경을 제공하여 사용자가 티켓팅 과정을 미리 경험할 수 있다.
  - **콘서트 정보 제공:** 공연 목록, 공연 일정, 장소, 출연진, 가격대 등 콘서트 관련 정보를 제공한다.
  - **좌석 배치도 분석:** 사용자가 업로드한 좌석 배치도 이미지를 AI가 분석해 좌석 구역을 추출하고, 구역 크기에 맞는 연습용 좌석 데이터를 자동으로 준비해 티켓팅 연습에 활용한다.
  - **좌석 리뷰:** 사용자가 공연장 좌석 구역별 시야, 음향, 거리감, 만족도 등을 리뷰로 남기고 다른 사용자의 후기를 확인할 수 있다.
- **예상 사용자:**
  - 콘서트 티켓팅을 처음 시도하거나 예매 과정이 익숙하지 않은 사용자
  - 인기 공연 예매 성공률을 높이기 위해 사전 연습이 필요한 팬
  - 공연 일정, 장소, 가격 등 콘서트 정보를 한곳에서 확인하고 싶은 사용자
  - 공연장 좌석 구역별 후기를 공유하고 다른 사용자의 리뷰를 참고하려는 관람객
- **팀원별 역할:**

<table>
  <thead>
    <tr>
      <th width="120">담당자</th>
      <th width="320">주 담당 영역</th>
      <th>정리 문서</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>김도연</td>
      <td>기획, 사용자 흐름, 화면 설계, 티켓팅 연습, 좌석 리뷰</td>
      <td>기획안, IA 및 화면 설계서, 회고 문서 편집</td>
    </tr>
    <tr>
      <td>박정준</td>
      <td>데이터 구조, API 구조, 콘서트 정보, 좌석 정보, 배포 기술 문서</td>
      <td>DB 스키마, API 문서, 배포 링크 및 실행 방법, 기술 회고</td>
    </tr>
    <tr>
      <td>공동</td>
      <td>기능 명세 조율, 배포 결과물 검토, 회고 내용 작성</td>
      <td>기능 명세서, 배포 결과물, 회고 문서</td>
    </tr>
  </tbody>
</table>

---

## 기능 명세서

> 구현할 기능을 사용자 관점에서 정리하고, 필수 기능과 선택 기능을 구분

### 1. 기능 명세 개요

본 프로젝트는 콘서트 예매를 준비하는 사용자가 주요 티켓팅 사이트의 예매 흐름을 미리 연습하고, 사용자가 직접 등록한 좌석 배치도를 기반으로 좌석 구역 정보와 구역별 리뷰를 공유할 수 있도록 지원하는 웹 기반 콘서트 정보 플랫폼이다.

서비스는 티켓 오픈 시간 운영 관리는 제외하고, 좌석 배치도 업로드 및 AI 분석, 티켓팅 사이트별 예매 흐름 연습, 좌석 구역 단위 리뷰 기능에 집중한다. 좌석 구역은 업로드된 이미지에서 분석하고, 구역 내부의 열과 좌석 번호는 구역 크기와 형태를 기준으로 티켓팅 연습용 데이터로 자동 준비한다.

### 2. 주요 사용자 흐름

#### 좌석 배치도 기반 티켓팅 연습

1. 사용자가 공연 정보를 확인한다.
2. 공연 또는 공연장 좌석 배치도 이미지를 업로드한다.
3. AI가 좌석 구역을 분석하면, 구역별 열과 좌석 번호가 연습용 데이터로 자동 준비된다.
4. 사용자가 연습할 티켓팅 사이트 방식을 선택한다.
5. 사용자가 대기열, 보안 문자, 좌석 선택, 시간 제한 흐름을 연습한다.
6. 사용자가 예매 성공 여부와 선택한 좌석 정보를 확인한다.

#### 좌석 구역 리뷰 확인 및 작성

1. 사용자가 좌석 배치도에서 특정 좌석 구역을 선택한다.
2. 사용자가 해당 구역의 리뷰, 만족도, 시야 사진을 확인한다.
3. 사용자가 좌석 구역 단위로 시야, 음향, 거리감, 만족도, 텍스트 리뷰를 작성한다.
4. 사용자가 구역 시야 사진을 함께 첨부할 수 있다.

### 3. 필수 기능

#### 공연 정보 조회 기능

사용자 관점: 사용자는 예매를 준비할 공연의 기본 정보를 확인할 수 있다.

주요 기능:

- 공연 목록 조회
- 공연명, 일정, 장소, 출연진, 가격 정보 표시
- 공연 상세 페이지 이동

#### 좌석 배치도 업로드 및 AI 분석 기능

사용자 관점: 사용자는 직접 등록한 좌석 배치도 이미지를 티켓팅 연습과 좌석 리뷰의 기반 데이터로 사용할 수 있다.

주요 기능:

- 좌석 배치도 이미지 업로드
- AI 좌석 구역 분석
- 좌석 구역명, 위치, 등급 정보 표시
- 분석 결과 저장

#### 연습용 좌석 데이터 자동 준비 기능

사용자 관점: 사용자는 정확한 몇 열 몇 번 정보가 없어도 좌석 구역 기반으로 티켓팅 연습을 할 수 있다.

주요 기능:

- 구역 크기와 형태에 맞는 열 구성 준비
- 구역별 연습용 좌석 번호 준비
- 실제 좌석 정보가 아닌 연습용 데이터임을 표시
- 준비된 좌석 데이터를 티켓팅 연습에 자동 연결

#### 티켓팅 사이트 방식 선택 기능

사용자 관점: 사용자는 실제로 이용할 티켓팅 사이트의 예매 흐름에 맞춰 연습할 수 있다.

주요 기능:

- 주요 티켓팅 사이트 방식 선택
- 사이트별 화면 전환 순서 적용
- 대기열, 보안 문자, 날짜/회차 선택, 좌석 선택 단계 제공

#### 티켓팅 연습 기능

사용자 관점: 사용자는 실제 티켓팅 전에 좌석 선택 과정과 시간 제한 상황을 미리 경험할 수 있다.

주요 기능:

- 티켓팅 연습 시작
- 대기열 시뮬레이션
- 보안 문자 입력 연습
- 제한 시간 내 좌석 선택
- 예매 성공 또는 실패 결과 확인

#### 좌석 구역 리뷰 조회 기능

사용자 관점: 사용자는 예매 전 좌석 구역별 후기를 참고해 좌석 선택 판단에 도움을 받을 수 있다.

주요 기능:

- 좌석 구역별 리뷰 목록 조회
- 시야, 음향, 거리감, 만족도 확인
- 구역 시야 사진 확인

#### 좌석 구역 리뷰 작성 기능

사용자 관점: 사용자는 몇 열 몇 번까지 입력하지 않고 좌석 구역 단위로 관람 경험을 공유할 수 있다.

주요 기능:

- 좌석 구역 선택
- 시야, 음향, 거리감, 만족도 입력
- 텍스트 리뷰 작성
- 구역 시야 사진 첨부

#### 로그인 및 마이페이지 기능

사용자 관점: 사용자는 자신의 리뷰와 티켓팅 연습 기록을 지속적으로 관리할 수 있다.

주요 기능:

- 회원가입, 로그인, 로그아웃
- 내가 작성한 리뷰 조회
- 내가 진행한 티켓팅 연습 기록 조회

#### 기본 페이지 이동 기능

사용자 관점: 사용자는 공연 정보, 좌석 배치도, 티켓팅 연습, 좌석 구역 리뷰 화면을 자연스럽게 오갈 수 있다.

주요 기능:

- 메인 페이지 이동
- 공연 목록 및 상세 페이지 이동
- 좌석 배치도 등록 페이지 이동
- 티켓팅 연습 페이지 이동
- 좌석 구역 리뷰 페이지 이동

### 4. 선택 기능

#### 공연 검색 및 필터링 기능

사용자 관점: 사용자는 원하는 공연을 빠르게 찾을 수 있다.

주요 기능:

- 공연명, 아티스트명, 공연장명 검색
- 날짜, 지역, 공연장, 가격대별 필터링

#### AI 분석 결과 수정 기능

사용자 관점: 사용자는 AI가 잘못 분석한 좌석 구역 정보를 직접 보정할 수 있다.

주요 기능:

- 좌석 구역명 수정
- 좌석 구역 위치 또는 범위 수정
- 좌석 등급 및 가격 정보 수정

#### 티켓팅 연습 고도화 기능

사용자 관점: 사용자는 자신의 숙련도에 맞춰 더 실제에 가까운 티켓팅 상황을 연습할 수 있다.

주요 기능:

- 티켓팅 연습 난이도 설정
- 좌석 매진 시뮬레이션
- 티켓팅 사이트 템플릿 추가 또는 수정

#### 티켓팅 연습 기록 및 랭킹 기능

사용자 관점: 사용자는 자신의 연습 결과를 확인하고 다른 사용자와 성과를 비교할 수 있다.

주요 기능:

- 연습 결과 저장
- 성공 여부, 선택 구역, 소요 시간 기록
- 사용자별 또는 공연별 랭킹 제공

#### 좌석 구역 리뷰 편의 기능

사용자 관점: 사용자는 필요한 리뷰를 더 빠르게 찾고 유용한 리뷰를 구분할 수 있다.

주요 기능:

- 리뷰 최신순, 만족도순, 좋아요순 정렬
- 좌석 구역 리뷰 좋아요
- 구역 시야 사진 관리

#### 반응형 웹 UI 개선

사용자 관점: 사용자는 PC와 모바일 환경에서 모두 서비스를 편리하게 이용할 수 있다.

주요 기능:

- 모바일 공연 목록 UI
- 모바일 좌석 배치도 표시 최적화
- 터치 기반 좌석 선택

---

## IA 및 화면 설계서

> 서비스의 전체 페이지 구조와 페이지 간 이동 흐름; 각 페이지의 주요 UI 구성, 입력 요소, 버튼, 사용자 행동 흐름 등을 간단한 와이어프레임 형태로 정리

<!-- Figma 링크 또는 이미지 첨부 -->

---

## DB 스키마

GrapeRush는 공연 정보를 중심으로 좌석 배치도, 좌석 구역, 가상 좌석, 좌석 리뷰, 티켓팅 연습 기록을 연결하는 구조로 설계했다. 좌석 배치도 이미지를 AI로 분석한 결과는 `SeatMap`과 `SeatZone`에 저장하고, 사용자의 연습 결과와 리뷰 데이터는 각각 `PracticeSession`, `Review`에 분리해 저장한다.

<table>
  <tr>
    <td align="center" bgcolor="#ffffff">
      <img src="./db-erd.svg" alt="GrapeRush DB ERD" width="100%" />
    </td>
  </tr>
</table>

### 주요 테이블

| 테이블 | 역할 | 주요 필드 |
| ------ | ---- | --------- |
| `Profile` | 사용자 프로필 정보 | `id`, `nickname`, `profileImageUrl`, `createdAt` |
| `Concert` | 공연 기본 정보 | `title`, `artist`, `venueName`, `region`, `startDate`, `endDate`, `priceMin`, `priceMax` |
| `ConcertSchedule` | 공연 회차 및 일정 정보 | `concertId`, `performanceDate`, `roundName`, `startTime` |
| `SeatMap` | 공연별 좌석 배치도와 AI 분석 상태 | `concertId`, `imageUrl`, `analysisStatus`, `aiRawResult`, `createdBy` |
| `SeatZone` | 좌석 배치도 안의 구역 정보 | `seatMapId`, `name`, `grade`, `price`, `polygon`, `bbox`, `isAiGenerated` |
| `VirtualSeat` | 티켓팅 연습에 사용하는 구역별 가상 좌석 | `zoneId`, `rowLabel`, `seatNumber`, `status`, `x`, `y` |
| `Review` | 사용자가 작성한 좌석 리뷰 | `userId`, `concertId`, `zoneId`, `viewScore`, `soundScore`, `distanceScore`, `satisfactionScore`, `content`, `imageUrls` |
| `PracticeSession` | 티켓팅 연습 기록 | `userId`, `concertId`, `scheduleId`, `templateType`, `difficulty`, `status`, `selectedZoneId`, `selectedSeatId`, `elapsedMs` |
| `ReviewReport` | 부적절한 리뷰 신고 내역 | `reviewId`, `reporterId`, `reason`, `details`, `createdAt` |

### 주요 관계

- `Concert`는 여러 개의 `ConcertSchedule`, `SeatMap`, `Review`, `PracticeSession`을 가진다.
- `SeatMap`은 하나의 `Concert`에 속하며, 여러 개의 `SeatZone`을 가진다.
- `SeatZone`은 하나의 `SeatMap`에 속하며, 여러 개의 `VirtualSeat`, `Review`, `PracticeSession`과 연결된다.
- `Review`는 작성자인 `Profile`, 대상 공연인 `Concert`, 선택된 좌석 구역인 `SeatZone`과 연결된다.
- `PracticeSession`은 사용자, 공연, 회차, 선택 구역, 선택 좌석을 저장해 티켓팅 연습 결과를 추적한다.
- `ReviewReport`는 하나의 리뷰와 신고한 사용자를 연결하며, 같은 사용자가 같은 리뷰를 중복 신고하지 못하도록 `reviewId`와 `reporterId` 조합을 유니크하게 관리한다.

### 설계 의도

- AI 분석 원본은 `SeatMap.aiRawResult`에 보관하고, 서비스에서 활용하는 구역 정보는 `SeatZone`으로 정규화했다.
- 실제 좌석 데이터가 부족한 경우에도 연습 기능을 제공하기 위해 `VirtualSeat`를 별도로 두었다.
- 리뷰는 좌석 구역 기반 리뷰와 수동 좌석 정보 입력을 모두 지원하도록 설계했다.
- 공연 정보, 리뷰, 연습 기록을 분리해 검색, 리뷰 조회, 연습 통계 기능을 독립적으로 확장할 수 있게 했다.

---

## API 문서

> API 주소, 요청 방식, 요청값, 응답값, 에러 상황을 정리

상세 API 명세는 [docs/API.md](./docs/API.md)에 정리했다. 모든 일반 사용자 API는 Supabase 세션 쿠키 기반 인증을 사용하고, 관리자 공연 동기화 API는 `CONCERT_SYNC_SECRET` 또는 `CRON_SECRET` 값을 `Authorization: Bearer ...` 또는 `x-sync-secret` 헤더로 전달한다.

성공 응답은 기본적으로 `{ "data": ... }` 형식을 사용하고, 실패 응답은 `{ "error": { "message": string, "status": number } }` 형식을 사용한다.

| Method | Endpoint | 설명 | 요청 | 응답 |
| ------ | -------- | ---- | ---- | ---- |
| GET | `/api/health` | 서버 상태 확인 | 없음 | `{ ok: true }` |
| GET | `/api/home` | 홈 화면용 추천 공연과 최신 리뷰 조회 | 없음 | `{ data: { featuredConcerts, recentReviews } }` |
| GET | `/api/concerts` | 공연 목록 조회 | Query: `scope`, `q`, `region`, `genre` | `{ data: { concerts } }` |
| GET | `/api/concerts/{concertId}` | 공연 상세 조회 | Path: `concertId` | `{ data: { concert } }` |
| GET/POST | `/api/admin/concerts/sync` | KOPIS 공연 정보 동기화 | Secret 헤더, Query 또는 JSON Body: `monthsAhead`, `rows`, `pages`, `genreCode`, `regionCode`, `keyword` | `{ data: { result } }` |
| GET/POST/PATCH | `/api/users/me` | 내 사용자/프로필 조회, 생성 보장, 수정 | 인증 필요. PATCH Body: `nickname`, `profileImageUrl` | `{ data: { user, profile } }` 또는 `{ data: { profile } }` |
| GET | `/api/users/me/reviews` | 내가 작성한 리뷰 조회 | 인증 필요 | `{ data: { reviews } }` |
| GET | `/api/users/me/practice-sessions` | 내 티켓팅 연습 기록 조회 | 인증 필요 | `{ data: { practiceSessions } }` |
| POST | `/api/seat-maps/upload` | 좌석 배치도 이미지 업로드 | 인증 필요. Form Data: `file`, `concertId`, `imageWidth`, `imageHeight` | `{ data: { seatMap } }` |
| GET/POST | `/api/seat-maps/{seatMapId}` 하위 API | 좌석 배치도 조회, AI 분석, 좌석 구역 추가, 전체 가상 좌석 생성 | 인증 필요. Path: `seatMapId`, API별 JSON Body | `{ data: { seatMap } }`, `{ data: { seatZone } }`, `{ data: { totalSeatCount, zoneCount, seatCount, allocations } }` |
| PATCH/DELETE | `/api/seat-zones/{zoneId}` | 좌석 구역 수정 또는 삭제 | 인증 필요. Path: `zoneId`, PATCH Body: `name`, `grade`, `price`, `polygon` | `{ data: { seatZone, seatCount } }` 또는 `{ data: { deleted: true } }` |
| GET/POST | `/api/seat-zones/{zoneId}/virtual-seats` | 구역별 가상 좌석 조회 또는 생성 | 인증 필요. Path: `zoneId`, POST Body: `rows`, `seatsPerRow`, `overwrite` | `{ data: { zone, virtualSeats } }` |
| GET/POST | `/api/seat-zones/{zoneId}/reviews` | 구역별 리뷰 조회 또는 작성 | 인증 필요. Path: `zoneId`, POST Form Data: 평점, `content`, `image` | `{ data: { zone, reviews, summary } }` 또는 `{ data: { review } }` |
| POST | `/api/concerts/{concertId}/reviews` | 수동 좌석 정보 기반 공연 리뷰 작성 | 인증 필요. Form Data: 좌석 정보, 평점, `content`, `images` | `{ data: { review } }` |
| POST/GET/PATCH | `/api/practice-sessions` 하위 API | 티켓팅 연습 시작, 상세 조회, 완료 처리 | 인증 필요. 시작 Body: `concertId`, `templateType`, `difficulty`, `startDelayMs`; 완료 Body: `status`, `scheduleId`, `selectedZoneId`, `selectedSeatId`, `elapsedMs`, `failReason` | `{ data: { practiceSession } }` |
| PATCH/DELETE | `/api/reviews/{reviewId}` | 리뷰 수정 또는 삭제 | 인증 필요. Path: `reviewId`, PATCH Body: 평점, `content` | `{ data: { review } }` 또는 `{ data: { deleted: true } }` |
| POST | `/api/reviews/{reviewId}/reports` | 리뷰 신고 | 인증 필요. Body: `reason`, `details` | `{ data: { report, alreadyReported } }` |

---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:**
- **실행 방법:**

```bash
git clone https://github.com/madcamp-official/26s-w1-c2-07.git
cd 26s-w1-c2-07

corepack enable
corepack prepare pnpm@10.33.0 --activate

pnpm install
cp .env.example .env

pnpm prisma:generate
pnpm dev
```

`.env` 파일에는 다음 값을 입력해야 한다.

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
KOPIS_API_KEY=
CONCERT_SYNC_SECRET=
CRON_SECRET=
```

개발 서버 실행 후 브라우저에서 접속한다.

```text
http://localhost:3000
```

배포 전 검증은 다음 명령어로 확인한다.

```bash
pnpm lint
pnpm typecheck
pnpm build
```

최신 공연 정보 동기화는 KOPIS API 키와 동기화 secret을 설정한 뒤 서버 API로 실행한다.

```bash
curl -X POST http://localhost:3000/api/admin/concerts/sync \
  -H "Authorization: Bearer $CONCERT_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"monthsAhead":6,"rows":20,"pages":1}'
```

필요한 경우 KOPIS 장르코드, 지역코드, 공연명 키워드로 동기화 범위를 좁힐 수 있다.

```bash
curl -X POST http://localhost:3000/api/admin/concerts/sync \
  -H "Authorization: Bearer $CONCERT_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"monthsAhead":6,"rows":20,"pages":1,"genreCode":"AAAA","regionCode":"11","keyword":"사랑"}'
```

사용자 공연 목록은 저장된 DB 데이터를 기준으로 검색/필터링한다.

```text
/concerts?q=뮤지컬&region=서울&genre=뮤지컬
```

운영 환경에서는 `vercel.json`의 Cron 설정이 매일 한 번 같은 API를 호출해 `Concert`와 `ConcertSchedule`을 최신화한다. 배포 환경에는 `KOPIS_API_KEY`와 `CRON_SECRET` 또는 `CONCERT_SYNC_SECRET`을 설정해야 한다.

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

- 로컬 개발 환경에서 기능을 먼저 검증한 뒤 배포 환경에서 다시 확인하는 흐름을 유지했다.
- 공연 공개 API를 활용해 공연 정보를 DB에 저장하고, 서비스 화면과 티켓팅 연습 기능에서 재사용할 수 있는 구조를 만들었다.
- 환경변수, API 문서, DB 스키마처럼 배포와 유지보수에 필요한 정보를 README와 별도 문서로 정리했다.

### Problem

- 배포 환경에서 로그인 기능에 문제가 있었다. 로컬 환경과 배포 환경의 환경변수 설정이 달라 Supabase 인증 흐름이 정상적으로 이어지지 않았다.
- 로컬에서는 화면 전환이 빠르게 느껴졌지만, 배포 환경에서는 네트워크 지연과 서버/API/DB 응답 시간이 추가되어 일부 화면 전환이 느리게 느껴졌다.
- 현재 공연 정보는 공개 API를 통해 가져오고 있다. 공개 API에서 제공하지 않는 정보까지 확보하려면 크롤링을 검토할 수 있지만, 사이트 구조 변경, 접근 제한, 법적/정책적 이슈, 데이터 정합성 문제 때문에 유지보수가 어려울 수 있다.

### Try

- 로컬 환경과 배포 환경의 환경변수 목록을 체크리스트로 관리하고, 인증 관련 값이 누락되거나 다를 때 빠르게 확인할 수 있도록 배포 전 점검 절차를 만들고 싶다.
- 배포 환경의 화면 전환 속도를 개선하기 위해 서버/API/DB 응답 시간을 측정하고, 필요한 쿼리 최적화, 정적 리소스 최적화, 캐싱, 로딩 UI 개선을 적용해보고 싶다.
- 이미 적용된 Vercel-GitHub 자동 배포 흐름을 더 잘 이해하고, Preview/Production 배포 구분과 배포 환경변수 관리 방식을 안정적으로 운영해보고 싶다.
- 공연 공개 API로 부족한 정보를 보완하기 위해 크롤링으로 공연 정보를 가져오는 것이 가능한지 조사해보고 싶다.
- 크롤링 도입 시 유지보수가 어려워지는 이유를 더 자세히 알아보고, 공개 API 사용 방식과 크롤링 방식의 장단점을 비교해보고 싶다.

---

## 참고 자료

- [SDD(스펙 주도 개발) 이해하기](https://news.hada.io/topic?id=21338)
- [Software Design Document Best Practices](https://www.atlassian.com/work-management/project-management/design-document)
- [IA 정보구조도 작성 방법](https://brunch.co.kr/@nyonyo/7)
- [기획자 화면설계서 작성법](https://brunch.co.kr/@soup/10)
- [Figma 와이어프레임 가이드](https://www.figma.com/ko-kr/resource-library/what-is-wireframing/)
- [무료 Figma 와이어프레임 키트](https://www.figma.com/ko-kr/templates/wireframe-kits/)
- [ERD/DB 설계 총정리](https://inpa.tistory.com/entry/DB-%F0%9F%93%9A-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B0%9C%EB%85%90-ERD-%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8)
- [API 명세서 작성 가이드라인](https://velog.io/@sebinChu/BackEnd-API-%EB%AA%85%EC%84%B8%EC%84%9C-%EC%9E%91%EC%84%B1-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%9D%BC%EC%9D%B8)
- [좋은 README 작성하는 방법](https://velog.io/@sabo/good-readme)
- [단기 프로젝트 회고 KPT 방법론](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)
