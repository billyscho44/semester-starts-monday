"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "create";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    if (password.length < 10) {
      setError("Use at least 10 characters.");
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("database error")
          ? "That email is not allowed to create an account."
          : error.message,
      );
      setBusy(false);
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }
    setNotice(
      "Account created. Check your email to confirm it, then sign in here.",
    );
    setMode("signin");
    setBusy(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)]">
      <p className="text-sm font-medium tracking-wide text-muted">
        Semester Starts Monday
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-card px-4 text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-card px-4 text-ink outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-muted">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-60"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "create" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="mt-6 min-h-11 self-start text-sm text-muted underline underline-offset-4"
      >
        {mode === "signin"
          ? "First time? Create your account"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
