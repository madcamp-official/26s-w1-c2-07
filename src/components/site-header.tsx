import Link from "next/link";
import { Bell, ChevronDown, UserRound } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUserWithProfile } from "@/lib/auth";

export async function SiteHeader() {
  const auth = await getCurrentUserWithProfile();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <BrandLogo className="shrink-0" />
        <SiteNav />

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="알림"
            className="hidden rounded-full text-muted-foreground sm:inline-flex"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>
          {auth ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/my">
                  {auth.profile.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={auth.profile.profileImageUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  {auth.profile.nickname ?? "마이페이지"}
                  <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
                </Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
