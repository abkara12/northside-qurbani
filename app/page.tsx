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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/10 bg-[#0d1210]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#cfaf74]/15 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full bg-[#40574b]/18 blur-3xl" />
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#cfaf74]">
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
                <li>
                  Tap the <span className="font-semibold text-white">Share</span> button
                </li>
                <li>
                  Select <span className="font-semibold text-white">Add to Home Screen</span>
                </li>
                <li>
                  Tap <span className="font-semibold text-white">Add</span>
                </li>
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              {deferred ? (
                <div>
                  Tap <span className="font-semibold text-white">Install</span> for faster staff access on Qurbani day.
                </div>
              ) : (
                <div>
                  Quick access for orders, payment checking, processing updates, and collection handovers.
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {!isIOS ? (
              <button
                type="button"
                onClick={handleInstall}
                className="h-12 flex-1 rounded-2xl bg-[#cfaf74] font-semibold text-[#101511] transition hover:brightness-105 disabled:opacity-60"
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
            Ideal for staff using the platform throughout the day.
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
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-[30px] border border-[#ddd6cc] bg-white/72 p-6 text-left shadow-[0_14px_40px_rgba(15,18,16,0.06)] backdrop-blur-xl transition hover:shadow-[0_18px_56px_rgba(15,18,16,0.09)]"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-6">
        <h4 className="text-lg font-semibold text-[#141816]">{question}</h4>
        <span className="flex items-center gap-3 text-[#496253]">
          <span className="hidden text-sm font-medium sm:inline">{open ? "Close" : "Open"}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf2ee] text-[#496253]">
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
          <p className="leading-relaxed text-[#5f6963]">{answer}</p>
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
  icon: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[32px] border border-[#ddd6cc] bg-white/72 p-8 shadow-[0_16px_44px_rgba(15,18,16,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,18,16,0.09)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#cfaf74]/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#13201a] text-[#cfaf74]">
          {icon}
        </div>
        <div>
          <h4 className="mb-2 text-2xl font-semibold text-[#141816]">{title}</h4>
          <p className="leading-relaxed text-[#5f6963]">{text}</p>
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
  const primary =
    "border-[#13201a] bg-[#13201a] text-white shadow-lg shadow-black/10 hover:bg-[#0f1814]";
  const normal = "border-[#ddd6cc] bg-white text-[#141816] shadow-sm hover:bg-[#f8f6f1]";

  return (
    <Link href={href} onClick={onClick} className={`${base} ${variant === "primary" ? primary : normal}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base leading-tight">{label}</div>
          {sub ? (
            <div className={`mt-1 text-xs font-medium ${variant === "primary" ? "text-white/70" : "text-[#7b857f]"}`}>
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-full transition-all duration-300 ${
            variant === "primary" ? "bg-white/10 text-[#cfaf74]" : "bg-[#edf2ee] text-[#496253]"
          }`}
        >
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm uppercase tracking-[0.24em] text-[#496253]">{children}</p>
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
    <main id="top" className="min-h-screen overflow-x-hidden bg-[#f3f1ec] text-[#141816]">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#f3f1ec]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8f6f2_0%,#f2efe8_38%,#ece8e1_100%)]" />
        <div className="absolute right-[-10rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#cfaf74]/[0.12] blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[-12rem] h-[38rem] w-[38rem] rounded-full bg-[#496253]/[0.10] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.85),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(73,98,83,0.06),transparent_26%)]" />
        <div className="absolute inset-0 opacity-[0.02] mix-blend-multiply bg-[url('/noise.png')]" />
      </div>

      {/* NAVBAR */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-4">
          <div className="grid h-[88px] w-[88px] place-items-center rounded-[26px] border border-white/60 bg-white/75 shadow-[0_18px_50px_rgba(15,18,16,0.08)] backdrop-blur-xl">
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
            <div className="text-lg font-semibold tracking-tight text-[#141816]">
              Northside Qurbani
            </div>
            <div className="text-sm text-[#6a736f]">
              Premium qurbani service & digital operations
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/60 bg-white/65 px-3 py-2 shadow-[0_10px_35px_rgba(15,18,16,0.05)] backdrop-blur-xl lg:flex">
          <a
            href="#about"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f5f2ed]"
          >
            About
          </a>
          <a
            href="#services"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f5f2ed]"
          >
            Services
          </a>
          <a
            href="#platform"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f5f2ed]"
          >
            Platform
          </a>
          <a
            href="#faq"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f5f2ed]"
          >
            FAQ
          </a>

          {user ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#13201a] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#0f1814]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f5f2ed]"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#13201a] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#0f1814]"
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
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/75 text-[#141816] shadow-sm backdrop-blur-xl transition hover:bg-white lg:hidden"
          aria-label="Open menu"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5" />
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
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-white/10 bg-[#0d1210]/95 shadow-2xl backdrop-blur-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
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
                <MenuRow href="#services" label="Services" sub="Our qurbani offering" onClick={closeMenu} />
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
                  <div className="text-xs uppercase tracking-[0.25em] text-[#cfaf74]">Quick tip</div>
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
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-8 sm:px-10">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[#496253]" />
              <span className="text-[#5f6963]">
                Trusted qurbani management, refined for a modern experience
              </span>
            </div>

            <h1 className="mt-7 text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[#141816] sm:text-6xl xl:text-7xl">
              Qurbani managed
              <br />
              with excellence,
              <br />
              care, and precision.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#5f6963] sm:text-xl">
              Northside Qurbani combines a trusted service with a premium digital platform,
              giving customers a smoother ordering experience and giving staff a far more
              organised way to manage every stage of the process.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/order"
                className="inline-flex h-14 items-center justify-center rounded-full bg-[#13201a] px-8 text-base font-medium text-white shadow-[0_14px_32px_rgba(15,18,16,0.18)] transition hover:bg-[#0f1814]"
              >
                Place Your Order
              </Link>

              {user ? (
                <Link
                  href="/admin"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#ddd6cc] bg-white/80 px-8 text-base font-medium text-[#141816] backdrop-blur-xl transition hover:bg-white"
                >
                  Open Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#ddd6cc] bg-white/80 px-8 text-base font-medium text-[#141816] backdrop-blur-xl transition hover:bg-white"
                >
                  Staff Sign In
                </Link>
              )}
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { k: "Professional Service", v: "Handled with care and structure" },
                { k: "Modern Ordering", v: "Simple for customers to complete" },
                { k: "Operational Clarity", v: "Clear for staff on the day" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-[28px] border border-[#ddd6cc] bg-white/72 px-5 py-5 shadow-[0_12px_32px_rgba(15,18,16,0.05)] backdrop-blur-xl"
                >
                  <div className="text-sm text-[#7b857f]">{item.k}</div>
                  <div className="mt-1 font-semibold leading-snug text-[#141816]">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative h-full overflow-hidden rounded-[38px] border border-white/10 bg-[#0d1210] p-8 text-white shadow-[0_24px_80px_rgba(12,16,14,0.34)]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-[-4rem] top-[-4rem] h-44 w-44 rounded-full bg-[#cfaf74]/12 blur-3xl" />
                <div className="absolute bottom-[-4rem] left-[-4rem] h-44 w-44 rounded-full bg-[#496253]/18 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
                <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
              </div>

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#cfaf74]">
                  Business + Platform
                </div>

                <h3 className="mt-6 text-3xl font-semibold leading-tight">
                  A premium qurbani service,
                  <br />
                  backed by a modern operations platform.
                </h3>

                <p className="mt-4 leading-relaxed text-white/72">
                  This is not only an online order form. It is a more refined way to manage
                  bookings, confirmations, processing progress, staff coordination, and collection
                  updates from one polished system.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    ["Customer Orders", "Captured clearly with fewer errors and less back-and-forth"],
                    ["Payment Status", "Easier for staff to verify and manage cleanly"],
                    ["Processing Updates", "A better workflow throughout the day"],
                    ["Collections", "More organised handovers with better visibility"],
                  ].map(([title, text]) => (
                    <div
                      key={title}
                      className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                    >
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="mt-1 text-sm text-white/62">{text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[
                    ["Ordering", "Refined"],
                    ["Operations", "Structured"],
                    ["Experience", "Premium"],
                    ["Handover", "Organised"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="text-sm text-white/52">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-[#cfaf74]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="rounded-[36px] border border-[#ddd6cc] bg-white/72 p-10 shadow-[0_18px_50px_rgba(15,18,16,0.06)] backdrop-blur-xl">
                <SectionEyebrow>About Northside Qurbani</SectionEyebrow>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#141816]">
                  A trusted qurbani business with a modern, premium approach.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-[#5f6963]">
                  Northside Qurbani is led by Moulana Shaheed Bhabha and Yaqoob Sader,
                  bringing together trusted service, professionalism, and a more organised way
                  of serving customers during the qurbani season.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[36px] border border-[#ddd6cc] bg-white/72 p-10 shadow-[0_18px_50px_rgba(15,18,16,0.06)] backdrop-blur-xl">
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-[#496253]">Our focus</div>
                    <p className="mt-3 leading-relaxed text-[#5f6963]">
                      To provide a qurbani experience that feels reliable, dignified, and well-managed
                      from the first order right through to final collection.
                    </p>
                  </div>

                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-[#496253]">Why this matters</div>
                    <p className="mt-3 leading-relaxed text-[#5f6963]">
                      During busy periods, poor coordination creates confusion. Northside Qurbani
                      uses a better process and a better platform to make the entire experience
                      smoother for both customers and staff.
                    </p>
                  </div>
                </div>

                <div className="mt-8 h-px bg-[#e5ded3]" />

                <div className="mt-8 grid gap-5 sm:grid-cols-3">
                  {[
                    "Trusted service",
                    "Professional coordination",
                    "Modern customer experience",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[24px] border border-[#e5ded3] bg-[#faf8f4] px-4 py-4 text-sm font-medium text-[#141816]"
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
          <div className="mb-10">
            <SectionEyebrow>Services</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
              A more complete and more professional qurbani experience
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              title="Customer Ordering"
              text="Customers can place their qurbani booking through a clean and polished online flow, making the process easier and more convenient."
              icon={<SparkIcon />}
            />
            <FeatureCard
              title="Operational Management"
              text="Staff have one clear platform to manage bookings, payment checks, preferences, progress, and handovers throughout the day."
              icon={<WorkflowIcon />}
            />
            <FeatureCard
              title="Trusted Delivery"
              text="The combination of service, care, and better systems creates a more reliable experience that reflects the quality of the business."
              icon={<ShieldIcon />}
            />
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="pb-24 pt-4">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-10">
            <SectionEyebrow>The platform</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
              Built to make Qurbani day feel smoother, faster, and far more organised
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Customer Books",
                text: "The customer submits their booking, quantity, preferences, and notes through one clean digital flow.",
              },
              {
                step: "02",
                title: "Staff Prepare",
                text: "Orders appear immediately in the system, ready for payment verification and operational planning.",
              },
              {
                step: "03",
                title: "Updates Happen Live",
                text: "Staff can manage statuses and progress clearly throughout the day from one central platform.",
              },
              {
                step: "04",
                title: "Collection is Clear",
                text: "Final handover becomes easier to manage because details are already organised and visible.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-[30px] border border-[#ddd6cc] bg-white/72 p-6 shadow-[0_14px_38px_rgba(15,18,16,0.05)] backdrop-blur-xl"
              >
                <div className="text-sm font-semibold tracking-[0.2em] text-[#496253]">{item.step}</div>
                <h3 className="mt-3 text-xl font-semibold text-[#141816]">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-[#5f6963]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREMIUM STRIP */}
      <section className="pb-24 pt-2">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="overflow-hidden rounded-[38px] border border-white/10 bg-[#0d1210] p-10 text-white shadow-[0_24px_80px_rgba(12,16,14,0.32)]">
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div className="md:col-span-7">
                <SectionEyebrow>
                  <span className="text-[#cfaf74]">Why it stands out</span>
                </SectionEyebrow>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                  Not just a better-looking website.
                  <br />
                  A better-run business experience.
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-white/72">
                  The real value is not only in the design. It is in the confidence, structure,
                  and professionalism the platform adds to the entire Northside Qurbani experience.
                </p>
              </div>

              <div className="md:col-span-5">
                <div className="grid gap-3">
                  {[
                    "Cleaner customer communication",
                    "Less manual admin and confusion",
                    "Better visibility for staff",
                    "A more premium brand presentation",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80"
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
            <SectionEyebrow>Questions & Answers</SectionEyebrow>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="Can customers place their qurbani order online themselves?"
              answer="Yes. Customers can submit their order directly through the system, making the process easier, clearer, and more convenient."
            />
            <FAQItem
              question="Can staff use the system from a phone on the day?"
              answer="Yes. The platform is designed to work smoothly on mobile, making it easier for staff to search, manage, and update orders live."
            />
            <FAQItem
              question="Is this website only about the system?"
              answer="No. It represents both the Northside Qurbani business and the premium digital platform that supports the service."
            />
            <FAQItem
              question="Why is this better than manual coordination only?"
              answer="It reduces back-and-forth, improves organisation, keeps information in one place, and presents a much more professional experience to customers."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="rounded-[38px] border border-[#ddd6cc] bg-white/72 p-10 shadow-[0_18px_54px_rgba(15,18,16,0.06)] backdrop-blur-xl">
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div className="md:col-span-8">
                <SectionEyebrow>Ready to proceed?</SectionEyebrow>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
                  Place your order or continue to the staff dashboard
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-[#5f6963]">
                  A premium qurbani service, supported by a cleaner and more organised digital experience.
                </p>
              </div>

              <div className="flex gap-3 md:col-span-4 md:justify-end">
                <Link
                  href="/order"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#13201a] px-7 text-base font-medium text-white shadow-sm transition hover:bg-[#0f1814]"
                >
                  Place Order
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[#ddd6cc] bg-white px-7 text-base font-medium text-[#141816] transition hover:bg-[#f8f6f1]"
                >
                  Staff Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/60 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-4">
                <div className="grid h-[78px] w-[78px] place-items-center rounded-[22px] border border-white/60 bg-white/80 shadow-sm">
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
                  <div className="text-lg font-semibold text-[#141816]">Northside Qurbani</div>
                  <div className="text-sm text-[#6a736f]">
                    Premium qurbani service & digital operations
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-[#5f6963] hover:text-black">Home</a>
                    <a href="#about" className="block text-sm text-[#5f6963] hover:text-black">About</a>
                    <a href="#services" className="block text-sm text-[#5f6963] hover:text-black">Services</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Platform</div>
                  <div className="space-y-3">
                    <a href="#platform" className="block text-sm text-[#5f6963] hover:text-black">How It Works</a>
                    <a href="#faq" className="block text-sm text-[#5f6963] hover:text-black">FAQ</a>
                    <a href="/login" className="block text-sm text-[#5f6963] hover:text-black">Staff Sign In</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Order</div>
                  <div className="space-y-3">
                    <a href="/order" className="block text-sm text-[#5f6963] hover:text-black">Place Order</a>
                    {user ? (
                      <a href="/admin" className="block text-sm text-[#5f6963] hover:text-black">Dashboard</a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-[30px] border border-[#ddd6cc] bg-white/80 p-6 shadow-sm backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-[#496253]">Northside Qurbani</div>
                    <div className="mt-1 text-lg font-semibold text-[#141816]">
                      Service, structure, and a more refined experience
                    </div>
                    <div className="mt-1 text-sm text-[#5f6963]">
                      Premium qurbani coordination supported by a modern digital platform.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/order"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#13201a] px-6 text-sm font-medium text-white hover:bg-[#0f1814]"
                    >
                      Place Order
                    </a>
                    <a
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[#ddd6cc] bg-white px-6 text-sm font-medium text-[#141816] transition hover:bg-[#f8f6f1]"
                    >
                      Staff Sign In
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-[#e4ddd2]" />

          <div className="flex flex-col items-center justify-between gap-4 text-sm text-[#7b857f] sm:flex-row">
            <a href="#top" className="hover:text-black">
              Back to top ↑
            </a>
            <span>Northside Qurbani • {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}