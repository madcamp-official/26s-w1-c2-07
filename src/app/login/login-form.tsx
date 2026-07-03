"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";

type AuthMode = "login" | "signup";

type LoginFormProps = {
  redirectPath: string;
};

export function LoginForm({ redirectPath }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const isConfigured = hasSupabaseBrowserConfig();

  const supabase = useMemo(() => {
    if (!isConfigured) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, [isConfigured]);

  async function ensureProfile() {
    const response = await fetch("/api/users/me", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("프로필 생성에 실패했습니다.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase 환경변수를 먼저 설정해야 합니다.");
      return;
    }

    setIsPending(true);
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          throw error;
        }

        await ensureProfile();
        router.push(redirectPath);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            nickname,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        await ensureProfile();
        router.push(redirectPath);
        router.refresh();
        return;
      }

      setMessage("가입 확인 메일을 보냈습니다. 메일 확인 후 로그인해주세요.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "인증 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 rounded-md border bg-secondary p-1">
        <button
          type="button"
          className={`rounded-sm px-3 py-2 text-sm font-medium ${
            mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setMode("login")}
        >
          로그인
        </button>
        <button
          type="button"
          className={`rounded-sm px-3 py-2 text-sm font-medium ${
            mode === "signup"
              ? "bg-background shadow-sm"
              : "text-muted-foreground"
          }`}
          onClick={() => setMode("signup")}
        >
          회원가입
        </button>
      </div>

      {mode === "signup" ? (
        <label className="block space-y-2 text-sm font-medium">
          닉네임
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="좌석 리뷰에 표시될 이름"
            required
          />
        </label>
      ) : null}

      <label className="block space-y-2 text-sm font-medium">
        이메일
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          required
        />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        비밀번호
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          placeholder="6자 이상"
          required
        />
      </label>

      {message ? (
        <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {mode === "login" ? "로그인" : "회원가입"}
      </Button>
    </form>
  );
}
