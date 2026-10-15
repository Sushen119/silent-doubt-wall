"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STEPS = [
  { n: "1", title: "Students post", text: "Anonymous doubts, no sign-up, just a class code or QR." },
  { n: "2", title: "AI groups them", text: "Similar doubts cluster together, even when worded differently." },
  { n: "3", title: "Teacher responds", text: "See the Top 3 confusions and publish a clear re-explanation." },
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/join/${c}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-50 flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
            ?
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Silent Doubt Wall
          </h1>
          <p className="text-slate-600">
            Ask doubts anonymously. Teachers see what the class is really confused about.
          </p>
        </div>

        <form
          onSubmit={join}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3"
        >
          <label className="block text-sm font-medium text-slate-700">
            Student? Enter your class code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. K9HQGK"
              autoComplete="off"
              className="mt-2 w-full border border-slate-300 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 font-semibold transition">
            Join anonymously
          </button>
          <p className="text-xs text-slate-500 text-center">
            No sign-up, no name. Your identity is never shared.
          </p>
        </form>

        <ul className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3 items-start">
              <span className="h-7 w-7 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center">
                {s.n}
              </span>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{s.title}.</span> {s.text}
              </p>
            </li>
          ))}
        </ul>

        <div className="text-center text-sm text-slate-600 border-t border-slate-200 pt-5">
          Teacher?{" "}
          <Link href="/login" className="text-indigo-600 font-semibold hover:underline">
            Log in
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="text-indigo-600 font-semibold hover:underline">
            create an account
          </Link>
        </div>
      </div>
    </main>
  );
}