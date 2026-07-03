import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatFileSize,
  getSafeStorageFileName,
  isAllowedSeatMapMimeType,
  SEAT_MAP_BUCKET,
  SEAT_MAP_MAX_FILE_SIZE,
} from "@/lib/seat-map-upload";
import { seatMapUploadSchema } from "@/lib/validators";

export const runtime = "nodejs";

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

async function ensureSeatMapBucket(
  storageClient: Awaited<ReturnType<typeof getStorageClient>>,
) {
  if (!storageClient?.canManageBuckets) {
    return null;
  }

  const { error: getBucketError } =
    await storageClient.client.storage.getBucket(SEAT_MAP_BUCKET);

  if (!getBucketError) {
    return null;
  }

  const { error: createBucketError } =
    await storageClient.client.storage.createBucket(SEAT_MAP_BUCKET, {
      public: true,
    });

  if (createBucketError) {
    return createBucketError.message;
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return apiError("업로드 요청 형식이 올바르지 않습니다.", 400);
  }

  const file = formData.get("file");
  const parsed = seatMapUploadSchema.safeParse({
    concertId: formData.get("concertId"),
    imageWidth: formData.get("imageWidth") || undefined,
    imageHeight: formData.get("imageHeight") || undefined,
  });

  if (!parsed.success) {
    return apiError("좌석 배치도 업로드 입력값이 올바르지 않습니다.", 422);
  }

  if (!(file instanceof File)) {
    return apiError("업로드할 이미지 파일을 선택해주세요.", 422);
  }

  if (!isAllowedSeatMapMimeType(file.type)) {
    return apiError("PNG, JPG, JPEG 이미지만 업로드할 수 있습니다.", 422);
  }

  if (file.size > SEAT_MAP_MAX_FILE_SIZE) {
    return apiError(
      `좌석 배치도 이미지는 ${formatFileSize(SEAT_MAP_MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`,
      422,
    );
  }

  const concert = await prisma.concert.findUnique({
    where: {
      id: parsed.data.concertId,
    },
    select: {
      id: true,
    },
  });

  if (!concert) {
    return apiError("공연을 찾을 수 없습니다.", 404);
  }

  const storageClient = await getStorageClient();

  if (!storageClient) {
    return apiError("Supabase Storage 설정이 필요합니다.", 500);
  }

  const bucketError = await ensureSeatMapBucket(storageClient);

  if (bucketError) {
    return apiError(`Storage bucket 준비에 실패했습니다: ${bucketError}`, 500);
  }

  const safeFileName = getSafeStorageFileName(file.name);
  const storagePath = [
    parsed.data.concertId,
    auth.user.id,
    `${Date.now()}-${randomUUID()}-${safeFileName}`,
  ].join("/");

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await storageClient.client.storage
    .from(SEAT_MAP_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes("bucket not found")) {
      return apiError(
        `${SEAT_MAP_BUCKET} Storage bucket이 없습니다. Supabase Dashboard에서 bucket을 만들거나 SUPABASE_SECRET_KEY를 설정한 뒤 다시 시도해주세요.`,
        500,
      );
    }

    return apiError(`좌석 배치도 업로드에 실패했습니다: ${uploadError.message}`, 500);
  }

  const {
    data: { publicUrl },
  } = storageClient.client.storage.from(SEAT_MAP_BUCKET).getPublicUrl(storagePath);

  try {
    const seatMap = await prisma.seatMap.create({
      data: {
        concertId: parsed.data.concertId,
        imageUrl: publicUrl,
        imageWidth: parsed.data.imageWidth,
        imageHeight: parsed.data.imageHeight,
        analysisStatus: "pending",
        createdBy: auth.user.id,
      },
    });

    return apiData(
      {
        seatMap,
      },
      { status: 201 },
    );
  } catch (error) {
    await storageClient.client.storage.from(SEAT_MAP_BUCKET).remove([storagePath]);

    return apiError(
      error instanceof Error
        ? `좌석 배치도 저장에 실패했습니다: ${error.message}`
        : "좌석 배치도 저장에 실패했습니다.",
      500,
    );
  }
}
