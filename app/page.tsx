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
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/10 bg-[#f5efe6]/95 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
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
                className="h-12 flex-1 rounded-2xl bg-[#c6a268] font-semibold text-[#f5efe6] transition hover:brightness-105 disabled:opacity-60"
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
    <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06] hover:shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:p-7 sm:text-left">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#c6a268]/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-[##f5efe6] text-[#d8b67e] shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:mx-0">
          {icon}
        </div>

        <h3 className="mt-5 text-[1.35rem] font-semibold tracking-[-0.02em] text-white">
          {title}
        </h3>

        <p className="mt-3 text-[0.96rem] leading-7 text-white/65">
          {text}
        </p>
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
    "border-[##f5efe6] bg-[##f5efe6] text-white shadow-lg shadow-black/10 hover:bg-[#3c2130]";
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

        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[#d8b67e] transition-all duration-300">
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left">
      <div className="text-sm text-white/48">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#d8b67e]">{value}</div>
    </div>
  );
}

type SavedOrderState = {
  id: string;
  reference: string;
};

function OrderAccessButtons({
  className = "",
  primaryLarge = false,
}: {
  className?: string;
  primaryLarge?: boolean;
}) {
  return (
    <div className={className}>
      <Link
        href="/order"
        className={`inline-flex items-center justify-center rounded-full bg-[#c6a268] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] ${
          primaryLarge
            ? "h-[44px] min-w-[182px] px-6 text-[14px] sm:text-[15px] lg:h-[46px] lg:min-w-0 lg:w-auto lg:px-7"
            : "h-11 px-6 text-sm"
        }`}
      >
        Place Your Order
      </Link>
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuState, setMenuState] = useState<"open" | "closed">("closed");
  const [user, setUser] = useState<User | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [savedOrder, setSavedOrder] = useState<SavedOrderState | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsStaff(false);

      if (!u) return;

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const role = snap.exists() ? (snap.data() as any).role : null;
        setIsStaff(role === "admin" || role === "staff");
      } catch {
        setIsStaff(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = localStorage.getItem("northside_last_order_id");
    const reference = localStorage.getItem("northside_last_order_reference");

    if (id && reference) {
      setSavedOrder({ id, reference });
    }
  }, []);

  function closeMenu() {
    setMenuState("closed");
    setTimeout(() => {
      setMobileOpen(false);
    }, 650);
  }

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />
        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[##f5efe6]/[0.26] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,162,104,0.05),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(74,42,59,0.18),transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-screen bg-[url('/noise.png')]" />
      </div>

      {/* NAVBAR */}
      <header className="relative z-40 mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-[72px] w-[72px] place-items-center rounded-[22px] border border-white/10 bg-white/5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:h-[78px] sm:w-[78px]">
            <Image
              src="/logo4.png"
              alt="Northside Qurbani"
              width={65}
              height={65}
              className="object-contain sm:h-[62px] sm:w-[62px]"
              priority
            />
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:flex">
          <a href="#about" className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10">
            About
          </a>
          <a href="#services" className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10">
            Services
          </a>
          <a href="#platform" className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10">
            Platform
          </a>
          <a href="#faq" className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10">
            FAQ
          </a>

          {isStaff ? (
            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[##f5efe6] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#3c2130]"
            >
              Staff Dashboard
            </Link>
          ) : savedOrder ? (
            <>
              <Link
                href={`/order/success/${savedOrder.id}`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[##f5efe6] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#3c2130]"
              >
                View My Order
              </Link>
              <Link
                href="/order"
                className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Place Another Order
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex h-10 items-center justify-center rounded-full bg-[##f5efe6] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#3c2130]"
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
            setMenuState("open");
          }}
          className="relative z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-sm backdrop-blur-xl transition hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/5" />
          <MenuIcon />
        </button>
      </header>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            onClick={closeMenu}
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-[650ms] ease-out ${
              menuState === "open" ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-white/10 bg-[#f5efe6]/95 shadow-2xl backdrop-blur-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
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
                      width={65}
                      height={65}
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

                {isStaff ? (
                  <MenuRow
                    href="/admin"
                    label="Dashboard"
                    sub="Manage operations and updates"
                    onClick={closeMenu}
                    variant="primary"
                  />
                ) : savedOrder ? (
                  <>
                    <MenuRow
                      href={`/order/success/${savedOrder.id}`}
                      label="View My Order"
                      sub={`Reference: ${savedOrder.reference}`}
                      onClick={closeMenu}
                      variant="primary"
                    />
                    <MenuRow
                      href="/order"
                      label="Place Another Order"
                      sub="Submit an additional qurbani booking"
                      onClick={closeMenu}
                    />
                  </>
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
      <section className="mx-auto flex min-h-[calc(100svh-88px)] max-w-7xl items-center px-6 pb-8 pt-1 sm:px-10 sm:pb-12 lg:min-h-[calc(100svh-100px)] lg:pb-14 lg:pt-1">
        <div className="grid w-full items-center gap-8 lg:grid-cols-12 xl:gap-10">
          <div className="text-center lg:col-span-7 lg:text-left">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl lg:mx-0">
              Northside Qurbani
            </div>

            <h1 className="mt-3 pb-2 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.06em] text-transparent sm:text-[3rem] lg:text-[4rem] xl:text-[4.65rem]">
              Elevating the Qurbani experience,
              <span className="mt-1 block">with clarity,</span>
              <span className="mt-1 block">care, and organisation.</span>
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-[0.98rem] leading-7 text-white/68 sm:text-[1.02rem] sm:leading-8 lg:mx-0 lg:max-w-[38rem] lg:text-[1.04rem]">
              Northside Qurbani offers a trusted and well-managed service, supported by a refined digital system that brings greater ease, clarity, and structure to the entire process.
            </p>

            <div className="mt-6 flex flex-col items-center gap-2.5 lg:flex-row lg:items-center lg:justify-start lg:gap-3">
              {isStaff ? (
                <Link
                  href="/admin"
                  className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:h-[46px] lg:min-w-0 lg:w-auto lg:px-7"
                >
                  Staff Dashboard
                </Link>
              ) : (
                <>
                  <OrderAccessButtons
                    primaryLarge
                    className="flex flex-col items-center gap-2.5 lg:flex-row lg:items-center lg:justify-start lg:gap-3"
                  />

                  {!savedOrder ? (
                    <Link
                      href="/login"
                      className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:min-w-0 lg:w-auto lg:px-6"
                    >
                      Staff Sign In
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={`/order/success/${savedOrder.id}`}
                        className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:min-w-0 lg:w-auto lg:px-6"
                      >
                        View My Order
                      </Link>
                      <Link
                        href="/order"
                        className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:min-w-0 lg:w-auto lg:px-6"
                      >
                        Place Another Order
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            {!isStaff && savedOrder ? (
              <div className="mx-auto mt-4 max-w-[34rem] rounded-[24px] border border-white/10 bg-white/[0.045] px-5 py-4 text-center shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:mx-0 lg:text-left">
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                  Your previous booking is saved
                </div>
                <div className="mt-2 text-sm leading-6 text-white/72">
                  You can return to your saved booking at any time on this device.
                </div>
                <div className="mt-2 text-sm font-semibold text-[#d8b67e]">
                  Reference: {savedOrder.reference}
                </div>
              </div>
            ) : null}

            <div className="mx-auto mt-6 hidden max-w-3xl gap-4 md:grid md:grid-cols-3 lg:mx-0">
              {[
                { k: "Trusted Service", v: "Handled with dignity and care" },
                { k: "Premium Ordering", v: "Simple, polished, and modern" },
                { k: "Smooth Operations", v: "Better structure on the day" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-[22px] border border-white/10 bg-white/[0.045] px-5 py-4 text-center shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:text-left"
                >
                  <div className="text-sm text-white/42">{item.k}</div>
                  <div className="mt-1 font-semibold leading-snug text-white">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#171018] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.36)] lg:p-6">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[#c6a268]/14 blur-3xl" />
                <div className="absolute bottom-[-4rem] left-[-4rem] h-36 w-36 rounded-full bg-[#5a3045]/20 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
                <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
              </div>

              <div className="relative flex h-full flex-col text-center sm:text-left">
                <div className="inline-flex w-fit self-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-[#d8b67e] sm:self-start">
                  Refined operations
                </div>

                <h3 className="mt-4 text-[1.55rem] font-semibold leading-tight lg:text-[1.72rem]">
                  A premium qurbani service,
                  <br />
                  supported by a modern platform.
                </h3>

                <p className="mt-3 text-[0.95rem] leading-6 text-white/68">
                  Designed to give customers a smoother experience and give staff clearer control
                  across ordering, coordination, and collection.
                </p>

                <div className="mt-6 grid gap-3">
                  <StatPill label="Customer ordering" value="Elegant and easy to complete" />
                  <StatPill label="Operations" value="More structured on Qurbani day" />
                  <StatPill label="Collection" value="Clearer and more professional" />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ["Service", "Premium"],
                    ["Workflow", "Refined"],
                    ["Trust", "Established"],
                    ["Experience", "Elevated"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center sm:text-left"
                    >
                      <div className="text-sm text-white/42">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-[#d8b67e]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / BRAND STORY */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-[#d8b67e]">
              About Northside Qurbani
            </p>

            <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[2.4rem] lg:text-[2.8rem]">
              A trusted qurbani service,
              <br />
              built on care, responsibility,
              <br />
              and experience.
            </h2>

            <p className="mt-5 text-[0.98rem] leading-7 text-white/70 sm:text-[1.05rem] sm:leading-8">
              Northside Qurbani is led by <span className="font-medium text-[#d8b67e]">Moulana Shaheed Bhabha</span> and <span className="font-medium text-[#d8b67e]">Yaqoob Sader</span>,
              bringing together years of experience, responsibility, and a deep understanding of the importance of qurbani.
            </p>

            <p className="mt-4 text-[0.95rem] leading-7 text-white/65 sm:text-[1rem] sm:leading-8">
              Every aspect of the process is handled with care — from the initial booking to the final collection —
              ensuring that each qurbani is carried out in a way that is organised, respectful, and aligned with proper standards.
            </p>

            <p className="mt-4 text-[0.95rem] leading-7 text-white/65 sm:text-[1rem] sm:leading-8">
              The introduction of a refined digital platform allows the team to manage operations with greater clarity and coordination, while maintaining the same trusted approach the service is known for.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[32px] border border-white/10 bg-[#161015] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  {
                    name: "Moulana Shaheed Bhabha",
                    role: "Religious Oversight & Guidance",
                  },
                  {
                    name: "Yaqoob Sader",
                    role: "Operations & Coordination",
                  },
                ].map((person) => (
                  <div
                    key={person.name}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center sm:text-left"
                  >
                    <div className="text-sm text-white/40">
                      {person.role}
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {person.name}
                    </div>
                  </div>
                ))}

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-center sm:text-left sm:col-span-2">
                  <div className="text-sm text-white/45">
                    Our Approach
                  </div>
                  <div className="mt-2 text-[0.95rem] leading-6 text-white/70">
                    Structured processes, clear communication, and a focus on delivering a smooth and professional qurbani experience from start to finish.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-18 lg:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <SectionEyebrow>Services</SectionEyebrow>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.4rem] lg:text-[2.9rem]">
              A more refined qurbani experience,
              <br className="hidden sm:block" />
              built around service, clarity, and trust.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[0.98rem] leading-7 text-white/68 sm:text-[1.02rem] sm:leading-8">
              Every part of the Northside Qurbani experience is designed to feel smooth, organised, and easy to navigate for both customers and staff.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 lg:gap-7">
            <FeatureCard
              title="Seamless Ordering"
              text="Customers can place their qurbani booking through a clear and simple process that feels smooth, reliable, and easy to complete."
              icon={<SparkIcon />}
            />
            <FeatureCard
              title="Structured Operations"
              text="The team works from one organised system, making it easier to manage orders, preferences, and day-of coordination."
              icon={<WorkflowIcon />}
            />
            <FeatureCard
              title="Trusted Fulfilment"
              text="A careful and well-managed approach ensures that every stage of the process is handled with consistency and attention to detail."
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
              Bringing clarity and structure
              to every stage of the process.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Booking",
                text: "Customers submit their qurbani order and preferences through a clear and guided process.",
              },
              {
                step: "02",
                title: "Preparation",
                text: "Orders are organised and prepared in advance, allowing the team to plan more effectively.",
              },
              {
                step: "03",
                title: "Live Management",
                text: "Throughout the day, progress and coordination are managed in one place with better visibility.",
              },
              {
                step: "04",
                title: "Collection",
                text: "Collection becomes more structured and straightforward, making the final stage smoother for everyone.",
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
      <section className="py-18 lg:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="overflow-hidden rounded-[40px] border border-white/10 bg-[#171018] p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-10 lg:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="text-center lg:col-span-7 lg:text-left">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b67e]">
                  Why Northside Qurbani stands apart
                </p>

                <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.35rem] lg:text-[2.9rem]">
                  More than a better-looking platform.
                  <br className="hidden sm:block" />
                  A better-run qurbani experience.
                </h2>

                <p className="mt-5 max-w-2xl text-[0.98rem] leading-7 text-white/70 sm:text-[1.04rem] sm:leading-8">
                  The value lies in the clarity, smoother coordination, and overall experience the platform supports, helping the full qurbani process feel more seamless from beginning to end.
                </p>
              </div>

              <div className="lg:col-span-5">
                <div className="grid gap-3">
                  {[
                    {
                      title: "Clearer communication",
                      text: "Customers get a smoother and more professional experience from the start.",
                    },
                    {
                      title: "Better operational control",
                      text: "The team can work with more visibility, less confusion, and better coordination.",
                    },
                    {
                      title: "Stronger brand perception",
                      text: "The entire experience feels more premium, polished, and trustworthy.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 text-center backdrop-blur-xl sm:text-left"
                    >
                      <div className="text-[0.98rem] font-semibold text-white">
                        {item.title}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-white/65">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-18 lg:py-24">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#a98a61]">
              Questions & Answers
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[2.35rem] lg:text-[2.9rem]">
              Frequently asked about the service
              <span className="mt-1 block">and the platform</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[0.98rem] leading-7 text-white/68 sm:text-[1.04rem] sm:leading-8">
              A few of the most common questions about how Northside Qurbani works,
              what the platform adds, and why the experience feels more organised overall.
            </p>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="What makes Northside Qurbani different?"
              answer="Northside Qurbani combines trusted service, careful coordination, and a refined digital platform. The result is a qurbani experience that feels more organised, more professional, and easier for both customers and staff from beginning to end."
            />
            <FAQItem
              question="Can customers submit their qurbani booking online themselves?"
              answer="Yes. Customers can place their order through a clean and simple online flow, making the process clearer, faster, and more convenient while also reducing unnecessary back-and-forth."
            />
            <FAQItem
              question="Why is a digital platform useful for a qurbani service?"
              answer="Because it improves structure. Instead of relying only on manual coordination, the platform keeps important information visible and organised, helping the business run more calmly and giving customers a more premium experience."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-18 lg:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="rounded-[38px] border border-white/10 bg-white/[0.045] p-8 shadow-[0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="text-center lg:col-span-8 lg:text-left">
                <SectionEyebrow>Ready to proceed?</SectionEyebrow>
                <h2 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[2.3rem] lg:text-[2.8rem]">
                  Place your order or continue
                  <span className="mt-1 block">to the staff dashboard</span>
                </h2>
                <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-[#c8bdc3] sm:text-[1.05rem] sm:leading-8">
                  A trusted qurbani service presented through a clear, refined, and easy-to-use digital experience.
                </p>

                {!isStaff && savedOrder ? (
                  <div className="mx-auto mt-5 max-w-xl rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 text-center lg:mx-0 lg:text-left">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#d8b67e]">
                      Your previous booking is saved
                    </div>
                    <div className="mt-2 text-sm text-white/70">
                      You can return to your saved booking at any time on this device.
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#d8b67e]">
                      Reference: {savedOrder.reference}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-center justify-center gap-2.5 lg:col-span-4 lg:items-end lg:justify-end lg:gap-3">
                {isStaff ? (
                  <Link
                    href="/admin"
                    className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                  >
                    Staff Dashboard
                  </Link>
                ) : savedOrder ? (
                  <>
                    <Link
                      href={`/order/success/${savedOrder.id}`}
                      className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                    >
                      View My Order
                    </Link>

                    <Link
                      href="/order"
                      className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:min-w-0 lg:w-auto lg:px-6"
                    >
                      Place Another Order
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/order"
                      className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                    >
                      Place Your Order
                    </Link>

                    <Link
                      href="/login"
                      className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:h-[42px] lg:min-w-0 lg:w-auto lg:px-6"
                    >
                      Staff Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-black/10 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:py-18">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
            <div className="text-center lg:col-span-4 lg:text-left">
              <div className="flex items-center justify-center gap-4 lg:justify-start">
                <div className="grid h-[82px] w-[82px] place-items-center rounded-[24px] border border-white/10 bg-white/5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <Image
                    src="/logo4.png"
                    alt="Northside Qurbani"
                    width={65}
                    height={65}
                    className="object-contain"
                    priority
                  />
                </div>

                <div>
                  <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
                    Northside Qurbani
                  </div>
                  <div className="mt-1 max-w-[16rem] text-sm leading-6 text-white/55 lg:max-w-[18rem]">
                    Premium qurbani service presented through a refined digital experience for customers and staff.
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 sm:text-left">
                <div>
                  <div className="mb-4 text-[0.92rem] font-semibold text-white">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-white/65 transition hover:text-white">
                      Home
                    </a>
                    <a href="#about" className="block text-sm text-white/65 transition hover:text-white">
                      About
                    </a>
                    <a href="#services" className="block text-sm text-white/65 transition hover:text-white">
                      Services
                    </a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-[0.92rem] font-semibold text-white">Platform</div>
                  <div className="space-y-3">
                    <a href="#platform" className="block text-sm text-white/65 transition hover:text-white">
                      How It Works
                    </a>
                    <a href="#faq" className="block text-sm text-white/65 transition hover:text-white">
                      FAQ
                    </a>
                    <a href="/login" className="block text-sm text-white/65 transition hover:text-white">
                      Staff Sign In
                    </a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-[0.92rem] font-semibold text-white">Order</div>
                  <div className="space-y-3">
                    {!isStaff ? (
                      <a href="/order" className="block text-sm text-white/65 transition hover:text-white">
                        Place Order
                      </a>
                    ) : null}
                    {isStaff ? (
                      <a href="/admin" className="block text-sm text-white/65 transition hover:text-white">
                        Staff Dashboard
                      </a>
                    ) : savedOrder ? (
                      <a href={`/order/success/${savedOrder.id}`} className="block text-sm text-white/65 transition hover:text-white">
                        View My Order
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7">
                <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#a98a61]">
                      Northside Qurbani
                    </div>
                    <div className="mt-2 text-[1.15rem] font-semibold tracking-[-0.02em] text-white">
                      Trusted service, elevated presentation
                    </div>
                    <div className="mt-2 max-w-[30rem] text-sm leading-6 text-[#c8bdc3]">
                      Premium qurbani coordination presented through a refined platform designed to support clarity, trust, and a smooth overall experience.
                    </div>

                    {!isStaff && savedOrder ? (
                      <div className="mt-3 text-sm font-semibold text-[#d8b67e]">
                        Saved booking reference: {savedOrder.reference}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:items-center">
                    {isStaff ? (
                      <a
                        href="/admin"
                        className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                      >
                        Staff Dashboard
                      </a>
                    ) : savedOrder ? (
                      <>
                        <a
                          href={`/order/success/${savedOrder.id}`}
                          className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                        >
                          View My Order
                        </a>

                        <a
                          href="/order"
                          className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:min-w-0 lg:w-auto lg:px-6"
                        >
                          Place Another Order
                        </a>
                      </>
                    ) : (
                      <>
                        <a
                          href="/order"
                          className="inline-flex h-[44px] min-w-[182px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px] lg:min-w-0 lg:w-auto lg:px-7"
                        >
                          Place Your Order
                        </a>

                        <a
                          href="/login"
                          className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px] lg:min-w-0 lg:w-auto lg:px-6"
                        >
                          Staff Sign In
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-white/10" />

          <div className="flex flex-col items-center justify-between gap-4 text-sm text-white/45 sm:flex-row">
            <a href="#top" className="transition hover:text-white">
              Back to top ↑
            </a>
            <span>Northside Qurbani • {new Date().getFullYear()}</span>
          </div>
        </div>

        <footer className="mt-20 border-t border-white/10 bg-white/[0.02]">
  <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10">
    
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      
      {/* LEFT */}
      <div className="text-xs text-white/40">
        © {new Date().getFullYear()} Northside Qurbani
      </div>

      {/* RIGHT — YOUR EXPOSURE */}
      <a
        href="https://wa.me/27662385090"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 text-xs text-white/40 transition hover:text-[#d8b67e]"
      >
        <span>Website by</span>
        <span className="font-medium text-white/70 group-hover:text-[#d8b67e]">
          AK Web Design
        </span>

        {/* subtle arrow */}
        <span className="transition group-hover:translate-x-1">→</span>
      </a>

    </div>

  </div>
</footer>
      </footer>
    </main>
  );
}