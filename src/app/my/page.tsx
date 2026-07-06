import { redirect } from "next/navigation";

import { MyPageClient } from "@/app/my/my-page-client";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
            id: true,
            title: true,
            venueName: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.practiceSession.findMany({
      where: {
        userId: auth.user.id,
      },
      include: {
        concert: {
          select: {
            id: true,
            title: true,
            venueName: true,
          },
        },
        schedule: {
          select: {
            id: true,
            performanceDate: true,
            roundName: true,
            startTime: true,
          },
        },
        selectedZone: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        selectedSeat: {
          select: {
            id: true,
            rowLabel: true,
            seatNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return (
    <MyPageClient
      initialUser={{
        id: auth.user.id,
        email: auth.user.email ?? "",
      }}
      initialProfile={{
        id: auth.profile.id,
        nickname: auth.profile.nickname,
        profileImageUrl: auth.profile.profileImageUrl,
      }}
      initialReviews={reviews.map((review) => ({
        id: review.id,
        concert: review.concert,
        zone: review.zone,
        seatFloor: review.seatFloor,
        seatSection: review.seatSection,
        seatRow: review.seatRow,
        seatNumber: review.seatNumber,
        viewScore: review.viewScore,
        soundScore: review.soundScore,
        distanceScore: review.distanceScore,
        satisfactionScore: review.satisfactionScore,
        content: review.content,
        imageUrl: review.imageUrl,
        imageUrls: review.imageUrls,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      }))}
      initialPracticeSessions={practiceSessions.map((session) => ({
        id: session.id,
        concert: session.concert,
        schedule: session.schedule
          ? {
              id: session.schedule.id,
              performanceDate: session.schedule.performanceDate.toISOString(),
              roundName: session.schedule.roundName,
              startTime: session.schedule.startTime,
            }
          : null,
        templateType: session.templateType,
        difficulty: session.difficulty,
        status: session.status,
        selectedZone: session.selectedZone,
        selectedSeat: session.selectedSeat,
        elapsedMs: session.elapsedMs,
        startDelayMs: session.startDelayMs,
        failReason: session.failReason,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
      }))}
    />
  );
}
