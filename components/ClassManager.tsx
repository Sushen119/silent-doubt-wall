// components/ClassManager.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/utils/supabase/client";

type Lecture = { id: string; title: string; created_at: string };
type ClassRow = { id: string; name: string; code: string; lectures: Lecture[] };

type HistoryRow = {
  lectureId: string;
  title: string;
  doubts: number;
  me_too: number;
  still_confused: number;
  understood: number;
  open_clusters: number;
  addressed_clusters: number;
};

// No 0/O/1/I so codes are easy to read from a projector
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// "   Back   End " and "back end" are treated as the same class name
function cleanName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}
function nameKey(s: string) {
  return cleanName(s).toLowerCase();
}

function getBaseSiteUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function ClassManager() {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [className, setClassName] = useState("");
  const [lectureTitles, setLectureTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // QR modal & History chart state
  const [openQrClassId, setOpenQrClassId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [openHistoryClassId, setOpenHistoryClassId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, HistoryRow[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, code, lectures(id, title, created_at)")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else {
      setClasses(
        (data as ClassRow[]).map((c) => ({
          ...c,
          lectures: [...c.lectures].sort((a, b) =>
            b.created_at.localeCompare(a.created_at)
          ),
        }))
      );
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = cleanName(className);
    if (!name) return;

    // Block duplicate class names (case-insensitive)
    if (classes.some((c) => nameKey(c.name) === nameKey(name))) {
      return setError(
        `You already have a class named "${name}". Choose a different name.`
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setError("Not logged in");

    // Retry if the random code collides with an existing one
    for (let i = 0; i < 5; i++) {
      const { error } = await supabase
        .from("classes")
        .insert({ name, code: randomCode(), teacher_id: user.id });
      if (!error) {
        setClassName("");
        return load();
      }
      if (error.code === "23505") {
        // Duplicate NAME caught by the optional database index
        if (error.message.includes("classes_teacher_name_unique")) {
          return setError(
            `You already have a class named "${name}". Choose a different name.`
          );
        }
        continue; // otherwise it was a code collision: try a new code
      }
      return setError(error.message);
    }
    setError("Could not generate a unique code, try again");
  }

  async function deleteClass(classId: string) {
    setError("");
    setDeletingId(classId);
    const { data, error } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId)
      .select("id");
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (error) return setError(error.message);
    // RLS can silently block a delete (0 rows, no error), so check for that
    if (!data || data.length === 0) {
      return setError(
        "Could not delete this class. The database may be missing a delete permission for teachers."
      );
    }

    setClasses((prev) => prev.filter((c) => c.id !== classId));
    if (openQrClassId === classId) setOpenQrClassId(null);
    if (openHistoryClassId === classId) setOpenHistoryClassId(null);
  }

  async function addLecture(classId: string) {
    setError("");
    const title = (lectureTitles[classId] ?? "").trim();
    if (!title) return;
    const { error } = await supabase
      .from("lectures")
      .insert({ class_id: classId, title });
    if (error) return setError(error.message);
    setLectureTitles((t) => ({ ...t, [classId]: "" }));
    load();
  }

  async function toggleHistory(classId: string) {
    if (openHistoryClassId === classId) {
      setOpenHistoryClassId(null);
      return;
    }
    setOpenHistoryClassId(classId);
    setLoadingHistory(classId);
    try {
      const res = await fetch(
        `/api/teacher/history?classId=${encodeURIComponent(classId)}`
      );
      if (res.ok) {
        const json = await res.json();
        setHistoryData((prev) => ({ ...prev, [classId]: json.history ?? [] }));
      }
    } finally {
      setLoadingHistory(null);
    }
  }

  function copyJoinUrl(code: string) {
    const url = `${getBaseSiteUrl()}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const baseUrl = getBaseSiteUrl();

  return (
    <section aria-label="Class management" className="space-y-6">
      {/* Create Class Bar */}
      <form
        onSubmit={createClass}
        className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <label
          htmlFor="new-class-name"
          className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
        >
          Create a new class room
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="new-class-name"
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              if (error) setError("");
            }}
            placeholder="New class name, e.g. BCA Sem 5 - DBMS"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <span>+ Create class</span>
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-2xs"
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

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex justify-between">
                <div className="h-6 w-40 rounded-lg bg-slate-200" />
                <div className="h-9 w-24 rounded-lg bg-indigo-100" />
              </div>
              <div className="h-8 w-56 rounded-lg bg-slate-100" />
              <div className="h-12 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {!loading && classes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <p className="text-base font-semibold text-slate-800">
            No classes created yet
          </p>
          <p className="text-sm text-slate-500">
            Enter a course or subject name above to generate your first 6-character class code and QR link.
          </p>
        </div>
      )}

      {classes.map((c) => {
        const joinUrl = `${baseUrl}/join/${c.code}`;
        const showQr = openQrClassId === c.id;
        const showHistory = openHistoryClassId === c.id;
        const chartRows = historyData[c.id] ?? [];
        const confirming = confirmDeleteId === c.id;
        const deleting = deletingId === c.id;

        return (
          <article
            key={c.id}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Class Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 truncate">
                    {c.name}
                  </h2>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {c.lectures.length} lecture{c.lectures.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Students join at{" "}
                  <span className="font-mono font-medium text-slate-700">
                    /join/{c.code}
                  </span>
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Class code
                </p>
                <p className="mt-0.5 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1.5 font-mono text-xl font-bold tabular-nums tracking-[0.2em] text-indigo-950 shadow-2xs">
                  {c.code}
                </p>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3.5 sm:px-6 bg-slate-50/40">
              <button
                type="button"
                aria-expanded={showQr}
                onClick={() => setOpenQrClassId(showQr ? null : c.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-[0.98] ${
                  showQr
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h7v7h-7z" />
                </svg>
                <span>{showQr ? "Hide QR" : "QR & Join Link"}</span>
              </button>

              <button
                type="button"
                aria-expanded={showHistory}
                onClick={() => toggleHistory(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-[0.98] ${
                  showHistory
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>{showHistory ? "Hide History Chart" : "Confusion History"}</span>
              </button>

              {!confirming && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(c.id)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
                >
                  <span>Delete class</span>
                </button>
              )}
            </div>

            {/* Delete Confirmation Banner */}
            {confirming && (
              <div className="border-t border-red-200 bg-red-50/80 px-5 py-4 sm:px-6">
                <div className="space-y-3">
                  <p className="text-sm text-red-900 leading-relaxed">
                    Delete <span className="font-bold">&ldquo;{c.name}&rdquo;</span>?
                    This permanently removes its lectures, doubts and explanations,
                    and the class code <span className="font-mono font-bold">{c.code}</span> will
                    stop working. This cannot be undone.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => deleteClass(c.id)}
                      className="rounded-xl bg-red-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, delete class"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code & Join Link Panel */}
            {showQr && (
              <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <QRCodeSVG value={joinUrl} size={148} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                        Projector QR & Direct Link
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Students scan this QR code or open the link below to post doubts anonymously.
                      </p>
                    </div>
                    <p className="break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs sm:text-sm text-slate-800">
                      {joinUrl}
                    </p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => copyJoinUrl(c.code)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-[0.98]"
                      >
                        <span>
                          {copiedCode === c.code ? "✓ Copied!" : "Copy Join Link"}
                        </span>
                      </button>
                      <Link
                        href={`/join/${c.code}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <span>Open Student View &rarr;</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lecture-wise Confusion History Chart (Recharts) */}
            {showHistory && (
              <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-5 sm:px-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Lecture-wise Confusion History
                      </p>
                      <p className="text-xs text-slate-500">
                        Compare student doubts, upvotes, and comprehension across lectures
                      </p>
                    </div>
                  </div>

                  {loadingHistory === c.id ? (
                    <div className="flex h-60 items-center justify-center text-xs font-medium text-slate-500">
                      Loading chart...
                    </div>
                  ) : chartRows.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No lecture history available yet.
                    </div>
                  ) : (
                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartRows}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis
                            dataKey="title"
                            tick={{ fontSize: 12, fill: "#475569" }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: "#475569" }}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "0.75rem",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Bar
                            dataKey="doubts"
                            name="Doubts"
                            fill="#4f46e5"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="me_too"
                            name="Me too"
                            fill="#0ea5e9"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="still_confused"
                            name="Still confused"
                            fill="#f59e0b"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="understood"
                            name="Understood"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lectures List & Add Lecture Form */}
            <div className="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Lectures
                </p>
              </div>

              {c.lectures.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                  No lectures yet. Add your first one below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {c.lectures.map((l, i) => (
                    <li key={l.id}>
                      <Link
                        href={`/teacher/lecture/${l.id}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-2xs transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <span className="min-w-0 flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-semibold text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition">
                            {c.lectures.length - i}
                          </span>
                          <span className="font-semibold text-slate-900 truncate group-hover:text-indigo-950">
                            {l.title}
                          </span>
                          {i === 0 && (
                            <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              Latest
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                          Open board &rarr;
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  aria-label={`New lecture title for ${c.name}`}
                  value={lectureTitles[c.id] ?? ""}
                  onChange={(e) =>
                    setLectureTitles((t) => ({ ...t, [c.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLecture(c.id);
                    }
                  }}
                  placeholder="New lecture, e.g. Lecture 7 - Normalization"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                />
                <button
                  type="button"
                  onClick={() => addLecture(c.id)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  + Add lecture
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}