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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/15 bg-[#101614]/95 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#bfa06a]/18 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#3f5a4d]/20 blur-3xl" />
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#d3b57a]">Install App</div>
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
                  Tap <span className="font-semibold text-white">Install</span> to give staff quick access on Qurbani day.
                </div>
              ) : (
                <div>
                  Quick access for live order management, payment checks, and collection tracking.
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {!isIOS ? (
              <button
                type="button"
                onClick={handleInstall}
                className="h-12 flex-1 rounded-2xl bg-[#d3b57a] font-semibold text-[#111714] transition hover:brightness-105 disabled:opacity-60"
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

/* ---------------- UI Components ---------------- */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-[30px] border border-[#e7e1d8] bg-white/80 p-6 text-left shadow-[0_14px_40px_rgba(17,24,21,0.06)] backdrop-blur-xl transition hover:shadow-[0_18px_55px_rgba(17,24,21,0.09)]"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-6">
        <h4 className="text-lg font-semibold text-[#141816]">{question}</h4>
        <span className="flex items-center gap-3 text-[#486252]">
          <span className="hidden text-sm font-medium sm:inline">{open ? "Close" : "Open"}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eef3ef] text-[#486252]">
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
          <p className="leading-relaxed text-[#56605b]">{answer}</p>
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
    <div className="group relative overflow-hidden rounded-[32px] border border-[#e8e1d7] bg-white/78 p-8 shadow-[0_16px_44px_rgba(17,24,21,0.06)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(17,24,21,0.1)]">
      <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-[#d3b57a]/12 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#16201c] text-[#d9bf87] shadow-sm">
          {icon}
        </div>
        <div>
          <h4 className="mb-2 text-2xl font-semibold text-[#141816]">{title}</h4>
          <p className="leading-relaxed text-[#56605b]">{text}</p>
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
    "border-[#16201c] bg-[#16201c] text-white shadow-lg shadow-black/10 hover:bg-[#111915]";
  const normal = "border-[#e4ddd4] bg-white text-[#141816] shadow-sm hover:bg-[#f9f7f3]";

  return (
    <Link href={href} onClick={onClick} className={`${base} ${variant === "primary" ? primary : normal}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base leading-tight">{label}</div>
          {sub ? (
            <div className={`mt-1 text-xs font-medium ${variant === "primary" ? "text-white/70" : "text-[#7a847f]"}`}>
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-full transition-all duration-300 ${
            variant === "primary" ? "bg-white/10 text-[#d9bf87]" : "bg-[#eef3ef] text-[#486252]"
          }`}
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
    <main id="top" className="min-h-screen bg-[#f6f3ee] text-[#141816] overflow-x-hidden">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#f6f3ee]" />
        <div className="absolute top-[-12rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[#d3b57a]/12 blur-3xl" />
        <div className="absolute bottom-[-14rem] left-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#41594d]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.018] mix-blend-multiply bg-[url('/noise.png')]" />
      </div>

      {/* NAVBAR */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-4">
          <div className="grid h-[88px] w-[88px] place-items-center rounded-[26px] border border-white/60 bg-white/70 shadow-[0_18px_50px_rgba(17,24,21,0.08)] backdrop-blur-xl">
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
            <div className="text-lg font-semibold tracking-tight text-[#141816]">Northside Qurbani</div>
            <div className="text-sm text-[#68716d]">Luxury digital qurbani management</div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-2 shadow-[0_10px_35px_rgba(17,24,21,0.05)] backdrop-blur-xl">
          <a
            href="#about"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f3f0ea]"
          >
            About
          </a>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f3f0ea]"
          >
            How It Works
          </a>
          <a
            href="#faq"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f3f0ea]"
          >
            FAQ
          </a>

          {user ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#16201c] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#111915]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-[#141816] transition hover:bg-[#f3f0ea]"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#16201c] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#111915]"
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
          className="lg:hidden relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/70 text-[#141816] shadow-sm backdrop-blur-xl transition hover:bg-white"
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
            className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-[650ms] ease-out ${
              menuState === "open" ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-white/10 bg-[#101614]/95 shadow-2xl backdrop-blur-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
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
                    <div className="text-sm font-semibold leading-tight text-white">Northside Qurbani</div>
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
                <MenuRow href="#about" label="About" sub="Overview of the service" onClick={closeMenu} />
                <MenuRow href="#how-it-works" label="How It Works" sub="The full order process" onClick={closeMenu} />
                <MenuRow href="#faq" label="FAQ" sub="Common questions" onClick={closeMenu} />

                <div className="my-1 h-px bg-white/10" />

                {user ? (
                  <MenuRow
                    href="/admin"
                    label="Dashboard"
                    sub="Manage live orders and statuses"
                    onClick={closeMenu}
                    variant="primary"
                  />
                ) : (
                  <>
                    <MenuRow href="/login" label="Staff Sign In" sub="Access the operations dashboard" onClick={closeMenu} />
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
                  <div className="text-xs uppercase tracking-[0.25em] text-[#d3b57a]">Quick tip</div>
                  <div className="mt-1 text-sm text-white/70">
                    Add the app to your home screen for fast access on the day.
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
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-8 sm:px-10">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/65 px-4 py-2 text-sm shadow-sm backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[#486252]" />
              <span className="text-[#56605b]">Northside Qurbani Management Platform</span>
            </div>

            <h1 className="mt-7 text-5xl font-semibold leading-[0.92] tracking-[-0.04em] text-[#141816] sm:text-6xl xl:text-7xl">
              Premium qurbani operations,
              <br />
              beautifully managed.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#56605b] sm:text-xl">
              A high-end digital experience for customers and staff — designed to make ordering,
              payment verification, slaughter tracking, slicing notes, and collection feel seamless.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/order"
                className="inline-flex h-14 items-center justify-center rounded-full bg-[#16201c] px-8 text-base font-medium text-white shadow-[0_14px_32px_rgba(17,24,21,0.18)] transition hover:bg-[#111915]"
              >
                Place Your Order
              </Link>

              {user ? (
                <Link
                  href="/admin"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#ddd5ca] bg-white/80 px-8 text-base font-medium text-[#141816] backdrop-blur-xl transition hover:bg-white"
                >
                  Open Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-[#ddd5ca] bg-white/80 px-8 text-base font-medium text-[#141816] backdrop-blur-xl transition hover:bg-white"
                >
                  Staff Sign In
                </Link>
              )}
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { k: "Orders", v: "Captured digitally" },
                { k: "Tracking", v: "Updated in real time" },
                { k: "Collection", v: "Handled with clarity" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-[28px] border border-white/60 bg-white/70 px-5 py-5 shadow-[0_12px_32px_rgba(17,24,21,0.05)] backdrop-blur-xl"
                >
                  <div className="text-sm text-[#7b837f]">{item.k}</div>
                  <div className="mt-1 font-semibold text-[#141816]">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative h-full overflow-hidden rounded-[36px] border border-white/10 bg-[#101614] p-8 text-white shadow-[0_24px_80px_rgba(12,16,14,0.32)]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-[#d3b57a]/12 blur-3xl" />
                <div className="absolute bottom-[-3rem] left-[-3rem] h-40 w-40 rounded-full bg-[#486252]/20 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
              </div>

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#d3b57a]">
                  Refined Operations
                </div>

                <h3 className="mt-6 text-3xl font-semibold leading-tight">
                  Everything your team needs,
                  <br />
                  in one premium workspace.
                </h3>

                <p className="mt-4 leading-relaxed text-white/72">
                  Customer details, sheep quantity, payment status, slaughter progress,
                  slicing instructions, and collection updates — all visible at a glance.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    ["Customer Details", "Captured clearly and searchable instantly"],
                    ["Payment Verification", "Marked quickly by staff"],
                    ["Slaughter Progress", "Updated live throughout the day"],
                    ["Collection Tracking", "Avoid confusion at handover"],
                  ].map(([title, text]) => (
                    <div
                      key={title}
                      className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                    >
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="mt-1 text-sm text-white/60">{text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {["Customer", "Paid", "Processed", "Collected"].map((t) => (
                    <div key={t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-sm text-white/55">{t}</div>
                      <div className="mt-1 text-sm font-semibold text-[#d9bf87]">Live</div>
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
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="rounded-[36px] border border-white/60 bg-white/70 p-10 shadow-[0_18px_50px_rgba(17,24,21,0.06)] backdrop-blur-xl">
            <p className="mb-3 text-sm uppercase tracking-[0.25em] text-[#486252]">About Northside Qurbani</p>
            <h2 className="text-4xl font-semibold tracking-tight text-[#141816]">
              A more professional, organised, and premium way to manage qurbani
            </h2>

            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <p className="text-lg leading-relaxed text-[#56605b]">
                The platform removes unnecessary back-and-forth, manual capturing, and day-of confusion.
                Customers place orders through one smooth digital flow, and every detail is stored neatly for staff.
              </p>
              <p className="text-lg leading-relaxed text-[#56605b]">
                From the first booking to the final collection, the experience feels cleaner, faster,
                and significantly more refined for everyone involved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="pb-24 pt-6">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.25em] text-[#486252]">How it works</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
              A smooth journey from booking to collection
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Customer Books",
                text: "The customer submits their order, sheep quantity, preferred weight, slicing preferences, and notes.",
              },
              {
                step: "02",
                title: "Staff Prepare",
                text: "Orders appear instantly in the dashboard, ready for payment checks, ticket allocation, and preparation.",
              },
              {
                step: "03",
                title: "Live Tracking",
                text: "On Qurbani day, staff can search customers quickly and update statuses as sheep are processed.",
              },
              {
                step: "04",
                title: "Collection",
                text: "Final collection is tracked clearly, helping keep the handover organised and efficient.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-[30px] border border-[#e7e1d8] bg-white/78 p-6 shadow-[0_14px_38px_rgba(17,24,21,0.05)] backdrop-blur-xl"
              >
                <div className="text-sm font-semibold tracking-[0.2em] text-[#486252]">{item.step}</div>
                <h3 className="mt-3 text-xl font-semibold text-[#141816]">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-[#56605b]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="pb-24 pt-6">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.25em] text-[#486252]">System highlights</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">
              Built for clarity, speed, and luxury-level presentation
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              title="Digital Order Capture"
              text="Customers enter their details through a clean ordering flow, reducing manual admin and improving accuracy."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" />
                </svg>
              }
            />
            <FeatureCard
              title="Operational Control"
              text="Staff can manage payment status, slaughter progress, slicing details, and collection updates from one place."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <FeatureCard
              title="Premium Experience"
              text="A polished system builds trust, improves organisation, and presents the company as modern, efficient, and professional."
              icon={
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                  <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-10">
          <div className="mb-12 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-[#486252]">Questions & Answers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#141816]">Frequently Asked Questions</h2>
          </div>

          <div className="grid gap-4">
            <FAQItem
              question="Can customers place their order online themselves?"
              answer="Yes. Customers can submit their order directly through the system, allowing staff to receive all details in a clean and organised format."
            />
            <FAQItem
              question="Can staff use the system on the day from a phone?"
              answer="Yes. The interface is designed to work smoothly on mobile so staff can search customers quickly and update progress live."
            />
            <FAQItem
              question="What can staff track in the system?"
              answer="The system can track customer details, sheep quantity, preferred weight, slicing preferences, notes, payment status, slaughter progress, and collection status."
            />
            <FAQItem
              question="Why is this better than only using WhatsApp and spreadsheets?"
              answer="It reduces manual recapturing, improves speed, keeps details in one place, and presents a far more professional experience to both staff and customers."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[#101614] p-10 text-white shadow-[0_24px_80px_rgba(12,16,14,0.28)]">
            <div className="pointer-events-none absolute" />
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div className="md:col-span-8">
                <p className="text-sm uppercase tracking-[0.25em] text-[#d3b57a]">Ready to proceed?</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                  Place your order or continue to the staff dashboard
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-white/72">
                  A complete digital workflow for bookings, live tracking, and a smoother qurbani day.
                </p>
              </div>

              <div className="flex gap-3 md:col-span-4 md:justify-end">
                <Link
                  href="/order"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#d3b57a] px-7 text-base font-medium text-[#111714] shadow-sm transition hover:brightness-105"
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
                  <div className="text-sm text-[#68716d]">Luxury digital qurbani operations</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-[#56605b] hover:text-black">Home</a>
                    <a href="#about" className="block text-sm text-[#56605b] hover:text-black">About</a>
                    <a href="#faq" className="block text-sm text-[#56605b] hover:text-black">FAQ</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Access</div>
                  <div className="space-y-3">
                    <a href="/order" className="block text-sm text-[#56605b] hover:text-black">Place Order</a>
                    <a href="/login" className="block text-sm text-[#56605b] hover:text-black">Staff Sign In</a>
                    {user ? (
                      <a href="/admin" className="block text-sm text-[#56605b] hover:text-black">Dashboard</a>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-[#141816]">Service</div>
                  <div className="space-y-3">
                    <a href="#how-it-works" className="block text-sm text-[#56605b] hover:text-black">How It Works</a>
                    <a href="#faq" className="block text-sm text-[#56605b] hover:text-black">Questions</a>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-[30px] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-[#486252]">Northside Portal</div>
                    <div className="mt-1 text-lg font-semibold text-[#141816]">A cleaner way to manage qurbani</div>
                    <div className="mt-1 text-sm text-[#56605b]">
                      Orders, tracking, slicing instructions, and collection — all together.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/order"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[#16201c] px-6 text-sm font-medium text-white hover:bg-[#111915]"
                    >
                      Place Order
                    </a>
                    <a
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[#ddd5ca] bg-white px-6 text-sm font-medium text-[#141816] transition hover:bg-[#f8f6f2]"
                    >
                      Staff Sign In
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-[#e5ddd2]" />

          <div className="flex flex-col items-center justify-between gap-4 text-sm text-[#7b837f] sm:flex-row">
            <a href="#top" className="hover:text-black">Back to top ↑</a>
            <span>Northside Qurbani • {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}