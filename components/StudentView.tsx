// components/StudentView.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSessionId } from "@/utils/session";
import { MAX_DOUBT_LENGTH } from "@/lib/constants";

type Lecture = { id: string; title: string };

type Cluster = {
  id: string;
  label: string | null;
  status: "open" | "addressed";
  doubt_count: number;
  me_too_count: number;
  still_confused_count: number;
  understood_count: number;
  score: number;
  published_explanation: string | null;
  updated_at: string;
};

type VoteKind = "me_too" | "still_confused" | "understood";

type VoteRecord = {
  cluster_id: string;
  kind: VoteKind;
};

export default function StudentView({ code }: { code: string }) {
  const [className, setClassName] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lectureId, setLectureId] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [myVotes, setMyVotes] = useState<VoteRecord[]>([]);
  const [votingKey, setVotingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/class?code=${code}`)
      .then(async (res) => {
        if (!res.ok) return setNotFound(true);
        const data = await res.json();
        setClassName(data.name);
        setLectures(data.lectures);
        setLectureId(data.lectures[0]?.id ?? "");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  const loadClusters = useCallback(async () => {
    if (!lectureId) return;
    try {
      const sessionId = getSessionId();
      const res = await fetch(
        `/api/student/clusters?code=${encodeURIComponent(code)}&lectureId=${encodeURIComponent(
          lectureId
        )}&sessionId=${encodeURIComponent(sessionId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setClusters(data.clusters ?? []);
      setMyVotes(data.myVotes ?? []);
    } catch {
      // Ignore network blips during polling
    }
  }, [code, lectureId]);

  useEffect(() => {
    if (!lectureId) return;
    loadClusters();
    const timer = setInterval(loadClusters, 5_000);
    return () => clearInterval(timer);
  }, [lectureId, loadClusters]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSending(true);
    const res = await fetch("/api/doubts/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, lectureId, text, sessionId: getSessionId() }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setText("");
      setStatus({ kind: "ok", msg: "Submitted anonymously. Nobody can see who asked." });
      loadClusters();
    } else {
      setStatus({ kind: "error", msg: data.error ?? "Something went wrong." });
    }
  }

  async function castVote(clusterId: string, kind: VoteKind) {
    const key = `${clusterId}:${kind}`;
    setVotingKey(key);
    try {
      const res = await fetch("/api/upvotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          clusterId,
          sessionId: getSessionId(),
          kind,
        }),
      });
      if (res.ok) {
        await loadClusters();
      }
    } finally {
      setVotingKey(null);
    }
  }

  function hasVoted(clusterId: string, kind: VoteKind) {
    return myVotes.some((v) => v.cluster_id === clusterId && v.kind === kind);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
        <div className="w-full max-w-lg space-y-5 animate-pulse">
          <div className="h-36 rounded-2xl bg-indigo-200/60" />
          <div className="h-56 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 space-y-3">
            <div className="h-10 rounded-xl bg-slate-100" />
            <div className="h-24 rounded-xl bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-200" />
          </div>
          <div className="h-28 rounded-2xl bg-white ring-1 ring-slate-200/80" />
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-slate-900">Class not found</p>
            <p className="text-sm text-slate-600">
              We couldn&apos;t find an active class with code{" "}
              <span className="font-mono font-semibold text-slate-800">{code}</span>. Check the code with your teacher and try again.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            &larr; Enter a different code
          </Link>
        </div>
      </main>
    );
  }

  const charRatio = text.length / MAX_DOUBT_LENGTH;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:py-8 flex justify-center selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-lg space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg px-1.5 py-1 -ml-1.5"
          >
            <span aria-hidden="true">&larr;</span> Switch class
          </Link>
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Connected live
          </span>
        </div>

        {/* Header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 p-5 sm:p-6 text-white shadow-md shadow-indigo-950/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200">
                Live Classroom
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight truncate">
                {className}
              </h1>
            </div>
            <div className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-right backdrop-blur-sm ring-1 ring-white/20">
              <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-200">
                Code
              </p>
              <p className="font-mono tabular-nums text-base font-bold tracking-widest text-white">
                {code}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-indigo-950/30 px-3.5 py-2.5 text-xs sm:text-sm text-indigo-50 ring-1 ring-white/10">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0 text-emerald-300"
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
            <span>
              Anonymous mode active. No name or account is linked to your questions or votes.
            </span>
          </div>
        </header>

        {lectures.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">No active lecture yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Your teacher hasn&apos;t added a lecture to this class yet.
            </p>
          </div>
        ) : (
          <>
            {/* Ask form */}
            <form
              onSubmit={submit}
              className="space-y-4 rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/90"
            >
              <div>
                <label
                  htmlFor="student-lecture-select"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Select Lecture
                </label>
                <select
                  id="student-lecture-select"
                  value={lectureId}
                  onChange={(e) => setLectureId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 py-3 text-sm sm:text-base font-medium text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                >
                  {lectures.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="student-doubt-textarea"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Your Doubt
                </label>
                <textarea
                  id="student-doubt-textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={MAX_DOUBT_LENGTH}
                  rows={3}
                  placeholder="What's confusing you right now? Explain it in your own words..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                />
                <div className="flex items-center justify-between px-0.5 text-xs">
                  <span className="text-slate-400">
                    Similar doubts are grouped automatically by AI
                  </span>
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      charRatio > 0.9 ? "text-amber-600" : "text-slate-400"
                    }`}
                  >
                    {text.length}/{MAX_DOUBT_LENGTH}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm sm:text-base font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                {sending && (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                )}
                <span>{sending ? "Submitting anonymously..." : "Post doubt anonymously"}</span>
              </button>

              {status && (
                <div
                  role="status"
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                    status.kind === "ok"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  <span aria-hidden="true">{status.kind === "ok" ? "✓" : "!"}</span>
                  <span>{status.msg}</span>
                </div>
              )}
            </form>

            {/* Class doubts */}
            <section aria-labelledby="class-doubts-heading" className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <h2
                  id="class-doubts-heading"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Class Doubts ({clusters.length})
                </h2>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Auto-updates every 5s
                </span>
              </div>

              {clusters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">
                    No doubts posted for this lecture yet
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500">
                    Be the first to ask above. Classmates can tap &ldquo;Me too&rdquo; if they share your question.
                  </p>
                </div>
              ) : (
                clusters.map((c) => {
                  const votedMeToo = hasVoted(c.id, "me_too");
                  const votedStillConfused = hasVoted(c.id, "still_confused");
                  const votedUnderstood = hasVoted(c.id, "understood");

                  return (
                    <article
                      key={c.id}
                      className={`space-y-3.5 rounded-2xl bg-white p-4 sm:p-5 shadow-sm ring-1 transition ${
                        c.published_explanation
                          ? "ring-emerald-200/90"
                          : "ring-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <h3 className="text-base font-bold leading-snug text-slate-900">
                            {c.label ?? "Student question"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs tabular-nums">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {c.doubt_count} asked
                            </span>
                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                              {c.me_too_count} me too
                            </span>
                            {c.still_confused_count > 0 && (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                                {c.still_confused_count} still confused
                              </span>
                            )}
                            {c.understood_count > 0 && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                                {c.understood_count} understood
                              </span>
                            )}
                          </div>
                        </div>

                        {c.status === "addressed" && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <span aria-hidden="true">✓</span> Addressed
                          </span>
                        )}
                      </div>

                      {c.published_explanation && (
                        <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-950">
                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 shrink-0 text-emerald-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Teacher Explanation</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                            {c.published_explanation}
                          </p>
                        </div>
                      )}

                      {/* Feedback Toggle Buttons */}
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <button
                          type="button"
                          aria-pressed={votedMeToo}
                          disabled={votingKey === `${c.id}:me_too`}
                          onClick={() => castVote(c.id, "me_too")}
                          className={`min-h-11 min-w-28 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                            votedMeToo
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-xs hover:bg-indigo-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>
                            {votedMeToo
                              ? `✓ Me too (${c.me_too_count})`
                              : `+ Me too (${c.me_too_count})`}
                          </span>
                        </button>

                        {c.published_explanation && (
                          <button
                            type="button"
                            aria-pressed={votedStillConfused}
                            disabled={votingKey === `${c.id}:still_confused`}
                            onClick={() => castVote(c.id, "still_confused")}
                            className={`min-h-11 min-w-28 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                              votedStillConfused
                                ? "border-amber-400 bg-amber-100/80 text-amber-900 shadow-xs hover:bg-amber-100"
                                : "border-amber-300 bg-amber-50/40 text-amber-800 hover:bg-amber-50"
                            }`}
                          >
                            <span>
                              {votedStillConfused
                                ? `✓ Still confused (${c.still_confused_count})`
                                : `Still confused (${c.still_confused_count})`}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          aria-pressed={votedUnderstood}
                          disabled={votingKey === `${c.id}:understood`}
                          onClick={() => castVote(c.id, "understood")}
                          className={`min-h-11 min-w-28 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                            votedUnderstood
                              ? "border-emerald-400 bg-emerald-100/80 text-emerald-900 shadow-xs hover:bg-emerald-100"
                              : "border-emerald-300 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          <span>
                            {votedUnderstood
                              ? `✓ Understood (${c.understood_count})`
                              : `Understood (${c.understood_count})`}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}