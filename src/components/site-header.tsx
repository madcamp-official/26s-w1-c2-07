import Link from "next/link";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUserWithProfile } from "@/lib/auth";

export async function SiteHeader() {
  const auth = await getCurrentUserWithProfile();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="space-y-1">
          <p className="text-xs text-muted-foreground">26s-w1-c2-07</p>
          <p className="text-lg font-semibold">콘서트 티켓팅 연습 플랫폼</p>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">홈</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/concerts">공연 목록</Link>
          </Button>
          {auth ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/my">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  {auth.profile.nickname ?? "마이페이지"}
                </Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
