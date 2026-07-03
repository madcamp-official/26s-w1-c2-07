import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { ensureProfile, getCurrentUser } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validators";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const profile = await ensureProfile(user);

  return apiData({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  });
}

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const profile = await ensureProfile(user);

  return apiData({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("프로필 입력값이 올바르지 않습니다.", 422);
  }

  await ensureProfile(user);

  const profile = await prisma.profile.update({
    where: {
      id: user.id,
    },
    data: parsed.data,
  });

  return apiData({
    profile,
  });
}

