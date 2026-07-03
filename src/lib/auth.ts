import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getNicknameFromUser(user: User) {
  const metadataNickname = user.user_metadata?.nickname;

  if (typeof metadataNickname === "string" && metadataNickname.trim()) {
    return metadataNickname.trim();
  }

  return user.email?.split("@")[0] ?? "사용자";
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function ensureProfile(user: User) {
  return prisma.profile.upsert({
    where: {
      id: user.id,
    },
    update: {},
    create: {
      id: user.id,
      nickname: getNicknameFromUser(user),
    },
  });
}

export async function getCurrentUserWithProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const profile = await ensureProfile(user);

  return {
    user,
    profile,
  };
}

