import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
  }>;
};

function getSafeRedirectPath(redirectPath: string | undefined) {
  return redirectPath?.startsWith("/") && !redirectPath.startsWith("//")
    ? redirectPath
    : "/my";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectPath } = await searchParams;
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const user = await getCurrentUser();

  if (user) {
    redirect(safeRedirectPath);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center px-6 py-10">
      <section className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          좌석 배치도 업로드, 좌석 리뷰 작성, 티켓팅 연습 기록 저장에 사용할
          계정입니다.
        </p>
        <div className="mt-6">
          <LoginForm redirectPath={safeRedirectPath} />
        </div>
      </section>
    </main>
  );
}
