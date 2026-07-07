import { Prisma } from "@prisma/client";
import { z } from "zod";

import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewReportCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const reviewParamsSchema = z.object({
  reviewId: z.string().uuid(),
});

type ReviewReportRouteContext = {
  params: Promise<{
    reviewId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ReviewReportRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = reviewParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("리뷰 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = reviewReportCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("신고 입력값이 올바르지 않습니다.", 422);
  }

  const review = await prisma.review.findFirst({
    where: {
      id: parsedParams.data.reviewId,
      concert: {
        isVisible: true,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!review) {
    return apiError("리뷰를 찾을 수 없습니다.", 404);
  }

  if (review.userId === auth.user.id) {
    return apiError("본인이 작성한 리뷰는 신고할 수 없습니다.", 400);
  }

  const existingReport = await prisma.reviewReport.findUnique({
    where: {
      reviewId_reporterId: {
        reviewId: review.id,
        reporterId: auth.user.id,
      },
    },
  });

  if (existingReport) {
    return apiData({
      report: existingReport,
      alreadyReported: true,
    });
  }

  try {
    const report = await prisma.reviewReport.create({
      data: {
        reviewId: review.id,
        reporterId: auth.user.id,
        reason: parsedBody.data.reason,
        details: parsedBody.data.details,
      },
    });

    return apiData(
      {
        report,
        alreadyReported: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiData({
        report: null,
        alreadyReported: true,
      });
    }

    throw error;
  }
}
