// components/StudentView.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
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

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-500">Loading class...</p>
      </main>
    );

  if (notFound)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-lg font-semibold text-slate-900">Class not found</p>
          <p className="mt-1 text-sm text-slate-600">
            Check the code with your teacher and try again.
          </p>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 flex justify-center">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <header className="rounded-2xl bg-indigo-600 p-5 text-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-200">
            You&apos;re in
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{className}</h1>
          <p className="mt-1 font-mono tabular-nums text-sm tracking-widest text-indigo-200">
            {code}
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-sm">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-4 w-4 shrink-0"
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
            <span>Anonymous mode. No name or account, and your identity is never shared.</span>
          </div>
        </header>

        {lectures.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-slate-600 shadow-sm ring-1 ring-slate-200">
            The teacher hasn&apos;t added a lecture yet.
          </p>
        ) : (
          <>
            {/* Ask form */}
            <form
              onSubmit={submit}
              className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <label className="block text-sm font-medium text-slate-700">
                Lecture
                <select
                  value={lectureId}
                  onChange={(e) => setLectureId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {lectures.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_DOUBT_LENGTH}
                rows={4}
                placeholder="What's confusing you? Type it your own way."
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono tabular-nums text-xs text-slate-500">
                  {text.length}/{MAX_DOUBT_LENGTH}
                </span>
              </div>
              <button
                disabled={sending}
                className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Post doubt"}
              </button>
              {status && (
                <p
                  className={
                    status.kind === "ok"
                      ? "rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                      : "rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  }
                >
                  {status.msg}
                </p>
              )}
            </form>

            {/* Class doubts */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Class doubts ({clusters.length})
                </h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              {clusters.length === 0 ? (
                <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  No doubts for this lecture yet. Be the first to ask above. Others in your class
                  will see it and can tap &ldquo;Me too&rdquo;.
                </p>
              ) : (
                clusters.map((c) => {
                  const votedMeToo = hasVoted(c.id, "me_too");
                  const votedStillConfused = hasVoted(c.id, "still_confused");
                  const votedUnderstood = hasVoted(c.id, "understood");

                  return (
                    <div
                      key={c.id}
                      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold leading-snug text-slate-900">
                            {c.label ?? "Student question"}
                          </h3>
                          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">
                            {c.doubt_count} asked · {c.me_too_count} me too
                            {c.still_confused_count > 0 &&
                              ` · ${c.still_confused_count} still confused`}
                            {c.understood_count > 0 && ` · ${c.understood_count} understood`}
                          </p>
                        </div>
                        {c.status === "addressed" && (
                          <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Addressed
                          </span>
                        )}
                      </div>

                      {c.published_explanation && (
                        <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Teacher explanation
                          </p>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {c.published_explanation}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={votingKey === `${c.id}:me_too`}
                          onClick={() => castVote(c.id, "me_too")}
                          className={`min-h-11 min-w-28 flex-1 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                            votedMeToo
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {votedMeToo
                            ? `✓ Me too (${c.me_too_count})`
                            : `+ Me too (${c.me_too_count})`}
                        </button>

                        {c.published_explanation && (
                          <button
                            type="button"
                            disabled={votingKey === `${c.id}:still_confused`}
                            onClick={() => castVote(c.id, "still_confused")}
                            className={`min-h-11 min-w-28 flex-1 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                              votedStillConfused
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                : "border-amber-300 text-amber-800 hover:bg-amber-50"
                            }`}
                          >
                            {votedStillConfused
                              ? `✓ Still confused (${c.still_confused_count})`
                              : `Still confused (${c.still_confused_count})`}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={votingKey === `${c.id}:understood`}
                          onClick={() => castVote(c.id, "understood")}
                          className={`min-h-11 min-w-28 flex-1 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                            votedUnderstood
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          {votedUnderstood
                            ? `✓ Understood (${c.understood_count})`
                            : `Understood (${c.understood_count})`}
                        </button>
                      </div>
                    </div>
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