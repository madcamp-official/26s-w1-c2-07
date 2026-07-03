import Link from "next/link";

import { Button } from "@/components/ui/button";

const coreFeatures = [
  "공연 정보 조회",
  "좌석 배치도 업로드 및 AI 분석",
  "티켓팅 사이트별 연습",
  "좌석 구역 리뷰",
  "로그인 및 마이페이지",
];

const stack = [
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
  "Prisma",
  "Supabase",
  "OpenAI",
  "React-Konva",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl flex-col gap-10 px-6 py-8">
      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">MVP 개발 환경</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Next.js 기반 풀스택 구조에 Prisma 중심 DB 접근, Supabase Auth/Storage,
            OpenAI 이미지 분석, React-Konva 좌석 배치도 렌더링을 연결할 수 있도록
            기본 레포 설정을 구성했습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {stack.map((item) => (
              <span
                key={item}
                className="rounded-md border bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/concerts">공연 목록 보기</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/my">마이페이지 확인</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">핵심 기능</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {coreFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
