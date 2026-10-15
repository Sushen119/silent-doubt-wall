// components/LectureBoard.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Cluster = {
  id: string;
  label: string | null;
  status: "open" | "addressed";
  doubt_count: number;
  me_too_count: number;
  still_confused_count: number;
  score: number;
  published_explanation: string | null;
  updated_at: string;
};
type Doubt = { id: string; text: string; created_at: string };
type Info = { title: string; className: string; code: string };
type StyleMode = "default" | "simpler" | "analogy" | "code";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function LectureBoard({ lectureId }: { lectureId: string }) {
  const [supabase] = useState(() => createClient());
  const [info, setInfo] = useState<Info | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [doubts, setDoubts] = useState<Record<string, Doubt[]>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openPublished, setOpenPublished] = useState<Record<string, boolean>>({});
  const [showAddressed, setShowAddressed] = useState(true);
  const [copiedJoin, setCopiedJoin] = useState(false);

  // Re-explain & Publish state
  const [activeExplainId, setActiveExplainId] = useState<string | null>(null);
  const [aiOriginal, setAiOriginal] = useState<Record<string, string>>({});
  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [generatingMode, setGeneratingMode] = useState<StyleMode | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("top_clusters", {
      p_lecture_id: lectureId,
    });
    if (error) setError(error.message);
    else {
      setError("");
      setClusters(data as Cluster[]);
    }
    setLoading(false);
  }, [supabase, lectureId]);

  useEffect(() => {
    supabase
      .from("lectures")
      .select("title, classes(name, code)")
      .eq("id", lectureId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const cls = data.classes as unknown as
          | { name: string; code: string }
          | { name: string; code: string }[];
        const c = Array.isArray(cls) ? cls[0] : cls;
        setInfo({
          title: data.title,
          className: c?.name ?? "",
          code: c?.code ?? "",
        });
      });
  }, [supabase, lectureId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`clusters-${lectureId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clusters",
          filter: `lecture_id=eq.${lectureId}`,
        },
        () => load()
      )
      .subscribe();
    const poll = setInterval(load, 10_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [supabase, lectureId, load]);

  async function toggle(clusterId: string) {
    if (expanded === clusterId) return setExpanded(null);
    setExpanded(clusterId);
    const { data, error } = await supabase.rpc("get_cluster_doubts", {
      p_cluster_id: clusterId,
    });
    if (error) return setError(error.message);
    setDoubts((d) => ({ ...d, [clusterId]: data as Doubt[] }));
  }

  async function setClusterStatus(clusterId: string, nextStatus: "open" | "addressed") {
    setError("");
    const { data, error } = await supabase
      .from("clusters")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", clusterId)
      .select("id");

    if (error) return setError(error.message);
    if (!data || data.length === 0) {
      return setError("Could not update cluster status. Check permissions.");
    }
    if (activeExplainId === clusterId && nextStatus === "addressed") {
      setActiveExplainId(null);
    }
    load();
  }

  async function generateExplanation(clusterId: string, mode: StyleMode = "default") {
    setError("");
    setActiveExplainId(clusterId);
    setGeneratingMode(mode);
    try {
      const res = await fetch("/api/clusters/re-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId, mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to generate explanation");
      } else {
        setAiOriginal((prev) => ({ ...prev, [clusterId]: json.draft }));
        setDraftText((prev) => ({ ...prev, [clusterId]: json.draft }));
      }
    } catch {
      setError("Network error while calling AI re-explain");
    } finally {
      setGeneratingMode(null);
    }
  }

  async function publishExplanation(clusterId: string) {
    const text = (draftText[clusterId] ?? "").trim();
    if (!text) return;
    setError("");
    setPublishing(true);

    const original = (aiOriginal[clusterId] ?? "").trim();
    const source = text === original ? "ai_draft" : "teacher_edited";

    try {
      const res = await fetch("/api/clusters/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId, text, source }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to publish explanation");
      } else {
        setActiveExplainId(null);
        await load();
      }
    } catch {
      setError("Network error while publishing explanation");
    } finally {
      setPublishing(false);
    }
  }

  function copyStudentLink() {
    if (!info?.code || typeof window === "undefined") return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${info.code}`);
    setCopiedJoin(true);
    setTimeout(() => setCopiedJoin(false), 2000);
  }

  const openClusters = clusters.filter((c) => c.status === "open");
  const top = openClusters.slice(0, 3);
  const restOpen = openClusters.slice(3);
  const addressedClusters = clusters.filter((c) => c.status === "addressed");
  const totalDoubtsCount = clusters.reduce((acc, c) => acc + c.doubt_count, 0);

  function renderClusterCard(c: Cluster, rankIndex?: number) {
    const explanation = c.published_explanation;
    const isLong = (explanation ?? "").length > 220;
    const showAll = !!openPublished[c.id];
    const isAddressed = c.status === "addressed";

    return (
      <article
        key={c.id}
        className={`space-y-4 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 transition-shadow hover:shadow-md ${
          isAddressed
            ? "ring-slate-200/80 bg-white/95"
            : rankIndex === 0
            ? "ring-amber-300/90"
            : "ring-slate-200/90"
        }`}
      >
        <div className="flex items-start gap-4">
          {typeof rankIndex === "number" ? (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-mono text-xl font-bold shadow-2xs ${
                rankIndex === 0
                  ? "bg-amber-500 text-white shadow-amber-500/20"
                  : rankIndex < 3
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              #{rankIndex + 1}
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 font-mono text-base font-bold text-emerald-700">
              ✓
            </span>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold leading-snug text-slate-900">
                {c.label ?? "Untitled topic"}
              </h3>
              {rankIndex === 0 && !isAddressed && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Highest Priority
                </span>
              )}
              {isAddressed && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Addressed
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm tabular-nums">
              <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                {plural(c.doubt_count, "doubt")}
              </span>
              <span className="rounded-lg bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
                {c.me_too_count} me too
              </span>
              {c.still_confused_count > 0 && (
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">
                  {c.still_confused_count} still confused
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-1.5 text-right ring-1 ring-slate-200/70">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Score
            </p>
            <p className="font-mono text-lg font-bold tabular-nums text-slate-800">
              {c.score.toFixed(1)}
            </p>
          </div>
        </div>

        {explanation && (
          <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                ✓ Published to class
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() =>
                    setOpenPublished((p) => ({ ...p, [c.id]: !p[c.id] }))
                  }
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {showAll ? "Show less" : "Show more"}
                </button>
              )}
            </div>
            <p
              className={`whitespace-pre-wrap leading-relaxed text-slate-800 ${
                isLong && !showAll ? "line-clamp-3" : ""
              }`}
            >
              {explanation}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              if (activeExplainId === c.id) {
                setActiveExplainId(null);
              } else if (draftText[c.id]) {
                setActiveExplainId(c.id);
              } else {
                generateExplanation(c.id, "default");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <span>
              {activeExplainId === c.id ? "Close AI helper" : "✨ Re-explain with AI"}
            </span>
          </button>

          <button
            type="button"
            aria-expanded={expanded === c.id}
            onClick={() => toggle(c.id)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            {expanded === c.id
              ? "Hide student doubts"
              : `View doubts (${c.doubt_count})`}
          </button>

          {isAddressed ? (
            <button
              type="button"
              onClick={() => setClusterStatus(c.id, "open")}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs sm:text-sm font-semibold text-amber-900 transition hover:bg-amber-100 active:scale-[0.98]"
            >
              Reopen doubt
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setClusterStatus(c.id, "addressed")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 active:scale-[0.98]"
            >
              ✓ Mark addressed
            </button>
          )}
        </div>

        {activeExplainId === c.id && (
          <div className="space-y-3.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-indigo-900">
                Style mode:
              </span>
              {(
                [
                  ["default", "Standard"],
                  ["simpler", "Simpler"],
                  ["analogy", "Different analogy"],
                  ["code", "Code example"],
                ] as [StyleMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  disabled={generatingMode !== null}
                  onClick={() => generateExplanation(c.id, mode)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-50/60 disabled:opacity-50"
                >
                  {generatingMode === mode ? "Thinking..." : label}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={draftText[c.id] ?? ""}
              onChange={(e) =>
                setDraftText((prev) => ({ ...prev, [c.id]: e.target.value }))
              }
              placeholder="Write or edit the explanation for your class..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm sm:text-base text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                {draftText[c.id] &&
                draftText[c.id]?.trim() !== (aiOriginal[c.id] ?? "").trim()
                  ? "Edited by teacher"
                  : "AI draft (editable before publishing)"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveExplainId(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    publishing ||
                    generatingMode !== null ||
                    !(draftText[c.id] ?? "").trim()
                  }
                  onClick={() => publishExplanation(c.id)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish to class"}
                </button>
              </div>
            </div>
          </div>
        )}

        {expanded === c.id && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Anonymous student submissions in this topic
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {(doubts[c.id] ?? []).map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 leading-relaxed"
                >
                  &ldquo;{d.text}&rdquo;
                </li>
              ))}
              {!doubts[c.id] && (
                <li className="text-slate-500">Loading doubts...</li>
              )}
            </ul>
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-indigo-600"
          >
            <span aria-hidden="true">&larr;</span> All classes
          </Link>

          {info?.code && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyStudentLink}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                {copiedJoin ? "✓ Join link copied" : "Copy student join link"}
              </button>
              <Link
                href={`/join/${info.code}`}
                target="_blank"
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Student view &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Header */}
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-6 sm:p-7 text-white shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Live confusion board
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {info?.title ?? "Lecture"}
              </h1>
              <p className="text-sm text-indigo-200">{info?.className}</p>
            </div>

            {info?.code && (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-right backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  Class code
                </p>
                <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-[0.25em] text-amber-300">
                  {info.code}
                </p>
              </div>
            )}
          </div>

          {/* Live Summary Bar */}
          <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-white/10 pt-4 text-center sm:text-left">
            <div className="rounded-xl bg-white/5 px-3.5 py-2">
              <p className="text-[11px] font-medium text-indigo-200">
                Open topics
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-white">
                {openClusters.length}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3.5 py-2">
              <p className="text-[11px] font-medium text-indigo-200">
                Addressed topics
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-emerald-300">
                {addressedClusters.length}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3.5 py-2">
              <p className="text-[11px] font-medium text-indigo-200">
                Total doubts asked
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-amber-300">
                {totalDoubtsCount}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
              />
            ))}
          </div>
        )}

        {!loading && openClusters.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xs">
            <p className="text-lg font-bold text-slate-900">
              No open doubts right now
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Students can post at{" "}
              <span className="font-mono font-semibold text-slate-800">
                /join/{info?.code ?? "CODE"}
              </span>
              . Topics appear here automatically the moment they ask.
            </p>
          </div>
        )}

        {/* Section 1: Top 3 Confusion Points */}
        {top.length > 0 && (
          <section aria-labelledby="top-priority-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h2
                  id="top-priority-heading"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Top {top.length} Priority Confusion Points
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Ranked by doubts + me too + 2× still confused
              </span>
            </div>
            {top.map((c, i) => renderClusterCard(c, i))}
          </section>
        )}

        {/* Section 2: Remaining Open Doubts (#4 and below) */}
        {restOpen.length > 0 && (
          <section aria-labelledby="other-open-heading" className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-t border-slate-200 pt-6 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <h2
                  id="other-open-heading"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Other Open Doubts ({restOpen.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Ranked #4 and below
              </span>
            </div>
            {restOpen.map((c, idx) => renderClusterCard(c, idx + 3))}
          </section>
        )}

        {/* Section 3: Addressed Doubts */}
        {addressedClusters.length > 0 && (
          <section
            aria-labelledby="addressed-doubts-heading"
            className="space-y-4 border-t border-slate-200 pt-6"
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h2
                  id="addressed-doubts-heading"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Addressed doubts
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                  {addressedClusters.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressed((s) => !s)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                {showAddressed ? "Hide addressed" : "Show addressed"}
              </button>
            </div>

            {showAddressed && (
              <div className="space-y-4">
                {addressedClusters.map((c) => renderClusterCard(c))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}