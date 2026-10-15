"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-50 p-4">
      <div className="w-full max-w-sm space-y-4">
        <Link href="/" className="block text-center space-y-2">
          <span className="mx-auto h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-md">
            ?
          </span>
          <span className="block text-sm font-semibold text-slate-700">Silent Doubt Wall</span>
        </Link>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">
              {mode === "signup" ? "Create teacher account" : "Teacher login"}
            </h1>
            <p className="text-sm text-slate-500">
              {mode === "signup"
                ? "Create classes and see what your students are confused about."
                : "Log in to see your classes and live doubts."}
            </p>
          </div>

          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
          </button>
          <p className="text-sm text-slate-600 text-center">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-indigo-600 font-semibold hover:underline">
                  Log in
                </Link>
              </>
            ) : (
              <>
                New teacher?{" "}
                <Link href="/signup" className="text-indigo-600 font-semibold hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}