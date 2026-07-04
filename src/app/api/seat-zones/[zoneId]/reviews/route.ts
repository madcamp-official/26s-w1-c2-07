import { Buffer } from "node:buffer";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import {
  getReviewImageStoragePath,
  isAllowedReviewImageMimeType,
  REVIEW_IMAGE_BUCKET,
  REVIEW_IMAGE_MAX_FILE_SIZE,
} from "@/lib/review-image-upload";
import { formatFileSize } from "@/lib/seat-map-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const seatZoneParamsSchema = z.object({
  zoneId: z.string().uuid(),
});

type SeatZoneReviewsRouteContext = {
  params: Promise<{
    zoneId: string;
  }>;
};

async function getStorageClient() {
  const admin = createSupabaseAdminClient();

  if (admin) {
    return {
      client: admin,
      canManageBuckets: true,
    };
  }

  const server = await createSupabaseServerClient();

  if (!server) {
    return null;
  }

  return {
    client: server,
    canManageBuckets: false,
  };
}

async function ensureReviewImageBucket(
  storageClient: Awaited<ReturnType<typeof getStorageClient>>,
) {
  if (!storageClient?.canManageBuckets) {
    return null;
  }

  const { error: getBucketError } =
    await storageClient.client.storage.getBucket(REVIEW_IMAGE_BUCKET);

  if (!getBucketError) {
    return null;
  }

  const { error: createBucketError } =
    await storageClient.client.storage.createBucket(REVIEW_IMAGE_BUCKET, {
      public: true,
      allowedMimeTypes: ["image/png", "image/jpeg"],
      fileSizeLimit: REVIEW_IMAGE_MAX_FILE_SIZE,
    });

  if (createBucketError) {
    return createBucketError.message;
  }

  return null;
}

async function getSeatZoneForReview(zoneId: string) {
  return prisma.seatZone.findUnique({
    where: {
      id: zoneId,
    },
    select: {
      id: true,
      name: true,
      grade: true,
      price: true,
      seatMap: {
        select: {
          concertId: true,
          concert: {
            select: {
              id: true,
              title: true,
              venueName: true,
            },
          },
        },
      },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: SeatZoneReviewsRouteContext,
) {
  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const seatZone = await getSeatZoneForReview(parsedParams.data.zoneId);

  if (!seatZone) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  const [reviews, summary] = await Promise.all([
    prisma.review.findMany({
      where: {
        zoneId: seatZone.id,
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
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.review.aggregate({
      where: {
        zoneId: seatZone.id,
      },
      _count: {
        _all: true,
      },
      _avg: {
        viewScore: true,
        soundScore: true,
        distanceScore: true,
        satisfactionScore: true,
      },
    }),
  ]);

  return apiData({
    zone: {
      id: seatZone.id,
      name: seatZone.name,
      grade: seatZone.grade,
      price: seatZone.price,
      concert: seatZone.seatMap.concert,
    },
    reviews,
    summary: {
      count: summary._count._all,
      averageViewScore: summary._avg.viewScore,
      averageSoundScore: summary._avg.soundScore,
      averageDistanceScore: summary._avg.distanceScore,
      averageSatisfactionScore: summary._avg.satisfactionScore,
    },
  });
}

export async function POST(
  request: Request,
  { params }: SeatZoneReviewsRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return apiError("리뷰 작성 요청 형식이 올바르지 않습니다.", 400);
  }

  const parsedBody = reviewCreateSchema.safeParse({
    viewScore: formData.get("viewScore"),
    soundScore: formData.get("soundScore"),
    distanceScore: formData.get("distanceScore"),
    satisfactionScore: formData.get("satisfactionScore"),
    content: formData.get("content"),
  });

  if (!parsedBody.success) {
    return apiError("리뷰 작성 입력값이 올바르지 않습니다.", 422);
  }

  const imageField = formData.get("image");
  let imageFile: File | null = null;

  if (imageField instanceof File && imageField.size > 0) {
    imageFile = imageField;
  } else if (imageField !== null && !(imageField instanceof File)) {
    return apiError("리뷰 이미지는 파일 형식으로 업로드해주세요.", 422);
  }

  if (imageFile && !isAllowedReviewImageMimeType(imageFile.type)) {
    return apiError("PNG, JPG, JPEG 이미지만 업로드할 수 있습니다.", 422);
  }

  if (imageFile && imageFile.size > REVIEW_IMAGE_MAX_FILE_SIZE) {
    return apiError(
      `리뷰 이미지는 ${formatFileSize(REVIEW_IMAGE_MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`,
      422,
    );
  }

  const seatZone = await getSeatZoneForReview(parsedParams.data.zoneId);

  if (!seatZone) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  let uploadedImagePath: string | null = null;
  let uploadedImageUrl: string | null = null;
  const storageClient = imageFile ? await getStorageClient() : null;

  if (imageFile) {
    if (!storageClient) {
      return apiError("Supabase Storage 설정이 필요합니다.", 500);
    }

    const bucketError = await ensureReviewImageBucket(storageClient);

    if (bucketError) {
      return apiError(`Storage bucket 준비에 실패했습니다: ${bucketError}`, 500);
    }

    uploadedImagePath = getReviewImageStoragePath({
      concertId: seatZone.seatMap.concertId,
      zoneId: seatZone.id,
      userId: auth.user.id,
      fileName: imageFile.name,
    });

    const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
    const { error: uploadError } = await storageClient.client.storage
      .from(REVIEW_IMAGE_BUCKET)
      .upload(uploadedImagePath, fileBuffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      if (uploadError.message.toLowerCase().includes("bucket not found")) {
        return apiError(
          `${REVIEW_IMAGE_BUCKET} Storage bucket이 없습니다. Supabase Dashboard에서 bucket을 만들거나 SUPABASE_SECRET_KEY를 설정한 뒤 다시 시도해주세요.`,
          500,
        );
      }

      return apiError(`리뷰 이미지 업로드에 실패했습니다: ${uploadError.message}`, 500);
    }

    const {
      data: { publicUrl },
    } = storageClient.client.storage
      .from(REVIEW_IMAGE_BUCKET)
      .getPublicUrl(uploadedImagePath);

    uploadedImageUrl = publicUrl;
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId: auth.user.id,
        concertId: seatZone.seatMap.concertId,
        zoneId: seatZone.id,
        viewScore: parsedBody.data.viewScore,
        soundScore: parsedBody.data.soundScore,
        distanceScore: parsedBody.data.distanceScore,
        satisfactionScore: parsedBody.data.satisfactionScore,
        content: parsedBody.data.content,
        imageUrl: uploadedImageUrl,
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

    return apiData(
      {
        review,
      },
      { status: 201 },
    );
  } catch (error) {
    if (storageClient && uploadedImagePath) {
      await storageClient.client.storage
        .from(REVIEW_IMAGE_BUCKET)
        .remove([uploadedImagePath]);
    }

    return apiError(
      error instanceof Error
        ? `리뷰 저장에 실패했습니다: ${error.message}`
        : "리뷰 저장에 실패했습니다.",
      500,
    );
  }
}
