/* app/admin/student/[uid]/overview/page.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDoc, getDocs, orderBy, query, doc } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";

/* ---------------- helpers ---------------- */
function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function num(v: unknown) {
  const s = toText(v).trim();
  if (!s) return 0;
  const m = s.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function parseDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function getDayName(dateKey?: string) {
  if (!dateKey) return "";
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue
}

function getMonthLabel(dateKey?: string) {
  if (!dateKey) return "";
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function diffDaysInclusive(startKey: string, endKey: string) {
  function getDayName(dateKey?: string) {
  if (!dateKey) return "";
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getMonthLabel(dateKey?: string) {
  if (!dateKey) return "";
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days) + 1; // inclusive
}

type LogRow = {
  id: string;
  dateKey?: string;

  sabak?: string;
  sabakRead?: string;
  sabakReadNotes?: string;

  sabakDhor?: string;
  sabakDhorRead?: string;
  sabakDhorReadNotes?: string;

  dhor?: string;
  dhorRead?: string;
  dhorReadNotes?: string;

  weeklyGoal?: string;

  sabakDhorMistakes?: string;
  dhorMistakes?: string;

  weeklyGoalStartDateKey?: string;
  weeklyGoalCompletedDateKey?: string;
  weeklyGoalDurationDays?: number | string;
};

async function fetchLogs(uid: string): Promise<LogRow[]> {
  const q = query(collection(db, "users", uid, "logs"), orderBy("dateKey", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur">
      {children}
    </span>
  );
}

/* ---------------- page ---------------- */
export default function AdminStudentOverviewPage() {
  const params = useParams<{ uid: string }>();
  const studentUid = params.uid;

  const [me, setMe] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

const [studentName, setStudentName] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setMe(u);

      if (!u) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      try {
        const myDoc = await getDoc(doc(db, "users", u.uid));
        const role = myDoc.exists() ? (myDoc.data() as any).role : null;
        setIsAdmin(role === "admin");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadStudentMeta() {
      const sDoc = await getDoc(doc(db, "users", studentUid));
      if (sDoc.exists()) {
        const data = sDoc.data() as any;
setStudentName(
  toText(data.username) || toText(data.email) || "Student"
);      }
    }

    async function loadLogs() {
      setLoadingRows(true);
      try {
        const data = await fetchLogs(studentUid);
        setRows(data);
      } finally {
        setLoadingRows(false);
      }
    }

    if (studentUid) {
      loadStudentMeta();
      loadLogs();
    }
  }, [studentUid]);

  const summary = useMemo(() => {
    if (!rows.length) return { totalDays: 0, avgSabak: 0, lastGoal: 0 };
    const sabakNums = rows.map((r) => num(r.sabak)).filter((n) => n > 0);
    const avgSabak =
      sabakNums.length ? sabakNums.reduce((a, b) => a + b, 0) / sabakNums.length : 0;
    const lastGoal = num(rows[0]?.weeklyGoal);
    return { totalDays: rows.length, avgSabak, lastGoal };
  }, [rows]);

  if (checking) {
    return (
      <main className="min-h-screen">
        <FancyBg />
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-8 shadow-sm">
            Loading…
          </div>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen">
        <FancyBg />
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-10 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">Please sign in</h1>
            <p className="mt-3 text-gray-700">You must sign in to view this student overview.</p>
            <div className="mt-6 flex gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900"
              >
                Sign In
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur text-sm font-medium hover:bg-white"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen">
        <FancyBg />
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
          <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-10 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">Not allowed</h1>
            <p className="mt-3 text-gray-700">This account is not an admin.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/" className="underline">
                Home
              </Link>
              <Link href="/admin" className="underline">
                Admin
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-gray-900">
      <FancyBg />

      <header className="max-w-6xl mx-auto px-6 sm:px-10 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-black text-white grid place-items-center shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="M8 7V4m8 3V4M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm text-gray-600">Student Overview</div>
            <div className="text-xl font-semibold tracking-tight truncate">
              {studentName || "Student"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/student/${studentUid}`}
            className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900"
          >
            Log Work
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur text-sm font-medium hover:bg-white"
          >
            Back
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 sm:px-10 pb-16">
        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Days logged" value={String(summary.totalDays)} />
          <StatCard label="Average Sabak" value={summary.avgSabak ? summary.avgSabak.toFixed(1) : "—"} />
          <StatCard label="Latest weekly goal" value={summary.lastGoal ? String(summary.lastGoal) : "—"} />
        </div>

        <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="uppercase tracking-widest text-xs text-[#B8963D]">History table</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Student daily logs</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>Admin view</Badge>
              <Badge>Newest → oldest</Badge>
              <Badge>Goal duration</Badge>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {loadingRows ? (
              <div className="text-gray-700">Loading logs…</div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-gray-300 bg-white/70 p-6">
                <div className="text-lg font-semibold">No logs yet</div>
                <p className="mt-2 text-gray-700">Once the student has entries, they will show here.</p>
                <div className="mt-4">
                  <Link
                    href={`/admin/student/${studentUid}`}
                    className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900"
                  >
                    Log first entry
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 pr-4 pl-2 border-b border-gray-300">
                        Day
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 pr-4 pl-2 border-b border-gray-300">
                        Date
                      </th>

                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Sabak
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Read
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
  Notes
</th>

                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Sabak Dhor
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Read
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
  Notes
</th>

                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Dhor
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Read
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
  Notes
</th>

                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        SD Mistakes
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        D Mistakes
                      </th>

                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Weekly Goal
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Goal Status
                      </th>
                      <th className="sticky top-0 bg-white/70 backdrop-blur-xl backdrop-blur pb-3 px-4 border-b border-gray-300 border-l border-gray-100">
                        Duration
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {rows.map((r, index) => {
                    const currentMonth = getMonthLabel(r.dateKey);
                    const prevMonth =
                    index > 0 ? getMonthLabel(rows[index - 1].dateKey) : null;

                    const showMonthHeader = index === 0 || currentMonth !== prevMonth;
                      const g = num(r.weeklyGoal);

                      const startKey = toText(r.weeklyGoalStartDateKey);
                      const completedKey = toText(r.weeklyGoalCompletedDateKey);

                      const storedDur =
                        typeof r.weeklyGoalDurationDays === "number"
                          ? r.weeklyGoalDurationDays
                          : toText(r.weeklyGoalDurationDays)
                          ? Number(r.weeklyGoalDurationDays)
                          : null;

                      const calcDur =
                        startKey && completedKey ? diffDaysInclusive(startKey, completedKey) : null;

                      const duration = storedDur ?? calcDur;
                      const completed = Boolean(completedKey) || (duration ?? 0) > 0;

                      return (
                          <>
                      {showMonthHeader && (
                      <tr>
                      <td
                         colSpan={16}
                         className="bg-gradient-to-r from-[#B8963D]/15 to-transparent text-sm font-semibold text-gray-900 py-4 px-4 uppercase tracking-wider"
                        >
                       {currentMonth}
                          </td>
                              </tr>
                          )}
                        
                        <tr key={r.id} className="text-sm hover:bg-black/[0.02] transition-colors">
                          <td className="py-4 pr-4 pl-2 font-medium text-gray-600">
                        {getDayName(r.dateKey)}
                        </td>
                          <td className="py-4 pr-4 pl-2 font-medium text-gray-900">
                            {r.dateKey ?? r.id}
                          </td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.sabak) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100">
                            {toText(r.sabakRead) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100 max-w-[200px]">
  {toText(r.sabakReadNotes) || "—"}
</td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.sabakDhor) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100">
                            {toText(r.sabakDhorRead) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100 max-w-[200px]">
  {toText(r.sabakDhorReadNotes) || "—"}
</td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.dhor) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100">
                            {toText(r.dhorRead) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-700 border-l border-gray-100 max-w-[200px]">
  {toText(r.dhorReadNotes) || "—"}
</td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.sabakDhorMistakes) || "—"}
                          </td>
                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.dhorMistakes) || "—"}
                          </td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {toText(r.weeklyGoal) || "—"}
                          </td>

                          <td className="py-4 px-4 border-l border-gray-100">
                            {g > 0 ? (
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${
                                  completed
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    completed ? "bg-emerald-500" : "bg-amber-500"
                                  }`}
                                />
                                {completed ? "Completed" : "In progress"}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">No goal set</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-gray-800 border-l border-gray-100">
                            {duration ? `${duration} day(s)` : "—"}
                          </td>
                        </tr>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------------- UI bits ---------------- */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#B8963D] via-[#B8963D]/60 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B8963D]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</div>
    </div>
  );
}

function FancyBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      {/* Clean luxury base */}
      <div className="absolute inset-0 bg-[#F8F6F1]" />

      {/* Deep contrast blobs */}
      <div className="absolute -top-72 -right-40 h-[900px] w-[900px] rounded-full bg-[#1F3F3F]/25 blur-3xl" />
      <div className="absolute bottom-[-25%] left-[-15%] h-[1000px] w-[1000px] rounded-full bg-[#B8963D]/20 blur-3xl" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(1000px_circle_at_70%_20%,rgba(184,150,61,0.15),transparent_60%)]" />

      {/* Elegant vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_10%,transparent_50%,rgba(0,0,0,0.08))]" />

      {/* Premium grain texture (make sure noise.png is in /public) */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-multiply bg-[url('/noise.png')]" />
    </div>
  );
}
