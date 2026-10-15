// app/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    n: "01",
    title: "Students post anonymously",
    text: "Join in seconds with a 6-character class code or QR scan. No account, no name, zero hesitation.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-indigo-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "AI clusters similar doubts",
    text: "Semantic embeddings group differently worded questions into clear topics and rank them by urgency.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-indigo-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <path d="M10.5 7.5 6.5 16.5" />
        <path d="M13.5 7.5 17.5 16.5" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Teacher responds live",
    text: "Spot the Top 3 confusion points at a glance and publish a tailored plain-language re-explanation.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-indigo-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="m9 10 2 2 4-4" />
      </svg>
    ),
  },
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/join/${c}`);
  }

  const trimmedCode = code.trim();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm shadow-indigo-600/20">
              ?
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Silent Doubt Wall
            </span>
          </Link>

          <nav aria-label="Teacher account navigation" className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Teacher log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-slate-50 to-slate-50 px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-12 sm:space-y-16">
          {/* Hero & Join Card Grid */}
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Value Proposition */}
            <div className="space-y-4 text-center lg:col-span-7 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3 py-1 text-xs font-semibold text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                Real-Time Classroom Confusion Tracker
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12]">
                Every student doubt heard,{" "}
                <span className="text-indigo-600">without the fear</span> of raising a hand.
              </h1>

              <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
                Ask doubts anonymously during live lectures. AI groups similar questions automatically so teachers see what the class is really confused about.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs font-medium text-slate-500 lg:justify-start">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  100% Anonymous for students
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live semantic AI clustering
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Instant teacher re-explanations
                </span>
              </div>
            </div>

            {/* Right Column: Student Join Card */}
            <div className="lg:col-span-5">
              <form
                onSubmit={join}
                className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-900/5 transition-shadow hover:shadow-xl hover:shadow-slate-900/5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Join a live class
                    </h2>
                    <p className="text-xs text-slate-500">
                      Enter the 6-character code from your classroom screen
                    </p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-mono text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                    {trimmedCode.length}/6
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="class-code-input"
                    className="sr-only"
                  >
                    Student? Enter your class code
                  </label>
                  <input
                    id="class-code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="K9HQGK"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-4 py-3.5 text-center font-mono text-2xl font-bold uppercase tracking-[0.3em] text-slate-900 placeholder: font-normal placeholder:text-slate-300 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!trimmedCode}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <span>Join anonymously</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>No sign-up, no name. Your identity is never shared.</span>
                </div>
              </form>
            </div>
          </div>

          {/* 3-Step How It Works Section */}
          <section aria-labelledby="how-it-works-heading" className="space-y-4">
            <div className="text-center">
              <h2
                id="how-it-works-heading"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                How Silent Doubt Wall Works
              </h2>
            </div>

            <ul className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
                        {s.icon}
                      </span>
                      <span className="font-mono text-xs font-bold tracking-wider text-slate-400">
                        STEP {s.n}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {s.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Footer Teacher Callout */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm sm:flex-row">
            <span>
              <strong className="font-semibold text-slate-900">Teaching a class?</strong>{" "}
              Create a room in seconds and project your live QR code.
            </span>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Log in
              </Link>
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <Link
                href="/signup"
                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Create an account &rarr;
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}