import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { HomeDynamicSections } from "@/components/home/home-dynamic-sections";
import { Button } from "@/components/ui/button";
import homeBannerImage from "../../home-banner-homeblend.png";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 sm:px-8">
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid min-h-[330px] gap-8 p-8 lg:grid-cols-[1fr_0.92fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              실전형 티켓팅 연습
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight tracking-normal text-foreground sm:text-5xl">
              실전처럼 연습하고,
              <span className="block text-primary">좋은 좌석을 잡아보세요!</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              공연을 고르고 좌석 배치도를 분석한 뒤, 예매 흐름과 좌석 선택을
              반복해서 연습할 수 있습니다.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/concerts">
                  공연 둘러보기
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/concerts">티켓팅 연습 시작</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[240px] lg:min-h-[280px]">
            <Image
              src={homeBannerImage}
              alt="티켓팅 연습 홈 배너"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 100vw"
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <HomeDynamicSections />
    </main>
  );
}
