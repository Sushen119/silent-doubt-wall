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

// "  Back   End " and "back end" are treated as the same class name
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
    <section className="mt-6 space-y-6 max-w-2xl">
      <form
        onSubmit={createClass}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-2"
      >
        <input
          value={className}
          onChange={(e) => {
            setClassName(e.target.value);
            if (error) setError("");
          }}
          placeholder="New class name, e.g. BCA Sem 5 - DBMS"
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 font-semibold transition">
          Create class
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {loading && <p className="text-slate-500">Loading...</p>}
      {!loading && classes.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
          No classes yet. Create your first one above.
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
          <div
            key={c.id}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Class header */}
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 truncate">
                  {c.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {c.lectures.length} lecture{c.lectures.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Class code
                </p>
                <p className="font-mono tabular-nums text-xl font-bold tracking-widest text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1">
                  {c.code}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 pb-4">
              <button
                type="button"
                onClick={() => setOpenQrClassId(showQr ? null : c.id)}
                className={`text-sm rounded-lg px-3 py-1.5 font-medium border transition ${
                  showQr
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {showQr ? "Hide QR" : "QR & Join Link"}
              </button>
              <button
                type="button"
                onClick={() => toggleHistory(c.id)}
                className={`text-sm rounded-lg px-3 py-1.5 font-medium border transition ${
                  showHistory
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {showHistory ? "Hide History Chart" : "Confusion History"}
              </button>
              {!confirming && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(c.id)}
                  className="ml-auto text-sm rounded-lg px-3 py-1.5 font-medium border border-red-200 text-red-600 hover:bg-red-50 transition"
                >
                  Delete class
                </button>
              )}
            </div>

            {/* Delete confirmation */}
            {confirming && (
              <div className="px-4 sm:px-5 pb-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-red-800">
                    Delete <span className="font-semibold">&ldquo;{c.name}&rdquo;</span>?
                    This permanently removes its lectures, doubts and explanations,
                    and the class code <span className="font-mono">{c.code}</span> will
                    stop working. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-sm border border-slate-300 bg-white text-slate-700 rounded-lg px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => deleteClass(c.id)}
                      className="text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 font-semibold disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, delete class"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code & Join Link Panel */}
            {showQr && (
              <div className="px-4 sm:px-5 pb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0">
                    <QRCodeSVG value={joinUrl} size={140} />
                  </div>
                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                      Scan to post doubts anonymously
                    </p>
                    <p className="font-mono text-sm text-slate-800 break-all bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      {joinUrl}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => copyJoinUrl(c.code)}
                        className="text-sm bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700"
                      >
                        {copiedCode === c.code ? "Copied!" : "Copy Join Link"}
                      </button>
                      <Link
                        href={`/join/${c.code}`}
                        target="_blank"
                        className="text-sm border border-slate-300 bg-white text-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                      >
                        Open Student View &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lecture-wise Confusion History Chart (Recharts) */}
            {showHistory && (
              <div className="px-4 sm:px-5 pb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-600">
                    Lecture-wise Confusion History
                  </p>
                  {loadingHistory === c.id ? (
                    <p className="text-xs text-slate-500 py-4">Loading chart...</p>
                  ) : chartRows.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      No lecture history available yet.
                    </p>
                  ) : (
                    <div className="h-60 w-full">
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
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
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

            {/* Lectures */}
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                Lectures
              </p>

              {c.lectures.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No lectures yet. Add your first one below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {c.lectures.map((l, i) => (
                    <li key={l.id}>
                      <Link
                        href={`/teacher/lecture/${l.id}`}
                        className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition"
                      >
                        <span className="min-w-0 flex items-center gap-2">
                          <span className="font-medium text-slate-900 truncate">
                            {l.title}
                          </span>
                          {i === 0 && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                              Latest
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-medium text-indigo-600">
                          Open board &rarr;
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  value={lectureTitles[c.id] ?? ""}
                  onChange={(e) =>
                    setLectureTitles((t) => ({ ...t, [c.id]: e.target.value }))
                  }
                  placeholder="New lecture, e.g. Lecture 7 - Normalization"
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => addLecture(c.id)}
                  className="border border-slate-300 bg-white hover:bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Add lecture
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
