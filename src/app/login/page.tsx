import Image from "next/image";
import { redirect } from "next/navigation";
import { BarChart3, Crosshair, Zap } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { getCurrentUser } from "@/lib/auth";
import loginHeroImage from "../../../login-hero.png";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
  }>;
};

function getSafeRedirectPath(redirectPath: string | undefined) {
  return redirectPath?.startsWith("/") && !redirectPath.startsWith("//")
    ? redirectPath
    : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectPath } = await searchParams;
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const user = await getCurrentUser();

  if (user) {
    redirect(safeRedirectPath);
  }

  return (
    <main className="grid min-h-[calc(100vh-81px)] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center bg-[#f7f5fc] px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-sm font-bold text-primary">Ticketing Practice</p>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-normal sm:text-4xl">
            연습이 실전이 되는
            <span className="block text-primary">티켓팅 연습 플랫폼</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
            실제 예매 환경을 반영한 연습으로 원하는 좌석을 더 빠르고 정확하게
            선택해보세요.
          </p>

          <div className="relative mt-7 hidden aspect-[726/410] w-full max-w-lg overflow-hidden sm:block">
            <Image
              src={loginHeroImage}
              alt="티켓팅 연습 로그인 일러스트"
              fill
              priority
              sizes="(min-width: 1024px) 520px, (min-width: 640px) 520px, 100vw"
              className="object-contain"
            />
          </div>

          <div className="mt-6 grid gap-3">
            {[
              {
                icon: <Crosshair className="h-5 w-5" aria-hidden="true" />,
                title: "실제와 같은 환경",
                description: "예매 사이트 흐름과 좌석 선택 과정을 연습합니다.",
              },
              {
                icon: <Zap className="h-5 w-5" aria-hidden="true" />,
                title: "빠른 연습",
                description: "반복 연습을 통해 선택 속도와 판단을 높입니다.",
              },
              {
                icon: <BarChart3 className="h-5 w-5" aria-hidden="true" />,
                title: "상세한 기록",
                description: "연습 결과와 리뷰를 모아 활동을 확인합니다.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                  {item.icon}
                </span>
                <span>
                  <span className="block font-black">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
          <h2 className="text-2xl font-black">로그인</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            계정에 로그인하여 티켓팅 연습과 좌석 리뷰 기록을 이어가세요.
          </p>
          <div className="mt-5">
            <LoginForm redirectPath={safeRedirectPath} />
          </div>
        </div>
      </section>
    </main>
  );
}
