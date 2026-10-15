// components/AuthForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/teacher/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-slate-50 to-slate-50 px-4 py-10 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg px-2 py-1 -ml-2"
          >
            <span aria-hidden="true">&larr;</span> Back to home
          </Link>
          <span className="text-xs font-medium text-slate-400">
            Teacher Portal
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-lg shadow-slate-900/5 space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm shadow-indigo-600/25"
            >
              ?
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {mode === "signup" ? "Create teacher account" : "Teacher login"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {mode === "signup"
                  ? "Create classes and see what your students are confused about."
                  : "Log in to see your classes and live doubts."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="teacher-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Email address
              </label>
              <input
                id="teacher-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="teacher-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="teacher-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {loading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
              )}
              <span>
                {loading
                  ? "Please wait..."
                  : mode === "signup"
                  ? "Create account"
                  : "Log in to dashboard"}
              </span>
            </button>
          </form>

          <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                New teacher?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}