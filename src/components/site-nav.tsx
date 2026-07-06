"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "홈",
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/concerts",
    label: "공연",
    isActive: (pathname: string) =>
      pathname.startsWith("/concerts") &&
      !pathname.includes("/practice") &&
      !pathname.includes("/reviews"),
  },
  {
    href: "/practice",
    label: "티켓팅 연습",
    isActive: (pathname: string) =>
      pathname === "/practice" ||
      pathname.startsWith("/practice/") ||
      pathname.includes("/practice"),
  },
  {
    href: "/reviews",
    label: "좌석 리뷰",
    isActive: (pathname: string) =>
      pathname === "/reviews" ||
      pathname.startsWith("/reviews/") ||
      pathname.includes("/reviews"),
  },
  {
    href: "/my",
    label: "마이페이지",
    isActive: (pathname: string) => pathname.startsWith("/my"),
  },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-8 md:flex" aria-label="주요 메뉴">
      {navItems.map((item) => {
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "relative py-7 text-sm font-semibold text-foreground/80 transition hover:text-primary",
              active && "text-primary",
            )}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
