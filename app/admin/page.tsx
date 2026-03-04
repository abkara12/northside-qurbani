"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type StudentOption = { uid: string; username: string };

function getDateKeySA() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const d = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${d}`;
}

function PageShell({
  children,
  title,
  subtitle,
  rightSlot,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen text-gray-900">
      {/* Background (matches your site vibe) */}
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

  {/* Noise */}
  <div className="absolute inset-0 opacity-[0.035] mix-blend-multiply bg-[url('/noise.png')]" />
</div>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="uppercase tracking-widest text-xs text-[#B8963D]">
              Admin Portal
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-gray-700 leading-relaxed max-w-2xl">
                {subtitle}
              </p>
            ) : null}
          </div>

          {rightSlot ? (
            <div className="shrink-0">{rightSlot}</div>
          ) : null}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur p-6 shadow-sm">
      <div className="h-4 w-28 bg-black/10 rounded-full animate-pulse" />
      <div className="mt-3 h-8 w-2/3 bg-black/10 rounded-2xl animate-pulse" />
      <div className="mt-6 grid gap-3">
        <div className="h-12 w-full bg-black/10 rounded-2xl animate-pulse" />
        <div className="h-12 w-full bg-black/10 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string>("");

  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => getDateKeySA(), []);

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
    async function loadStudents() {
      if (!isAdmin) return;

      setLoadingStudents(true);
      setErr(null);

      try {
        // Requires composite index (role + email) which you already created
        const qy = query(
          collection(db, "users"),
          where("role", "==", "student"),
          orderBy("username")
        );

        const snap = await getDocs(qy);
       const list: StudentOption[] = snap.docs.map((d) => {
  const data = d.data() as any;
  return {
    uid: d.id,
    username: (data.username || data.email || "Unnamed").toString(),
  };
});

        setStudents(list);

        // auto-select first (nice UX)
        if (!selectedUid && list.length > 0) {
          setSelectedUid(list[0].uid);
        }
      } catch (e: any) {
        setErr(e?.message ?? "Could not load students.");
      } finally {
        setLoadingStudents(false);
      }
    }

    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Smooth loading: do NOT show “not admin” until checking is done
  if (checking) {
    return (
      <PageShell title="Loading…" subtitle="Just a moment.">
        <SkeletonCard />
      </PageShell>
    );
  }

  if (!me) {
    return (
      <PageShell
        title="Please sign in"
        subtitle="You need to be signed in as the admin to manage students."
        rightSlot={
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors text-sm font-semibold"
          >
            Home
          </Link>
        }
      >
        <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-7 shadow-sm">
          <p className="text-gray-700">
            Go to login, then come back to the admin dashboard.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-semibold hover:bg-gray-900"
            >
              Go to login
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-gray-300 bg-white/70 hover:bg-white text-sm font-semibold"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell
        title="Access denied"
        subtitle='This account is not marked as admin in Firestore. (It needs role: "admin")'
        rightSlot={
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors text-sm font-semibold"
          >
            Home
          </Link>
        }
      >
        <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-7 shadow-sm">
          <div className="text-sm text-gray-600">Signed in as</div>
          <div className="mt-1 font-semibold">{me.email}</div>

          <div className="mt-5 text-sm text-gray-700">
            In Firestore → <code className="font-mono">users/{me.uid}</code> set{" "}
            <code className="font-mono">role</code> to{" "}
            <code className="font-mono">"admin"</code>.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
      
            <Link
              href="/"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-gray-300 bg-white/70 hover:bg-white text-sm font-semibold"
            >
              Home
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle={`Select a student, then log their work for today (${today}).`}
      rightSlot={
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors text-sm font-semibold"
        >
          Home
        </Link>
      }
    >
      <div className="grid gap-6">
        <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Student selection</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">
                Choose a student
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/70 px-4 py-2 text-xs font-semibold text-gray-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Admin active
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="text-sm font-semibold text-gray-900">
              Students
            </label>

            <div className="relative">
              <select
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                className="w-full h-12 rounded-2xl border border-gray-300 bg-white/80 px-4 pr-10 outline-none focus:ring-2 focus:ring-[#B8963D]/30"
                disabled={loadingStudents}
              >
                {loadingStudents ? (
                  <option>Loading students…</option>
                ) : students.length === 0 ? (
                  <option>No students found</option>
                ) : (
                  students.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.username}
                    </option>
                  ))
                )}
              </select>

              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                ▼
              </div>
            </div>

            {err ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href={selectedUid ? `/admin/student/${selectedUid}` : "/admin"}
                className={`inline-flex items-center justify-center h-12 px-6 rounded-2xl text-sm font-semibold transition-colors shadow-sm ${
                  selectedUid
                    ? "bg-[#111111] text-white hover:bg-[#1c1c1c] shadow-lg shadow-black/10"
                    : "bg-black/40 text-white cursor-not-allowed"
                }`}
                aria-disabled={!selectedUid}
                onClick={(e) => {
                  if (!selectedUid) e.preventDefault();
                }}
              >
                Log work for student →
              </Link>

              <Link
                href={
                  selectedUid
                    ? `/admin/student/${selectedUid}/overview`
                    : "/admin"
                }
                className={`inline-flex items-center justify-center h-12 px-6 rounded-2xl border text-sm font-semibold transition-colors ${
                  selectedUid
                    ? "border-gray-300 bg-white/70 hover:bg-white"
                    : "border-gray-300 bg-white/40 text-gray-500 cursor-not-allowed"
                }`}
                aria-disabled={!selectedUid}
                onClick={(e) => {
                  if (!selectedUid) e.preventDefault();
                }}
              >
                View student overview
              </Link>
            </div>
          </div>
        </div>

        {/* Optional small footer note (clean + not boring) */}
        <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">
            Tip for faster workflow
          </div>
          <p className="mt-1 text-sm text-gray-700">
            Keep this page open on your phone. Select the student → log work →
            save → next student.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

