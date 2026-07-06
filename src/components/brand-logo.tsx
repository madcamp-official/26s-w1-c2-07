import Link from "next/link";
import { Music2 } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 text-primary transition hover:text-primary/85",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
        <Music2 className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-base font-black tracking-normal">
          Ticketing
        </span>
        <span className="block text-base font-black tracking-normal">
          Practice
        </span>
      </span>
    </Link>
  );
}
