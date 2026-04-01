"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

/* ---------------- PWA Install Prompt ---------------- */
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

    if (hoursSince >= DISMISS_COOLDOWN_HOURS) setOpen(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;

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
                Add Qurbani Management to your Home Screen
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
                  Quick access for staff managing orders and Qurbani day updates.
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
            Install for faster access during busy Qurbani operations.
          </div>
        </div>
      </div>
    </div>
  );
}

/* Icons */
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuState, setMenuState] = useState<"open" | "closed">("closed");

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
        setIsAdmin(role === "admin" || role === "staff");
      } catch {
        setIsAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  function closeMenu() {
    setMenuState("closed");
    setTimeout(() => setMobileOpen(false), 650);
  }

  return (
    <main id="top" className="min-h-screen bg-transparent text-gray-900">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#F8F6F1]" />
        <div className="absolute -top-72 -right-40 h-[900px] w-[900px] rounded-full bg-[#1F3F3F]/25 blur-3xl" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[1000px] w-[1000px] rounded-full bg-[#B8963D]/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_circle_at_70%_20%,rgba(184,150,61,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_10%,transparent_50%,rgba(0,0,0,0.08))]" />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-multiply bg-[url('/noise.png')]" />
      </div>

      <header className="max-w-7xl mx-auto px-6 sm:px-10 py-7 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-[80px] w-[85px] rounded-xl bg-white/100 border border-gray-300 shadow-sm grid place-items-center">
            <Image
              src="/logo4.png"
              alt="Qurbani Management System"
              width={58}
              height={58}
              className="rounded"
              priority
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-lg font-semibold leading-tight">Qurbani Management</div>
            <div className="text-sm text-gray-600">Orders. Tracking. Collection.</div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <a
            href="#about"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium text-gray-900 hover:bg-white/70 transition-colors"
          >
            About
          </a>
          <a
            href="#faq"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium text-gray-900 hover:bg-white/70 transition-colors"
          >
            FAQ
          </a>

          {user ? (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900 shadow-sm"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full text-sm font-medium text-gray-900 hover:bg-white/70 transition-colors"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900 shadow-sm"
              >
                Place Order
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen(true);
            requestAnimationFrame(() => setMenuState("open"));
          }}
          className="lg:hidden relative inline-flex items-center justify-center h-11 w-11 rounded-full border border-gray-300 bg-white/70 shadow-sm hover:bg-white transition-colors"
          aria-label="Open menu"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5" />
          <MenuIcon />
        </button>
      </header>

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
            </div>

            <div className="relative p-6 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-[80px] w-[85px] rounded-xl bg-white/100 border border-gray-300 shadow-sm grid place-items-center">
                    <Image
                      src="/logo4.png"
                      alt="Qurbani Management"
                      width={58}
                      height={58}
                      className="rounded"
                      priority
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight">Qurbani Management</div>
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

              <div className="mt-6 grid gap-3">
                <MenuRow href="/" label="Home" sub="Back to the main page" onClick={closeMenu} />
                <MenuRow href="#about" label="About" sub="How the system works" onClick={closeMenu} />
                <MenuRow href="#faq" label="FAQ" sub="Common questions" onClick={closeMenu} />

                <div className="my-1 h-px bg-gray-200/80" />

                {user ? (
                  <MenuRow
                    href="/admin"
                    label="Dashboard"
                    sub="Manage orders and statuses"
                    onClick={closeMenu}
                    variant="primary"
                  />
                ) : (
                  <>
                    <MenuRow href="/login" label="Staff Sign In" sub="Access admin dashboard" onClick={closeMenu} />
                    <MenuRow
                      href="/order"
                      label="Place Order"
                      sub="Submit your Qurbani order"
                      onClick={closeMenu}
                      variant="primary"
                    />
                  </>
                )}
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-3xl border border-gray-300 bg-white/70 px-5 py-4 shadow-sm">
                  <div className="text-xs uppercase tracking-widest text-[#B8963D]">Quick tip</div>
                  <div className="mt-1 text-sm text-gray-700">
                    Staff can add this app to the home screen for quicker access on Qurbani day.
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                  <span>© {new Date().getFullYear()} Qurbani Management</span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-full border border-gray-300 bg-white/70 px-3 py-1.5 hover:bg-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-10 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/70 px-4 py-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-[#B8963D]" />
              <span className="text-gray-800">Digital Qurbani Operations</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight">
              A smoother,
              <br />
              <span className="text-[#1F3F3F]">more organised Qurbani day.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-800 leading-relaxed max-w-2xl">
              Capture customer orders, track payments, manage slaughter progress, and keep slicing
              instructions in one clean system — from order submission to collection.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {user ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/order"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
                  >
                    Place Order
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-gray-300 bg-white/40 text-base font-medium hover:bg-white/70 transition-colors"
                  >
                    Staff Sign In
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl items-stretch">
              {[
                {
                  k: "Orders",
                  v: "Captured in one place",
                },
                {
                  k: "Statuses",
                  v: "Paid, slaughtered, collected",
                },
                {
                  k: "Instructions",
                  v: "Clear slicing notes",
                },
              ].map((item) => (
                <div
                  key={item.k}
                  className="group relative overflow-hidden rounded-3xl border border-gray-300 bg-white/70 px-5 py-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-[88px] flex items-center"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#B8963D] via-[#B8963D]/60 to-transparent" />
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B8963D]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div>
                    <div className="text-sm text-gray-700">{item.k}</div>
                    <div className="mt-0.5 font-semibold text-gray-900">{item.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid gap-6">
            <div className="rounded-3xl border border-gray-300 bg-gradient-to-br from-white/80 to-white/40 p-8 shadow-lg">
              <p className="text-xl leading-relaxed italic">
                “Professional, organised, and much easier to manage when things get busy.”
              </p>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-gray-600">Built for real Qurbani day operations</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-300 bg-black text-white p-8 shadow-xl relative overflow-hidden">
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#B8963D]/25 blur-2xl" />
              <h3 className="mt-1 text-2xl font-semibold">At a glance</h3>
              <p className="mt-3 text-white/70 leading-relaxed">
                Staff can instantly see customer details, sheep count, payment status, slicing
                preference, and collection progress from one dashboard.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {["Customer", "Sheep Count", "Paid", "Collected"].map((t) => (
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

      <section id="about" className="py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="rounded-3xl border border-gray-300 bg-white/70 p-10 shadow-sm">
            <p className="uppercase tracking-widest text-sm text-[#B8963D] mb-3">About the system</p>

            <h2 className="text-4xl font-semibold tracking-tight">
              From customer order to final collection
            </h2>

            <div className="mt-6 grid md:grid-cols-2 gap-8">
              <p className="text-gray-800 leading-relaxed text-lg">
                Customers submit their Qurbani order through one simple form. Staff then manage
                everything from a central dashboard instead of juggling WhatsApp messages, spreadsheets,
                and printed lists.
              </p>

              <p className="text-gray-800 leading-relaxed text-lg">
                On the day, staff can search customers quickly, confirm payment, track slaughter
                progress, check slicing instructions, and mark orders as collected — all in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="uppercase tracking-widest text-sm text-[#5E4A1D]">System highlights</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">
                Built to streamline Qurbani day
              </h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="Order Capture"
              text="Customers submit orders themselves, reducing back-and-forth WhatsApp messages and manual recapturing."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M8 7h8M8 12h8M8 17h5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
            <FeatureCard
              title="Live Tracking"
              text="Staff can track paid, slaughtered, and collected statuses live as the day progresses."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M5 12l4 4L19 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <FeatureCard
              title="Clear Instructions"
              text="Every order keeps slicing preferences and notes visible, helping reduce mistakes and confusion."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path
                    d="M12 20h9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      <section id="faq" className="py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <div className="text-center mb-12">
            <p className="uppercase tracking-widest text-sm text-[#5E4A1D]">Questions & Answers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="Does this replace WhatsApp completely?"
              answer="Not necessarily. Staff can still communicate with customers on WhatsApp, but the actual order details are captured properly in the system."
            />
            <FAQItem
              question="Can staff use it on the day from a phone?"
              answer="Yes. The system is designed to be easy to use from a phone so staff can search customers and update statuses live."
            />
            <FAQItem
              question="What does the system track?"
              answer="It tracks customer details, sheep count, preferred weight, slicing instructions, notes, payment status, slaughter status, and collection status."
            />
            <FAQItem
              question="Why is this better than using a spreadsheet only?"
              answer="It removes manual recapturing, makes searching much faster on the day, and keeps operational statuses easy to update in real time."
            />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="rounded-3xl border border-gray-300 bg-gradient-to-br from-white/70 to-white/40 p-10 shadow-lg overflow-hidden relative">
            <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-[#B8963D]/15 blur-3xl" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />

            <div className="grid md:grid-cols-12 gap-10 items-center relative">
              <div className="md:col-span-8">
                <p className="uppercase tracking-widest text-sm text-[#B8963D]">Ready to continue?</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight">
                  Submit an order or open the staff dashboard
                </h2>
                <p className="mt-4 text-gray-800 text-lg leading-relaxed">
                  One system for customer orders, payment checks, slaughter tracking, and collection tracking.
                </p>
              </div>

              <div className="md:col-span-4 flex md:justify-end gap-3">
                <Link
                  href="/order"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-black text-white text-base font-medium hover:bg-gray-900 shadow-sm"
                >
                  Place Order
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-gray-300 bg-white/50 text-base font-medium hover:bg-white/80 transition-colors"
                >
                  Staff Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-300 bg-white/70">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-4">
                <div className="h-[80px] w-[85px] rounded-xl bg-white/100 border border-gray-300 shadow-sm grid place-items-center">
                  <Image
                    src="/logo4.png"
                    alt="Qurbani Management"
                    width={58}
                    height={58}
                    className="rounded"
                    priority
                  />
                </div>
                <div>
                  <div className="font-semibold text-lg">Qurbani Management</div>
                  <div className="text-sm text-gray-600">Professional order and day-of tracking</div>
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
                  <div className="text-sm font-semibold text-gray-900 mb-4">Access</div>
                  <div className="space-y-3">
                    <a href="/order" className="block text-sm text-gray-700 hover:text-black">Place Order</a>
                    <a href="/login" className="block text-sm text-gray-700 hover:text-black">Staff Sign In</a>
                    {user ? (
                      <a href="/admin" className="block text-sm text-gray-700 hover:text-black">
                        Dashboard
                      </a>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-4">System</div>
                  <div className="space-y-3">
                    <a href="#about" className="block text-sm text-gray-700 hover:text-black">How it works</a>
                    <a href="#faq" className="block text-sm text-gray-700 hover:text-black">Questions</a>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-3xl border border-gray-300 bg-gradient-to-br from-white/70 to-white/40 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-widest text-[#B8963D]">Qurbani Portal</div>
                    <div className="mt-1 font-semibold text-lg">Everything organised in one place</div>
                    <div className="mt-1 text-sm text-gray-700">
                      Orders, payments, slaughter progress, and collection tracking.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/order"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-900"
                    >
                      Place Order
                    </a>
                    <a
                      href="/login"
                      className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-gray-300 bg-white/70 hover:bg-white transition-colors text-sm font-medium"
                    >
                      Staff Sign In
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
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}