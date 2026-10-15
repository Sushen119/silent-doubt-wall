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

  const openClusters = clusters.filter((c) => c.status === "open");
  const top = openClusters.slice(0, 3);
  const restOpen = openClusters.slice(3);
  const addressedClusters = clusters.filter((c) => c.status === "addressed");

  function renderClusterCard(c: Cluster, rankIndex?: number) {
    const explanation = c.published_explanation;
    const isLong = (explanation ?? "").length > 220;
    const showAll = !!openPublished[c.id];
    const isAddressed = c.status === "addressed";

    return (
      <div
        key={c.id}
        className={`space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ${
          isAddressed ? "ring-slate-200/80 opacity-95" : "ring-slate-200"
        }`}
      >
        <div className="flex items-start gap-4">
          {typeof rankIndex === "number" ? (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-xl font-bold ${
                rankIndex === 0
                  ? "bg-amber-500 text-white"
                  : rankIndex < 3
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {rankIndex + 1}
            </span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-sm font-bold text-emerald-700">
              ✓
            </span>
          )}

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold leading-snug text-slate-900">
                {c.label ?? "Untitled topic"}
              </h2>
              {isAddressed && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Addressed
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm tabular-nums text-slate-600">
              <span>{plural(c.doubt_count, "doubt")}</span>
              <span>{c.me_too_count} me too</span>
              {c.still_confused_count > 0 && (
                <span className="font-medium text-amber-700">
                  {c.still_confused_count} still confused
                </span>
              )}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-400">score</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-slate-700">
              {c.score.toFixed(1)}
            </p>
          </div>
        </div>

        {explanation && (
          <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Published to class
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() =>
                    setOpenPublished((p) => ({ ...p, [c.id]: !p[c.id] }))
                  }
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  {showAll ? "Show less" : "Show more"}
                </button>
              )}
            </div>
            <p
              className={`whitespace-pre-wrap leading-relaxed ${
                isLong && !showAll ? "line-clamp-3" : ""
              }`}
            >
              {explanation}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (activeExplainId === c.id) {
                setActiveExplainId(null);
              } else if (draftText[c.id]) {
                setActiveExplainId(c.id);
              } else {
                generateExplanation(c.id, "default");
              }
            }}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {activeExplainId === c.id ? "Close AI helper" : "Re-explain"}
          </button>

          <button
            onClick={() => toggle(c.id)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {expanded === c.id ? "Hide doubts" : "View doubts"}
          </button>

          {isAddressed ? (
            <button
              onClick={() => setClusterStatus(c.id, "open")}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              Reopen doubt
            </button>
          ) : (
            <button
              onClick={() => setClusterStatus(c.id, "addressed")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Mark addressed
            </button>
          )}
        </div>

        {activeExplainId === c.id && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-slate-500">
                Regenerate:
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
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
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {draftText[c.id] &&
                draftText[c.id]?.trim() !== (aiOriginal[c.id] ?? "").trim()
                  ? "Edited by teacher"
                  : "AI draft (editable)"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveExplainId(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600"
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
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish to class"}
                </button>
              </div>
            </div>
          </div>
        )}

        {expanded === c.id && (
          <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
            {(doubts[c.id] ?? []).map((d) => (
              <li key={d.id} className="rounded-lg bg-slate-50 px-3 py-2">
                &ldquo;{d.text}&rdquo;
              </li>
            ))}
            {!doubts[c.id] && <li className="text-slate-500">Loading...</li>}
          </ul>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          &larr; All classes
        </Link>

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-indigo-950 p-6 text-white shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Live confusion board
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {info?.title ?? "Lecture"}
            </h1>
            <p className="mt-0.5 text-indigo-200">{info?.className}</p>
          </div>
          {info?.code && (
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">
                Class code
              </p>
              <p className="font-mono tabular-nums text-3xl font-bold tracking-[0.25em] text-amber-300">
                {info.code}
              </p>
            </div>
          )}
        </header>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {loading && <p className="text-slate-500">Loading...</p>}

        {!loading && openClusters.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-semibold text-slate-900">
              No open doubts right now
            </p>
            <p className="mt-1 text-slate-600">
              Students can post at /join/{info?.code ?? "CODE"}. Topics appear
              here the moment they ask.
            </p>
          </div>
        )}

        {/* Section 1: Top 3 Confusion Points */}
        {top.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Top {top.length} Priority Doubts
              </h2>
              <span className="text-xs text-slate-400">
                Ranked by doubts + me too + 2× still confused
              </span>
            </div>
            {top.map((c, i) => renderClusterCard(c, i))}
          </section>
        )}

        {/* Section 2: Remaining Open Doubts (#4 and below) */}
        {restOpen.length > 0 && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-t border-slate-200 pt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Other Open Doubts ({restOpen.length})
              </h2>
            </div>
            {restOpen.map((c, idx) => renderClusterCard(c, idx + 3))}
          </section>
        )}

        {/* Section 3: Addressed Doubts */}
        {addressedClusters.length > 0 && (
          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Addressed doubts
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-800">
                  {addressedClusters.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressed((s) => !s)}
                className="text-xs font-medium text-indigo-600 hover:underline"
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