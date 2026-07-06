import { Buffer } from "node:buffer";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import {
  getReviewImageStoragePath,
  isAllowedReviewImageMimeType,
  REVIEW_IMAGE_BUCKET,
  REVIEW_IMAGE_MAX_FILE_COUNT,
  REVIEW_IMAGE_MAX_FILE_SIZE,
} from "@/lib/review-image-upload";
import { formatFileSize } from "@/lib/seat-map-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewManualCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const concertParamsSchema = z.object({
  concertId: z.string().uuid(),
});

type ConcertReviewsRouteContext = {
  params: Promise<{
    concertId: string;
  }>;
};

type ReviewImageFilesResult =
  | {
      files: File[];
    }
  | {
      error: string;
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

function getReviewImageFiles(formData: FormData): ReviewImageFilesResult {
  const imageFields = formData.getAll("images");
  const legacyImageField = formData.get("image");
  const fields =
    imageFields.length > 0
      ? imageFields
      : legacyImageField === null
        ? []
        : [legacyImageField];
  const imageFiles: File[] = [];

  for (const field of fields) {
    if (field instanceof File && field.size > 0) {
      imageFiles.push(field);
    } else if (field !== null && !(field instanceof File)) {
      return {
        error: "리뷰 이미지는 파일 형식으로 업로드해주세요.",
      };
    }
  }

  if (imageFiles.length > REVIEW_IMAGE_MAX_FILE_COUNT) {
    return {
      error: `리뷰 이미지는 최대 ${REVIEW_IMAGE_MAX_FILE_COUNT}장까지 업로드할 수 있습니다.`,
    };
  }

  for (const imageFile of imageFiles) {
    if (!isAllowedReviewImageMimeType(imageFile.type)) {
      return {
        error: "PNG, JPG, JPEG 이미지만 업로드할 수 있습니다.",
      };
    }

    if (imageFile.size > REVIEW_IMAGE_MAX_FILE_SIZE) {
      return {
        error: `리뷰 이미지는 ${formatFileSize(REVIEW_IMAGE_MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`,
      };
    }
  }

  return {
    files: imageFiles,
  };
}

export async function POST(
  request: Request,
  { params }: ConcertReviewsRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = concertParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("공연 ID가 올바르지 않습니다.", 400);
  }

  const concert = await prisma.concert.findFirst({
    where: {
      id: parsedParams.data.concertId,
      isVisible: true,
      seatMaps: {
        some: {
          createdBy: auth.user.id,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!concert) {
    return apiError("리뷰를 작성할 공연을 찾을 수 없습니다.", 404);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return apiError("리뷰 작성 요청 형식이 올바르지 않습니다.", 400);
  }

  const parsedBody = reviewManualCreateSchema.safeParse({
    seatFloor: formData.get("seatFloor"),
    seatSection: formData.get("seatSection"),
    seatRow: formData.get("seatRow"),
    seatNumber: formData.get("seatNumber"),
    viewScore: formData.get("viewScore"),
    soundScore: formData.get("soundScore"),
    distanceScore: formData.get("distanceScore"),
    satisfactionScore: formData.get("satisfactionScore"),
    content: formData.get("content"),
  });

  if (!parsedBody.success) {
    return apiError(
      parsedBody.error.issues[0]?.message ??
        "리뷰 작성 입력값이 올바르지 않습니다.",
      422,
    );
  }

  const imageFilesResult = getReviewImageFiles(formData);

  if ("error" in imageFilesResult) {
    return apiError(imageFilesResult.error, 422);
  }

  const imageFiles = imageFilesResult.files;
  const uploadedImages: Array<{
    path: string;
    url: string;
  }> = [];
  const storageClient = imageFiles.length > 0 ? await getStorageClient() : null;

  if (imageFiles.length > 0) {
    if (!storageClient) {
      return apiError("Supabase Storage 설정이 필요합니다.", 500);
    }

    const bucketError = await ensureReviewImageBucket(storageClient);

    if (bucketError) {
      return apiError(`Storage bucket 준비에 실패했습니다: ${bucketError}`, 500);
    }

    for (const imageFile of imageFiles) {
      const uploadedImagePath = getReviewImageStoragePath({
        concertId: concert.id,
        zoneId: "manual",
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
        if (uploadedImages.length > 0) {
          await storageClient.client.storage
            .from(REVIEW_IMAGE_BUCKET)
            .remove(uploadedImages.map((image) => image.path));
        }

        return apiError(`리뷰 이미지 업로드에 실패했습니다: ${uploadError.message}`, 500);
      }

      const {
        data: { publicUrl },
      } = storageClient.client.storage
        .from(REVIEW_IMAGE_BUCKET)
        .getPublicUrl(uploadedImagePath);

      uploadedImages.push({
        path: uploadedImagePath,
        url: publicUrl,
      });
    }
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId: auth.user.id,
        concertId: concert.id,
        seatFloor: parsedBody.data.seatFloor,
        seatSection: parsedBody.data.seatSection,
        seatRow: parsedBody.data.seatRow,
        seatNumber: parsedBody.data.seatNumber,
        viewScore: parsedBody.data.viewScore,
        soundScore: parsedBody.data.soundScore,
        distanceScore: parsedBody.data.distanceScore,
        satisfactionScore: parsedBody.data.satisfactionScore,
        content: parsedBody.data.content,
        imageUrl: uploadedImages[0]?.url ?? null,
        imageUrls: uploadedImages.map((image) => image.url),
      },
    });

    return apiData(
      {
        review,
      },
      { status: 201 },
    );
  } catch (error) {
    if (storageClient && uploadedImages.length > 0) {
      await storageClient.client.storage
        .from(REVIEW_IMAGE_BUCKET)
        .remove(uploadedImages.map((image) => image.path));
    }

    return apiError(
      error instanceof Error
        ? `리뷰 저장에 실패했습니다: ${error.message}`
        : "리뷰 저장에 실패했습니다.",
      500,
    );
  }
}
