"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/join/${c}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Silent Doubt Wall</h1>
          <p className="text-slate-600">
            Ask doubts anonymously. Teachers see what the class is really confused about.
          </p>
        </div>

        <form
          onSubmit={join}
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-left"
        >
          <label className="block text-sm text-slate-600">
            Student? Enter your class code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. K9HQGK"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-mono tracking-widest text-slate-900"
            />
          </label>
          <button className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium">
            Join anonymously
          </button>
          <p className="text-xs text-slate-500">
            No sign-up, no name. Your identity is never shared.
          </p>
        </form>

        <div className="text-sm text-slate-600">
          Teacher?{" "}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">
            Log in
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="text-indigo-600 font-medium hover:underline">
            create an account
          </Link>
        </div>
      </div>
    </main>
  );
}