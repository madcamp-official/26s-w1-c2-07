"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";

type AuthMenuProfile = {
  nickname: string | null;
  profileImageUrl: string | null;
};

type UserMeResponse = {
  data?: {
    profile?: AuthMenuProfile;
  };
};

export function AuthMenu() {
  const router = useRouter();
  const isConfigured = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => {
    if (!isConfigured) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, [isConfigured]);
  const [profile, setProfile] = useState<AuthMenuProfile | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let isActive = true;

    async function loadProfile() {
      const {
        data: { session },
      } = await client.auth.getSession();

      if (!isActive) {
        return;
      }

      setHasSession(Boolean(session));

      if (!session) {
        setProfile(null);
        return;
      }

      const response = await fetch("/api/users/me", {
        cache: "no-store",
      });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setProfile(null);
        return;
      }

      const payload = (await response.json()) as UserMeResponse;
      setProfile(payload.data?.profile ?? null);
    }

    void loadProfile();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      setHasSession(Boolean(session));

      if (!session) {
        setProfile(null);
        return;
      }

      void loadProfile();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setHasSession(false);
    setProfile(null);
    router.push("/");
    router.refresh();
  }

  if (!hasSession) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">로그인</Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href="/my">
          {profile?.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profileImageUrl}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <UserRound className="h-4 w-4" aria-hidden="true" />
          )}
          {profile?.nickname ?? "마이페이지"}
          <ChevronDown
            className="hidden h-3.5 w-3.5 sm:block"
            aria-hidden="true"
          />
        </Link>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        로그아웃
      </Button>
    </>
  );
}
