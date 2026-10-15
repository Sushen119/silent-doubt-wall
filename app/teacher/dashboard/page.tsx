// app/teacher/dashboard/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ClassManager from "@/components/ClassManager";

async function Welcome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-900/60 px-3.5 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
      <span>Logged in as {user?.email ?? "Teacher"}</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm shadow-indigo-600/20">
              ?
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Silent Doubt Wall
              </span>
              <span className="hidden rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700 sm:inline-block">
                Teacher
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Home page &rarr;
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Dashboard Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-6 sm:p-7 text-white shadow-md">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Instructor Workspace
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Teacher dashboard
              </h1>
              <p className="text-sm text-indigo-200/90 max-w-xl">
                Manage your classes, project QR join codes, and monitor real-time or historical student confusion across lectures.
              </p>
            </div>

            <div className="shrink-0">
              <Suspense
                fallback={
                  <div className="h-7 w-44 animate-pulse rounded-full bg-indigo-800/60" />
                }
              >
                <Welcome />
              </Suspense>
            </div>
          </div>
        </div>

        <ClassManager />
      </main>
    </div>
  );
}