"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

/* ---------------- PWA Install Prompt (ALWAYS shows until installed) ---------------- */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as any).standalone === true;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  const displayModeStandalone = mql ? mql.matches : false;
  return iosStandalone || displayModeStandalone;
}

function InstallAppPrompt() {
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  // Shows on every visit until installed (but if they close it, we wait a short cooldown)
  const DISMISS_KEY = "pwa_install_dismissed_at";
  const DISMISS_COOLDOWN_HOURS = 6;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ios = isIosDevice();
    setIsIOS(ios);

    const standaloneNow = isStandaloneMode();
    setStandalone(standaloneNow);

    if (standaloneNow) {
      setOpen(false);
      return;
    }

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || "0");
    const hoursSince = dismissedAt ? (Date.now() - dismissedAt) / (1000 * 60 * 60) : 999;

    // iOS: no native prompt; always show our instructions
    if (ios) {
      if (hoursSince >= DISMISS_COOLDOWN_HOURS) setOpen(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (hoursSince >= DISMISS_COOLDOWN_HOURS) setOpen(true);
    };

    const onInstalled = () => {
      setOpen(false);
      setDeferred(null);
      localStorage.removeItem(DISMISS_KEY);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // Some browsers (incl. some Huawei) don't fire beforeinstallprompt.
    // Still show the modal with manual instructions.
    if (hoursSince >= DISMISS_COOLDOWN_HOURS) setOpen(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return; // show manual instructions in UI
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;

      if (choice.outcome === "accepted") {
        setOpen(false);
        localStorage.removeItem(DISMISS_KEY);
      } else {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setOpen(false);
      }
    } catch {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setOpen(false);
    }
  }

  function handleClose() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  if (standalone) return null;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/30 bg-white/75 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#B8963D]/18 blur-3xl" />
          <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#B8963D]">Install App</div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-gray-900">
                Add the Hifdh Journal App to your Home Screen
              </h3>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 h-10 w-10 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors grid place-items-center"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M6 6l12 12M18 6l-12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {isIOS ? (
            <div className="mt-5 rounded-2xl border border-gray-300 bg-white/70 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">On iPhone / iPad (Safari):</div>
              <ol className="mt-2 space-y-1 list-decimal list-inside">
                <li>Tap the <span className="font-semibold">Share</span> button</li>
                <li>Select <span className="font-semibold">Add to Home Screen</span></li>
                <li>Tap <span className="font-semibold">Add</span></li>
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-gray-300 bg-white/70 p-4 text-sm text-gray-700">
              {deferred ? (
                <div>
                  Tap <span className="font-semibold">Install</span> to add it to your Home Screen.
                </div>
              ) : (
                <div>
                  A calm, focused space for daily Qur’an progress.
                  <div className="mt-2 text-xs text-gray-600">
              
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {!isIOS ? (
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 h-12 rounded-2xl bg-black text-white font-semibold hover:bg-gray-900 transition-colors disabled:opacity-60"
                disabled={!deferred}
              >
                Install
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-12 rounded-2xl border border-gray-300 bg-white/70 hover:bg-white transition-colors font-semibold"
            >
              Not now
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            This message will keep showing until the app is installed.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ✅ Icons */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6l-12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ✅ Fancy icon for menu rows */
function DotArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 12h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-2xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-5 shadow-sm hover:shadow-md transition-shadow"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-6">
        <h4 className="text-lg font-semibold text-gray-900">{question}</h4>
        <span className="flex items-center gap-3 text-[#B8963D]">
          <span className="hidden sm:inline text-sm font-medium">{open ? "Close" : "Open"}</span>
          <span className="grid place-items-center h-10 w-10 rounded-full bg-[#B8963D]/10 text-[#B8963D]">
            <ChevronIcon open={open} />
          </span>
        </span>
      </div>

      <div
        className={`grid transition-all duration-400 ease-out ${
          open ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-gray-700 leading-relaxed">{answer}</p>
        </div>
      </div>
    </button>
  );
}

function FeatureCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#B8963D]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-black text-white grid place-items-center shadow-sm">
          {icon}
        </div>
        <div>
          <h4 className="text-2xl font-semibold mb-2">{title}</h4>
          <p className="text-gray-700 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

/* ✅ Fancy reusable menu row (with glow + arrow) */
function MenuRow({
  href,
  label,
  sub,
  onClick,
  variant = "default",
}: {
  href: string;
  label: string;
  sub?: string;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  const base =
    "group relative overflow-hidden rounded-2xl border px-4 py-4 text-sm font-semibold transition-all duration-300";
  const primary = "border-black bg-[#111111] text-white hover:bg-[#1c1c1c] shadow-lg shadow-black/10 shadow-sm";
  const normal = "border-gray-300 bg-white/70 text-gray-900 hover:bg-white shadow-sm";

  return (
    <Link href={href} onClick={onClick} className={`${base} ${variant === "primary" ? primary : normal}`}>
      <div
        className={`pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          variant === "primary" ? "bg-white/15" : "bg-[#B8963D]/14"
        }`}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base leading-tight">{label}</div>
          {sub ? (
            <div className={`mt-1 text-xs font-medium ${variant === "primary" ? "text-white/70" : "text-gray-600"}`}>
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={`grid place-items-center h-10 w-10 rounded-full transition-all duration-300 ${
            variant === "primary" ? "bg-white/10 text-white" : "bg-[#B8963D]/10 text-[#B8963D]"
          } group-hover:scale-[1.04]`}
        >
          <DotArrowIcon />
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  /* ✅ mobile menu state */
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuState, setMenuState] = useState<"open" | "closed">("closed");

  // ✅ Track auth state to show correct links
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAdmin(false);

      if (!u) return;

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const role = snap.exists() ? (snap.data() as any).role : null;
        setIsAdmin(role === "admin");
      } catch {
        setIsAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  const footerLinks = useMemo(
    () => [
      { label: "Home", href: "/" },
      { label: "About", href: "#about" },
      { label: "FAQ", href: "#faq" },
      { label: "Sign In", href: "/login" },
      { label: "Enrol (Sign Up)", href: "/signup" },
    ],
    []
  );

  function closeMenu() {
    setMenuState("closed");
    setTimeout(() => setMobileOpen(false), 650);
  }

  return (
    <main id="top" className="min-h-screen bg-transparent text-gray-900">
      {/* ✅ ALWAYS-ON install prompt until installed */}
      <InstallAppPrompt />
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

  {/* 🔥 Premium grain texture (ADD THIS LAST) */}
  <div className="absolute inset-0 opacity-[0.03] mix-blend-multiply bg-[url('/noise.png')]" />
</div>

      {/* NAVBAR */}
      <header className="max-w-7xl mx-auto px-6 sm:px-10 py-7 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-[80px] w-[85px] rounded-xl bg-white/100 backdrop-blur border border-gray-300 shadow-sm grid place-items-center">
            <Image src="/logo4.png" alt="Hifdh Journal" width={58} height={58} className="rounded" priority />
          </div>
        </div>

        {/* ✅ Desktop actions */}
        <div className="hidden lg:flex items-center gap-3">

          {user ? (
            <>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium text-gray-900 hover:bg-white/70 backdrop-blur-xl transition-colors"
                >
                  Admin Dashboard
                </Link>
              ) : null}

             
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium text-gray-900 hover:bg-white/70 backdrop-blur-xl transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900 shadow-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* ✅ Burger (mobile) */}
        <button
          type="button"
          onClick={() => {
            setMobileOpen(true);
            requestAnimationFrame(() => setMenuState("open"));
          }}
          className="lg:hidden relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-300 bg-white/70 backdrop-blur shadow-sm hover:bg-white transition-colors"
          aria-label="Open menu"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5" />
          <MenuIcon />
        </button>
      </header>

      {/* ✅ Fancy Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={closeMenu}
            className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-[650ms] ease-out ${
              menuState === "open" ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-white/40 bg-white/75 backdrop-blur-2xl shadow-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
              menuState === "open" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#B8963D]/18 blur-3xl" />
              <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#2f6f6f]/12 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_70%_10%,rgba(156,124,56,0.14),transparent_55%)]" />
            </div>

            <div className="relative p-6 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-[80px] w-[85px] rounded-xl bg-white/100 backdrop-blur border border-gray-300 shadow-sm grid place-items-center">
                    <Image src="/logo4.png" alt="Hifdh Journal" width={58} height={58} className="rounded" priority />
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight"> The Hifdh Journal</div>
                    <div className="text-xs text-gray-700">Menu</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors shadow-sm"
                  aria-label="Close menu"
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5" />
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl px-4 py-3 shadow-sm">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#B8963D]">Status</div>
                  <div className="text-sm font-semibold text-gray-900">{user ? "Signed in" : "Guest"}</div>
                </div>

                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${
                    user
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white/70 backdrop-blur-xl text-gray-700"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${user ? "bg-emerald-500" : "bg-[#B8963D]"}`} />
                  {user ? "Active" : "Not logged in"}
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <MenuRow href="/" label="Home" sub="Back to the main page" onClick={closeMenu} />
                <MenuRow href="#about" label="About" sub="About the system" onClick={closeMenu} />
                <MenuRow href="#faq" label="FAQ" sub="Common questions" onClick={closeMenu} />
                <div className="my-1 h-px bg-gray-200/80" />

                {user ? (
                  <>
                    {isAdmin ? (
                      <MenuRow href="/admin" label="Admin Dashboard" sub="Manage students" onClick={closeMenu} />
                    ) : null}
                  </>
                ) : (
                  <>
                    <MenuRow href="/login" label="Sign In" sub="Continue your journey" onClick={closeMenu} />
                    <MenuRow
                      href="/signup"
                      label="Sign Up"
                      sub="Create student account"
                      onClick={closeMenu}
                      variant="primary"
                    />
                  </>
                )}
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl px-5 py-4 shadow-sm">
                  <div className="text-xs uppercase tracking-widest text-[#B8963D]">Quick tip</div>
                  <div className="mt-1 text-sm text-gray-700">Add this site to your home screen.</div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                  <span>© {new Date().getFullYear()} Hifdh Journal</span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-full border border-gray-300 bg-white/70 backdrop-blur-xl px-3 py-1.5 hover:bg-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-10 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur px-4 py-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-[#B8963D]" />
              <span className="text-gray-800">The Hifdh Journal</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight">
              Preserve the Qur’an.
              <br />
              <span className="text-[#1F3F3F]">Elevate the Heart.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-800 leading-relaxed max-w-2xl">
              Welcome to the Hifdh Journal — a journey of memorisation, discipline,
              and spiritual growth. Track your daily Sabak, Dhor, Sabak Dhor and weekly goals — all
              in one place.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
             {user ? (
    isAdmin ? (
      // ✅ Admin buttons
      <>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-gray-300 bg-white/40 backdrop-blur text-base font-medium hover:bg-white/70 transition-colors"
        >
          Admin Dashboard
        </Link>
      </>
    ) : (
      // ✅ Student button
      <Link
        href="/overview"
        className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
      >
        My Overview
      </Link>
    )
  ) : (
    // ✅ Guest buttons
    <>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
      >
        Begin My Journey
      </Link>
      <a
        href="#about"
        className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-gray-300 bg-white/40 backdrop-blur text-base font-medium hover:bg-white/70 transition-colors"
      >
        Explore Program
      </a>
    </>
  )}
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl items-stretch">
              {[
                {
                  k: "Sabak",
                  v: "Daily memorisation",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path
                        d="M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
                {
                  k: "Dhor",
                  v: "Strong retention",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ),
                },
                {
                  k: "Targets",
                  v: "Weekly clarity",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path
                        d="M9 11l3 3L22 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div
                  key={item.k}
                  className="group relative overflow-hidden rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur px-5 py-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-[88px] flex items-center"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#B8963D] via-[#B8963D]/60 to-transparent" />
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B8963D]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-black text-white grid place-items-center shadow-sm">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm text-gray-700">{item.k}</div>
                      <div className="mt-0.5 font-semibold text-gray-900">{item.v}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid gap-6">
            <div className="rounded-3xl border border-gray-300 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur p-8 shadow-lg">
              <p className="text-xl leading-relaxed italic">
                “And We have certainly made the Qur’an easy for remembrance, so is there any who
                will remember?”
              </p>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-gray-600">Surah Al-Qamar • 54:17</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-300 bg-black text-white p-8 shadow-xl relative overflow-hidden">
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#B8963D]/25 blur-2xl" />
              <h3 className="mt-1 text-2xl font-semibold">Preview: Student Dashboard</h3>
              <p className="mt-3 text-white/70 leading-relaxed">
                Secure login. Daily submissions. Weekly goals. A calm system designed for focus —
                not distraction.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {["Sabak", "Sabak Dhor", "Dhor", "Weekly Goal"].map((t) => (
                  <div key={t} className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                    <div className="text-sm text-white/80">{t}</div>
                    <div className="mt-1 text-sm font-semibold">—</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur p-10 shadow-sm">
            <p className="uppercase tracking-widest text-sm text-[#B8963D] mb-3">About the Hifdh Journal</p>

            <h2 className="text-4xl font-semibold tracking-tight">Clarity, Consistency, and Accountability in Hifdh</h2>

            <div className="mt-6 grid md:grid-cols-2 gap-8">
              <p className="text-gray-800 leading-relaxed text-lg">
A structured and organised platform designed to track and manage Hifdh progress with clarity and consistency.

Through focused Sabak tracking, Dhor monitoring, weekly targets, and personalised notes, the system ensures steady memorisation progress while promoting discipline and accountability.              </p>
             
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-12 pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="uppercase tracking-widest text-sm text-[#5E4A1D]">Program Highlights</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">Designed for Consistency & Excellence</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="Structured Memorisation"
              text="Daily Sabak and guided Dhor routines help students progress steadily with strong retention."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <FeatureCard
              title="Weekly Accountability"
              text="Clear weekly targets make progress measurable and keep students motivated and consistent."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M8 7V4m8 3V4M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
            <FeatureCard
              title="Progress System"
              text="The Ustadh logs in and submits the student's Sabak, Dhor, sabak dhor and weekly goal progress."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <div className="text-center mb-12">
            <p className="uppercase tracking-widest text-sm text-[#5E4A1D]">Questions & Answers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="What makes this system more effective than simple tracking?"
              answer="Unlike basic record-keeping, this system combines progress tracking, structured targets, and performance notes in one place — creating a complete overview that supports both discipline and steady improvement."
            />
            <FAQItem
              question="Does it replace manual record-keeping?"
              answer="Yes. Instead of using notebooks, everything is organised and securely stored in one structured digital system."
            />
            <FAQItem
              question="How does the system support long-term Hifdh goals?"
              answer="By combining daily tracking, revision monitoring, and structured targets, the system encourages steady progress and long-term memorisation retention."
            />
            <FAQItem
              question="How will this system improve memorisation consistency?"
              answer="The system creates clear daily and weekly structure through Sabak and Dhor tracking, helping maintain discipline and preventing gaps in revision."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="rounded-3xl border border-gray-300 bg-gradient-to-br from-white/70 to-white/40 backdrop-blur p-10 shadow-lg overflow-hidden relative">
            <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-[#B8963D]/15 blur-3xl" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />

            <div className="grid md:grid-cols-12 gap-10 items-center relative">
              <div className="md:col-span-8">
                <p className="uppercase tracking-widest text-sm text-[#B8963D]">Ready to begin?</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight">
                  Enrol and start tracking your Hifdh journey today
                </h2>
                <p className="mt-4 text-gray-800 text-lg leading-relaxed">
                  A focused system for daily Sabak, consistent Dhor, and weekly targets — built for clarity, discipline, and steady progress.
                </p>
              </div>

              <div className="md:col-span-4 flex md:justify-end gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-gray-300 bg-white/50 backdrop-blur text-base font-medium hover:bg-white/80 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-4">
               <div className="h-[80px] w-[85px] rounded-xl bg-white/100 backdrop-blur border border-gray-300 shadow-sm grid place-items-center">
            <Image src="/logo4.png" alt="Hifdh Journal" width={58} height={58} className="rounded" priority />
          </div>
                <div>
                  <div className="font-semibold text-lg">The Hifdh Journal</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-4">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-gray-700 hover:text-black">Home</a>
                    <a href="#about" className="block text-sm text-gray-700 hover:text-black">About</a>
                    <a href="#faq" className="block text-sm text-gray-700 hover:text-black">FAQ</a>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-4">Portal</div>
                  <div className="space-y-3">
                    <a href="/login" className="block text-sm text-gray-700 hover:text-black">Sign In</a>
                    <a href="/signup" className="block text-sm text-gray-700 hover:text-black">Enrol (Sign Up)</a>
                    {user && isAdmin ? (
                      <a href="/admin" className="block text-sm text-gray-700 hover:text-black">
                        Admin Dashboard
                      </a>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-4">Program</div>
                  <div className="space-y-3">
                    <a href="#about" className="block text-sm text-gray-700 hover:text-black">Structure</a>
                    <a href="/signup" className="block text-sm text-gray-700 hover:text-black">Enrolment</a>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border border-gray-300 bg-gradient-to-br from-white/70 to-white/40 backdrop-blur p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-[#B8963D]">Student Portal</div>
                    <div className="mt-1 font-semibold text-lg">Ready to begin your journey?</div>
                    <div className="mt-1 text-sm text-gray-700">Sign up and start tracking daily progress.</div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/signup"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900"
                    >
                      Enrol Now
                    </a>
                    <a
                      href="/login"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors text-sm font-medium"
                    >
                      Sign In
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-gray-200" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <a href="#top" className="hover:text-black">Back to top ↑</a>
              <span className="text-gray-300">|</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
