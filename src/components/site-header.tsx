import { AuthMenu } from "@/components/auth/auth-menu";
import { BrandLogo } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <BrandLogo className="shrink-0" />
        <SiteNav />

        <div className="flex shrink-0 items-center gap-2">
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
