import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserWithProfile } from "@/lib/auth";

export default async function MyPage() {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    redirect("/login?redirect=/my");
  }

  const [reviews, practiceSessions] = await Promise.all([
    prisma.review.findMany({
      where: {
        userId: auth.user.id,
      },
      include: {
        concert: {
          select: {
            title: true,
            venueName: true,
          },
        },
        zone: {
          select: {
            name: true,
            grade: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
    prisma.practiceSession.findMany({
      where: {
        userId: auth.user.id,
      },
      include: {
        concert: {
          select: {
            title: true,
            venueName: true,
          },
        },
        selectedZone: {
          select: {
            name: true,
            grade: true,
          },
        },
        selectedSeat: {
          select: {
            rowLabel: true,
            seatNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">마이페이지</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {auth.profile.nickname ?? auth.user.email}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{auth.user.email}</p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">내 좌석 리뷰</h2>
          {reviews.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-md border p-4">
                  <p className="font-medium">{review.concert.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {review.zone.name} · {review.zone.grade} · 만족도{" "}
                    {review.satisfactionScore}/5
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">{review.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border bg-secondary px-4 py-6 text-sm text-muted-foreground">
              아직 작성한 좌석 리뷰가 없습니다.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">내 티켓팅 연습 기록</h2>
          {practiceSessions.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {practiceSessions.map((session) => (
                <li key={session.id} className="rounded-md border p-4">
                  <p className="font-medium">{session.concert.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {session.status} · {session.elapsedMs / 1000}초 ·{" "}
                    시작 반응 {((session.startDelayMs ?? 0) / 1000).toFixed(1)}초 ·{" "}
                    {session.selectedZone?.name ?? "좌석 미선택"}
                    {session.selectedSeat
                      ? ` ${session.selectedSeat.rowLabel}열 ${session.selectedSeat.seatNumber}번`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border bg-secondary px-4 py-6 text-sm text-muted-foreground">
              아직 저장된 티켓팅 연습 기록이 없습니다.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
