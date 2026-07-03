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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-sm text-muted-foreground">26s-w1-c2-07</p>
          <h1 className="text-2xl font-semibold tracking-normal">
            콘서트 티켓팅 연습 플랫폼
          </h1>
        </div>
        <nav className="flex gap-2">
          <Button variant="outline">공연 목록</Button>
          <Button>티켓팅 연습</Button>
        </nav>
      </header>

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
