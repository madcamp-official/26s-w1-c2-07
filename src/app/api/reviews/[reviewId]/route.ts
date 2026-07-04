import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  getReviewImageStoragePathFromPublicUrl,
  REVIEW_IMAGE_BUCKET,
} from "@/lib/review-image-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const reviewParamsSchema = z.object({
  reviewId: z.string().uuid(),
});

type ReviewRouteContext = {
  params: Promise<{
    reviewId: string;
  }>;
};

async function getStorageClient() {
  const admin = createSupabaseAdminClient();

  if (admin) {
    return admin;
  }

  return createSupabaseServerClient();
}

async function removeReviewImage(imageUrl: string | null) {
  if (!imageUrl) {
    return;
  }

  const storagePath = getReviewImageStoragePathFromPublicUrl(imageUrl);

  if (!storagePath) {
    return;
  }

  const storageClient = await getStorageClient();

  if (!storageClient) {
    return;
  }

  await storageClient.storage.from(REVIEW_IMAGE_BUCKET).remove([storagePath]);
}

async function getReviewForMutation(reviewId: string) {
  return prisma.review.findUnique({
    where: {
      id: reviewId,
    },
    select: {
      id: true,
      userId: true,
      imageUrl: true,
    },
  });
}

export async function PATCH(request: Request, { params }: ReviewRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = reviewParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("리뷰 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = reviewUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("리뷰 수정 입력값이 올바르지 않습니다.", 422);
  }

  const review = await getReviewForMutation(parsedParams.data.reviewId);

  if (!review) {
    return apiError("리뷰를 찾을 수 없습니다.", 404);
  }

  if (review.userId !== user.id) {
    return apiError("리뷰를 수정할 권한이 없습니다.", 403);
  }

  const updatedReview = await prisma.review.update({
    where: {
      id: review.id,
    },
    data: {
      viewScore: parsedBody.data.viewScore,
      soundScore: parsedBody.data.soundScore,
      distanceScore: parsedBody.data.distanceScore,
      satisfactionScore: parsedBody.data.satisfactionScore,
      content: parsedBody.data.content,
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return apiData({
    review: updatedReview,
  });
}

export async function DELETE(
  _request: Request,
  { params }: ReviewRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = reviewParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("리뷰 ID가 올바르지 않습니다.", 400);
  }

  const review = await getReviewForMutation(parsedParams.data.reviewId);

  if (!review) {
    return apiError("리뷰를 찾을 수 없습니다.", 404);
  }

  if (review.userId !== user.id) {
    return apiError("리뷰를 삭제할 권한이 없습니다.", 403);
  }

  await prisma.review.delete({
    where: {
      id: review.id,
    },
  });
  await removeReviewImage(review.imageUrl);

  return apiData({
    deleted: true,
  });
}
