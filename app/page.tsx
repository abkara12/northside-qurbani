"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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

  if (standalone || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/10 bg-[#191118]/95 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#c6a268]/18 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#5a3045]/18 blur-3xl" />
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#d8b67e]">
                Install App
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Add Northside Qurbani to your Home Screen
              </h3>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
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
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <div className="font-semibold text-white">On iPhone / iPad (Safari):</div>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Tap the <span className="font-semibold text-white">Share</span> button</li>
                <li>Select <span className="font-semibold text-white">Add to Home Screen</span></li>
                <li>Tap <span className="font-semibold text-white">Add</span></li>
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              {deferred ? (
                <div>
                  Tap <span className="font-semibold text-white">Install</span> for faster access for staff on Qurbani day.
                </div>
              ) : (
                <div>
                  Faster access for orders, payment checks, processing updates, and customer collections.
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {!isIOS ? (
              <button
                type="button"
                onClick={handleInstall}
                className="h-12 flex-1 rounded-2xl bg-[#c6a268] font-semibold text-[#191118] transition hover:brightness-105 disabled:opacity-60"
                disabled={!deferred}
              >
                Install
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/5 font-semibold text-white transition hover:bg-white/10"
            >
              Not now
            </button>
          </div>

          <div className="mt-4 text-xs text-white/45">
            Best for staff using the platform throughout the day.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Icons ---------------- */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 12l1.7 1.7L14.8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="7" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="4" width="7" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="8.5" y="14" width="7" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M10 7h4M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- UI Components ---------------- */
function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-sm uppercase tracking-[0.24em] text-[#a98a61] sm:text-left">
      {children}
    </p>
  );
}

function FeatureCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-8 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06] hover:shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#c6a268]/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4a2a3b] text-[#d8b67e]">
          {icon}
        </div>
        <h4 className="mt-4 text-2xl font-semibold text-white">{title}</h4>
        <p className="mt-3 leading-relaxed text-[#c8bdc3]">{text}</p>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-[30px] border border-white/10 bg-white/[0.045] p-6 text-left shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:bg-white/[0.06] hover:shadow-[0_18px_56px_rgba(0,0,0,0.24)]"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-6">
        <h4 className="text-lg font-semibold text-white">{question}</h4>
        <span className="flex items-center gap-3 text-[#d8b67e]">
          <span className="hidden text-sm font-medium sm:inline">{open ? "Close" : "Open"}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[#d8b67e]">
            <ChevronIcon open={open} />
          </span>
        </span>
      </div>

      <div
        className={`grid transition-all duration-300 ${
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="leading-relaxed text-[#c8bdc3]">{answer}</p>
        </div>
      </div>
    </button>
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
  const primary =
    "border-[#4a2a3b] bg-[#4a2a3b] text-white shadow-lg shadow-black/10 hover:bg-[#3c2130]";
  const normal = "border-white/10 bg-white/5 text-white shadow-sm hover:bg-white/10";

  return (
    <Link href={href} onClick={onClick} className={`${base} ${variant === "primary" ? primary : normal}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base leading-tight">{label}</div>
          {sub ? (
            <div className={`mt-1 text-xs font-medium ${variant === "primary" ? "text-white/70" : "text-white/55"}`}>
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-full transition-all duration-300 ${
            variant === "primary" ? "bg-white/10 text-[#d8b67e]" : "bg-white/10 text-[#d8b67e]"
          }`}
        >
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left">
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#d8b67e]">{value}</div>
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuState, setMenuState] = useState<"open" | "closed">("closed");
  const [user, setUser] = useState<User | null>(null);
  const [, setIsAdmin] = useState(false);

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
   <main id="top" className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
  <div className="absolute inset-0 bg-[#09070b]" />
  <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />

  <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
  <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#4a2a3b]/[0.26] blur-3xl" />
  <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />

  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,162,104,0.05),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(74,42,59,0.18),transparent_32%)]" />

  <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />

  <div className="absolute inset-0 opacity-[0.03] mix-blend-screen bg-[url('/noise.png')]" />
</div>

      {/* NAVBAR */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-4">
          <div className="grid h-[88px] w-[88px] place-items-center rounded-[26px] border border-white/10 bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <Image
              src="/logo4.png"
              alt="Northside Qurbani"
              width={68}
              height={68}
              className="object-contain"
              priority
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-lg font-semibold tracking-tight text-white">
              Northside Qurbani
            </div>
            <div className="text-sm text-white/55">
              Premium qurbani service with refined digital operations
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:flex">
          <a
            href="#about"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            About
          </a>
          <a
            href="#services"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Services
          </a>
          <a
            href="#platform"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Platform
          </a>
          <a
            href="#faq"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            FAQ
          </a>

          {user ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#4a2a3b] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#3c2130]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#4a2a3b] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#3c2130]"
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
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-sm backdrop-blur-xl transition hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/5" />
          <MenuIcon />
        </button>
      </header>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={closeMenu}
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-[650ms] ease-out ${
              menuState === "open" ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-white/10 bg-[#191118]/95 shadow-2xl backdrop-blur-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
              menuState === "open" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="relative flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-[76px] w-[76px] place-items-center rounded-[22px] border border-white/10 bg-white/5 shadow-sm">
                    <Image
                      src="/logo4.png"
                      alt="Northside Qurbani"
                      width={58}
                      height={58}
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight text-white">
                      Northside Qurbani
                    </div>
                    <div className="text-xs text-white/55">Menu</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-sm transition hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/5" />
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                <MenuRow href="/" label="Home" sub="Return to homepage" onClick={closeMenu} />
                <MenuRow href="#about" label="About" sub="Who we are and what we do" onClick={closeMenu} />
                <MenuRow href="#services" label="Services" sub="Our premium offering" onClick={closeMenu} />
                <MenuRow href="#platform" label="Platform" sub="How the system works" onClick={closeMenu} />
                <MenuRow href="#faq" label="FAQ" sub="Common questions" onClick={closeMenu} />

                <div className="my-1 h-px bg-white/10" />

                {user ? (
                  <MenuRow
                    href="/admin"
                    label="Dashboard"
                    sub="Manage operations and updates"
                    onClick={closeMenu}
                    variant="primary"
                  />
                ) : (
                  <>
                    <MenuRow
                      href="/login"
                      label="Staff Sign In"
                      sub="Access the operations dashboard"
                      onClick={closeMenu}
                    />
                    <MenuRow
                      href="/order"
                      label="Place Order"
                      sub="Submit your qurbani booking"
                      onClick={closeMenu}
                      variant="primary"
                    />
                  </>
                )}
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-[#d8b67e]">Quick tip</div>
                  <div className="mt-1 text-sm text-white/70">
                    Add the app to your home screen for faster use on the day.
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-white/45">
                  <span>© {new Date().getFullYear()} Northside Qurbani</span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white transition hover:bg-white/10"
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
<section className="mx-auto max-w-7xl px-6 pt-2 pb-16 sm:px-10 lg:pt-4 lg:pb-24">
  <div className="grid items-center gap-8 lg:grid-cols-12">
    <div className="text-center lg:col-span-7 lg:text-left">
      <h1 className="bg-[linear-gradient(135deg,#f8f1e6_0%,#d8b67e_46%,#ffffff_100%)] bg-clip-text text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.055em] text-transparent sm:text-[3.3rem] lg:text-[4.2rem] xl:text-[4.9rem]">
  Qurbani elevated
  <span className="block mt-1">
    with care, precision,
  </span>
  <span className="block mt-1">
    and excellence.
  </span>
</h1>

      <p className="mx-auto mt-4 max-w-2xl text-[0.97rem] leading-7 text-white/68 sm:text-[1rem] sm:leading-7 lg:mx-0 lg:max-w-[39rem] lg:text-[1.04rem] lg:leading-8">
        Northside Qurbani brings together trusted service, professional coordination,
        and a beautifully designed digital platform — creating a smoother, more refined
        experience for both customers and staff from booking to final collection.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2.5 sm:w-full sm:max-w-sm sm:mx-auto lg:mx-0 lg:max-w-none lg:flex-row lg:items-center lg:justify-start">
        <Link
  href="/order"
  className="inline-flex h-[44px] w-full items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:h-[46px] lg:w-auto lg:px-7"
>
  Place Your Order
</Link>

       {user ? (
  <Link
    href="/admin"
    className="inline-flex h-[40px] w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:w-auto lg:px-6"
  >
    Open Dashboard
  </Link>
) : (
  <Link
    href="/login"
    className="inline-flex h-[40px] w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:w-auto lg:px-6"
  >
    Staff Sign In
  </Link>
)}
      </div>

      <div className="mx-auto mt-8 hidden max-w-3xl gap-4 md:grid md:grid-cols-3 lg:mx-0">
        {[
          { k: "Trusted Service", v: "Handled with dignity and care" },
          { k: "Premium Ordering", v: "Simple, polished, and modern" },
          { k: "Smooth Operations", v: "Better structure on the day" },
        ].map((item) => (
          <div
            key={item.k}
            className="rounded-[22px] border border-white/10 bg-white/[0.045] px-5 py-4 text-center shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:text-left"
          >
            <div className="text-sm text-white/45">{item.k}</div>
            <div className="mt-1 font-semibold leading-snug text-white">{item.v}</div>
          </div>
        ))}
      </div>
    </div>

    <div className="lg:col-span-5">
      <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.36)] lg:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[#c6a268]/14 blur-3xl" />
          <div className="absolute bottom-[-4rem] left-[-4rem] h-36 w-36 rounded-full bg-[#5a3045]/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <div className="relative flex h-full flex-col text-center sm:text-left">
          <div className="inline-flex w-fit self-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-[#d8b67e] sm:self-start">
            Elite operations
          </div>

          <h3 className="mt-4 text-[1.5rem] font-semibold leading-tight lg:text-[1.65rem]">
            A premium qurbani service,
            <br />
            supported by a modern platform.
          </h3>

          <p className="mt-3 text-[0.94rem] leading-6 text-white/70">
            A more controlled, premium, and professional experience across booking,
            coordination, and collection.
          </p>

          <div className="mt-5 grid gap-3">
            <StatPill label="Customer ordering" value="Elegant and clear" />
            <StatPill label="Team coordination" value="Structured on busy days" />
            <StatPill label="Collection handover" value="Organised and professional" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Service", "Premium"],
              ["Workflow", "Refined"],
              ["Experience", "Trusted"],
              ["Brand", "Elevated"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left"
              >
                <div className="text-sm text-white/45">{label}</div>
                <div className="mt-1 text-sm font-semibold text-[#d8b67e]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* ABOUT / STORY */}
      <section id="about" className="py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="rounded-[36px] border border-white/10 bg-white/[0.045] p-10 text-center shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:text-left">
                <SectionEyebrow>Our story</SectionEyebrow>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                  Built on trust, handled with care, presented with excellence.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-[#c8bdc3]">
                  Northside Qurbani is led by Moulana Shaheed Bhabha and Yaqoob Sader,
                  combining trusted service with a more refined, modern standard of organisation.
                  The aim is to make the qurbani experience feel smoother, more professional,
                  and more dignified from beginning to end.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[36px] border border-white/10 bg-white/[0.045] p-10 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="text-center sm:text-left">
                    <div className="text-sm uppercase tracking-[0.2em] text-[#a98a61]">What sets us apart</div>
                    <p className="mt-3 leading-relaxed text-[#c8bdc3]">
                      Northside Qurbani is more than a basic service. It is a premium,
                      carefully managed experience designed for people who value trust,
                      clarity, professionalism, and a smoother process.
                    </p>
                  </div>

                  <div className="text-center sm:text-left">
                    <div className="text-sm uppercase tracking-[0.2em] text-[#a98a61]">Why the platform matters</div>
                    <p className="mt-3 leading-relaxed text-[#c8bdc3]">
                      Busy qurbani periods can become difficult to manage without proper systems.
                      The Northside platform adds structure, reduces confusion, improves visibility,
                      and supports a more elevated customer and staff experience.
                    </p>
                  </div>
                </div>

                <div className="mt-8 h-px bg-white/10" />

                <div className="mt-8 grid gap-5 sm:grid-cols-3">
                  {[
                    "Trusted leadership",
                    "Premium customer journey",
                    "Modern operational structure",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-center text-sm font-medium text-white sm:text-left"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="pb-24 pt-4">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-10 text-center sm:text-left">
            <SectionEyebrow>Services</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              A more complete and more luxurious qurbani experience
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              title="Customer Ordering"
              text="Customers can place their qurbani booking through a polished and intuitive online flow that feels simple, modern, and trustworthy."
              icon={<SparkIcon />}
            />
            <FeatureCard
              title="Operational Management"
              text="Staff have one clean workspace to manage orders, payment checks, preferences, progress updates, and customer collections."
              icon={<WorkflowIcon />}
            />
            <FeatureCard
              title="Trusted Delivery"
              text="Service, care, and better systems come together to create a higher standard of organisation and a more premium overall experience."
              icon={<ShieldIcon />}
            />
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="pb-24 pt-4">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-10 text-center sm:text-left">
            <SectionEyebrow>The platform</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              Designed to make Qurbani day feel smoother, calmer, and more organised
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Customer Books",
                text: "The customer submits their booking, quantity, and preferences through one elegant digital flow.",
              },
              {
                step: "02",
                title: "Team Prepares",
                text: "Orders appear instantly for staff, ready for payment visibility and day-of planning.",
              },
              {
                step: "03",
                title: "Live Coordination",
                text: "Throughout the day, staff can manage updates, processing, and progress from one place.",
              },
              {
                step: "04",
                title: "Collection Handover",
                text: "Final handover becomes clearer and more professional because everything is already structured.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_14px_38px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:text-left"
              >
                <div className="text-sm font-semibold tracking-[0.2em] text-[#a98a61]">{item.step}</div>
                <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-[#c8bdc3]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREMIUM STRIP */}
      <section className="pb-24 pt-2">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="overflow-hidden rounded-[40px] border border-white/10 bg-[#171018] p-10 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div className="text-center md:col-span-7 md:text-left">
                <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">Why it stands out</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                  Not just a better-looking website.
                  <br />
                  A better-run qurbani experience.
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-white/70">
                  The real value is not only in the design. It is in the confidence, structure,
                  and premium presentation the system adds to the entire Northside Qurbani brand.
                </p>
              </div>

              <div className="md:col-span-5">
                <div className="grid gap-3">
                  {[
                    "Clearer customer communication",
                    "Less manual admin and confusion",
                    "Better visibility for staff",
                    "A more premium brand impression",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-white/80 sm:text-left"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-10">
          <div className="mb-12 text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-[#a98a61]">Questions & Answers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="Can customers place their qurbani order online themselves?"
              answer="Yes. Customers can submit their order directly through the platform, making the process easier, clearer, and more convenient."
            />
            <FAQItem
              question="Can staff use the system from a phone on the day?"
              answer="Yes. The platform is designed to work smoothly on mobile, making it easier for staff to search, manage, and update orders live."
            />
            <FAQItem
              question="Is this website about the business or the system?"
              answer="It is both. The website represents Northside Qurbani as a premium service business, while also showcasing the refined digital platform that supports the operation."
            />
            <FAQItem
              question="Why is this better than manual coordination only?"
              answer="It reduces back-and-forth, improves organisation, keeps details in one place, and creates a far more professional experience for customers and staff."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="rounded-[38px] border border-white/10 bg-white/[0.045] p-10 shadow-[0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div className="text-center md:col-span-8 md:text-left">
                <SectionEyebrow>Ready to proceed?</SectionEyebrow>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                  Place your order or continue to the staff dashboard
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-[#c8bdc3]">
                  A premium qurbani service, supported by a more elegant and more organised digital experience.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row md:col-span-4 md:justify-end">
                <Link
                  href="/order"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-7 text-base font-medium text-[#161015] shadow-sm transition hover:brightness-105"
                >
                  Place Order
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-7 text-base font-medium text-white transition hover:bg-white/10"
                >
                  Staff Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-black/10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="text-center lg:col-span-4 lg:text-left">
              <div className="flex items-center justify-center gap-4 lg:justify-start">
                <div className="grid h-[78px] w-[78px] place-items-center rounded-[22px] border border-white/10 bg-white/5 shadow-sm">
                  <Image
                    src="/logo4.png"
                    alt="Northside Qurbani"
                    width={56}
                    height={56}
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">Northside Qurbani</div>
                  <div className="text-sm text-white/55">
                    Premium qurbani service with refined digital operations
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 sm:text-left">
                <div>
                  <div className="mb-4 text-sm font-semibold text-white">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-white/65 hover:text-white">Home</a>
                    <a href="#about" className="block text-sm text-white/65 hover:text-white">About</a>
                    <a href="#services" className="block text-sm text-white/65 hover:text-white">Services</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-white">Platform</div>
                  <div className="space-y-3">
                    <a href="#platform" className="block text-sm text-white/65 hover:text-white">How It Works</a>
                    <a href="#faq" className="block text-sm text-white/65 hover:text-white">FAQ</a>
                    <a href="/login" className="block text-sm text-white/65 hover:text-white">Staff Sign In</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-white">Order</div>
                  <div className="space-y-3">
                    <a href="/order" className="block text-sm text-white/65 hover:text-white">Place Order</a>
                    {user ? (
                      <a href="/admin" className="block text-sm text-white/65 hover:text-white">Dashboard</a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-sm backdrop-blur-xl">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-[#a98a61]">Northside Qurbani</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      Trusted service, elevated presentation
                    </div>
                    <div className="mt-1 text-sm text-[#c8bdc3]">
                      Premium qurbani coordination supported by a refined digital platform.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/order"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#4a2a3b] px-6 text-sm font-medium text-white hover:bg-[#3c2130]"
                    >
                      Place Order
                    </a>
                    <a
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Staff Sign In
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-white/10" />

          <div className="flex flex-col items-center justify-between gap-4 text-sm text-white/45 sm:flex-row">
            <a href="#top" className="hover:text-white">
              Back to top ↑
            </a>
            <span>Northside Qurbani • {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}