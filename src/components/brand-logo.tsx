import Link from "next/link";
import { Grape } from "lucide-react";

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
        <Grape className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-lg font-black tracking-normal">
          포도알연구소
        </span>
      </span>
    </Link>
  );
}
