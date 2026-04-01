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

      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-2xl">
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">Install App</div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
                Add Northside Qurbani to your Home Screen
              </h3>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 bg-white transition-colors hover:bg-neutral-50"
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
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              <div className="font-semibold text-neutral-950">On iPhone / iPad (Safari):</div>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Tap the <span className="font-semibold">Share</span> button</li>
                <li>Select <span className="font-semibold">Add to Home Screen</span></li>
                <li>Tap <span className="font-semibold">Add</span></li>
              </ol>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              {deferred ? (
                <div>
                  Tap <span className="font-semibold">Install</span> to add quick access for staff on Qurbani day.
                </div>
              ) : (
                <div>
                  Quick access for live order management, payment updates, and collection tracking.
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            {!isIOS ? (
              <button
                type="button"
                onClick={handleInstall}
                className="h-12 flex-1 rounded-2xl bg-neutral-950 font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
                disabled={!deferred}
              >
                Install
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="h-12 flex-1 rounded-2xl border border-neutral-200 bg-white font-semibold transition-colors hover:bg-neutral-50"
            >
              Not now
            </button>
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            Best for staff using the system throughout the day.
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
      className="w-full rounded-[28px] border border-black/5 bg-white p-6 text-left shadow-[0_10px_35px_rgba(0,0,0,0.04)] transition hover:shadow-[0_16px_45px_rgba(0,0,0,0.06)]"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-6">
        <h4 className="text-lg font-semibold text-neutral-950">{question}</h4>
        <span className="flex items-center gap-3 text-neutral-500">
          <span className="hidden text-sm font-medium sm:inline">{open ? "Close" : "Open"}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-700">
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
          <p className="leading-relaxed text-neutral-600">{answer}</p>
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
    <div className="group relative overflow-hidden rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-950 text-white shadow-sm">
          {icon}
        </div>
        <div>
          <h4 className="mb-2 text-2xl font-semibold text-neutral-950">{title}</h4>
          <p className="leading-relaxed text-neutral-600">{text}</p>
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
    "border-neutral-950 bg-neutral-950 text-white shadow-lg shadow-black/10 hover:bg-black";
  const normal = "border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-50";

  return (
    <Link href={href} onClick={onClick} className={`${base} ${variant === "primary" ? primary : normal}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base leading-tight">{label}</div>
          {sub ? (
            <div className={`mt-1 text-xs font-medium ${variant === "primary" ? "text-white/70" : "text-neutral-500"}`}>
              {sub}
            </div>
          ) : null}
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-full transition-all duration-300 ${
            variant === "primary" ? "bg-white/10 text-white" : "bg-neutral-100 text-neutral-700"
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
    <main id="top" className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <InstallAppPrompt />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#f7f7f5]" />
        <div className="absolute inset-0 opacity-[0.02] mix-blend-multiply bg-[url('/noise.png')]" />
      </div>

      {/* NAVBAR */}
      <header className="max-w-7xl mx-auto px-6 sm:px-10 py-7 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-[84px] w-[84px] place-items-center rounded-[22px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <Image
              src="/icon-512 (5).png"
              alt="Northside Qurbani"
              width={62}
              height={62}
              className="object-contain"
              priority
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-lg font-semibold tracking-tight text-neutral-950">Northside Qurbani</div>
            <div className="text-sm text-neutral-500">Modern digital qurbani management</div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <a
            href="#about"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            About
          </a>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            How It Works
          </a>
          <a
            href="#faq"
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            FAQ
          </a>

          {user ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
              >
                Staff Sign In
              </Link>
              <Link
                href="/order"
                className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black"
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
          className="lg:hidden relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm transition-colors hover:bg-neutral-50"
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
            className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-[650ms] ease-out ${
              menuState === "open" ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`absolute right-0 top-0 h-full w-[92%] max-w-sm border-l border-neutral-200 bg-[#f7f7f5] shadow-2xl transition-transform duration-[650ms] ease-[cubic-bezier(.16,1,.3,1)] ${
              menuState === "open" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="relative p-6 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-[76px] w-[76px] place-items-center rounded-[20px] border border-black/5 bg-white shadow-sm">
                    <Image
                      src="/icon-512 (5).png"
                      alt="Northside Qurbani"
                      width={56}
                      height={56}
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold leading-tight text-neutral-950">Northside Qurbani</div>
                    <div className="text-xs text-neutral-500">Menu</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm transition-colors hover:bg-neutral-50"
                  aria-label="Close menu"
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/5" />
                  <CloseIcon />
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                <MenuRow href="/" label="Home" sub="Return to homepage" onClick={closeMenu} />
                <MenuRow href="#about" label="About" sub="Overview of the service" onClick={closeMenu} />
                <MenuRow href="#how-it-works" label="How It Works" sub="The full order process" onClick={closeMenu} />
                <MenuRow href="#faq" label="FAQ" sub="Common questions" onClick={closeMenu} />

                <div className="my-1 h-px bg-neutral-200" />

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
                      sub="Submit your Qurbani booking"
                      onClick={closeMenu}
                      variant="primary"
                    />
                  </>
                )}
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Quick tip</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Add the app to your home screen for quick access on the day.
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
                  <span>© {new Date().getFullYear()} Northside Qurbani</span>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 transition-colors hover:bg-neutral-50"
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
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-8 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm shadow-sm">
              <span className="h-2 w-2 rounded-full bg-neutral-950" />
              <span className="text-neutral-700">Northside Qurbani Management</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-6xl xl:text-7xl font-semibold leading-[0.95] tracking-tight text-neutral-950">
              Premium qurbani,
              <br />
              managed beautifully.
            </h1>

            <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-neutral-600">
              A modern digital experience for customers and staff — making ordering, tracking,
              payment checking, and collection smoother from beginning to end.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/order"
                className="inline-flex h-13 items-center justify-center rounded-full bg-neutral-950 px-8 text-base font-medium text-white shadow-sm transition-colors hover:bg-black"
              >
                Place Your Order
              </Link>

              {user ? (
                <Link
                  href="/admin"
                  className="inline-flex h-13 items-center justify-center rounded-full border border-neutral-200 bg-white px-8 text-base font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                >
                  Open Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-13 items-center justify-center rounded-full border border-neutral-200 bg-white px-8 text-base font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                >
                  Staff Sign In
                </Link>
              )}
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              {[
                { k: "Orders", v: "Submitted online" },
                { k: "Tracking", v: "Updated live" },
                { k: "Collection", v: "Handled clearly" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-[28px] border border-black/5 bg-white px-5 py-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)]"
                >
                  <div className="text-sm text-neutral-500">{item.k}</div>
                  <div className="mt-1 font-semibold text-neutral-950">{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 grid gap-6">
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_14px_50px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-neutral-950 text-white">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                    <path d="M7 12h10M7 8h10M7 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.25em] text-neutral-500">Designed For</div>
                  <div className="text-xl font-semibold text-neutral-950">Customers & Staff</div>
                </div>
              </div>

              <p className="mt-5 text-neutral-600 leading-relaxed">
                Customers get a polished ordering experience, while staff get a clean live dashboard for
                payments, slaughter progress, slicing instructions, and collection status.
              </p>
            </div>

            <div className="rounded-[32px] border border-neutral-900/5 bg-neutral-950 p-8 text-white shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
              <div className="text-sm uppercase tracking-[0.25em] text-white/50">Live Overview</div>
              <h3 className="mt-2 text-2xl font-semibold">Everything visible at a glance</h3>
              <p className="mt-3 leading-relaxed text-white/70">
                Customer details, sheep count, payment status, slicing preferences, and collection updates —
                all from one refined workspace.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {["Customer", "Paid", "Slaughtered", "Collected"].map((t) => (
                  <div key={t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-sm text-white/60">{t}</div>
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
          <div className="rounded-[32px] border border-black/5 bg-white p-10 shadow-[0_14px_50px_rgba(0,0,0,0.04)]">
            <p className="mb-3 text-sm uppercase tracking-[0.25em] text-neutral-500">About Northside Qurbani</p>
            <h2 className="text-4xl font-semibold tracking-tight text-neutral-950">
              A more professional and organised way to manage qurbani
            </h2>

            <div className="mt-6 grid md:grid-cols-2 gap-8">
              <p className="text-lg leading-relaxed text-neutral-600">
                The system removes unnecessary back-and-forth, manual capturing, and day-of confusion.
                Customers place their order through one simple flow, and every detail is stored neatly for staff.
              </p>
              <p className="text-lg leading-relaxed text-neutral-600">
                From the first booking to the final collection, the experience feels smoother, clearer,
                and more refined for everyone involved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-8 pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">How it works</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
              A smooth flow from booking to handover
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-5">
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
                text: "On qurbani day, staff can search customers quickly and update statuses as sheep are processed.",
              },
              {
                step: "04",
                title: "Collection",
                text: "Final collection is tracked clearly, helping keep the handover organised and efficient.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)]"
              >
                <div className="text-sm font-semibold tracking-[0.2em] text-neutral-500">{item.step}</div>
                <h3 className="mt-3 text-xl font-semibold text-neutral-950">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-neutral-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-8 pb-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">System highlights</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
              Built for clarity, elegance, and speed
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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
              title="Professional Experience"
              text="A polished digital system builds trust, improves organisation, and creates a more premium customer experience."
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
        <div className="max-w-4xl mx-auto px-6 sm:px-10">
          <div className="mb-12 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">Questions & Answers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">Frequently Asked Questions</h2>
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
              answer="It reduces manual recapturing, improves speed, keeps details in one place, and presents a more professional experience to both staff and customers."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="rounded-[32px] border border-black/5 bg-white p-10 shadow-[0_14px_50px_rgba(0,0,0,0.04)]">
            <div className="grid md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-8">
                <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">Ready to proceed?</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
                  Place your order or continue to the staff dashboard
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-neutral-600">
                  A complete digital workflow for bookings, live tracking, and a smoother qurbani day.
                </p>
              </div>

              <div className="md:col-span-4 flex md:justify-end gap-3">
                <Link
                  href="/order"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-neutral-950 px-7 text-base font-medium text-white shadow-sm transition-colors hover:bg-black"
                >
                  Place Order
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-200 bg-white px-7 text-base font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                >
                  Staff Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-4">
                <div className="grid h-[78px] w-[78px] place-items-center rounded-[20px] border border-black/5 bg-white shadow-sm">
                  <Image
                    src="/icon-512 (5).png"
                    alt="Northside Qurbani"
                    width={56}
                    height={56}
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold text-neutral-950">Northside Qurbani</div>
                  <div className="text-sm text-neutral-500">Modern digital qurbani operations</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                <div>
                  <div className="mb-4 text-sm font-semibold text-neutral-950">Explore</div>
                  <div className="space-y-3">
                    <a href="/" className="block text-sm text-neutral-600 hover:text-black">Home</a>
                    <a href="#about" className="block text-sm text-neutral-600 hover:text-black">About</a>
                    <a href="#faq" className="block text-sm text-neutral-600 hover:text-black">FAQ</a>
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-neutral-950">Access</div>
                  <div className="space-y-3">
                    <a href="/order" className="block text-sm text-neutral-600 hover:text-black">Place Order</a>
                    <a href="/login" className="block text-sm text-neutral-600 hover:text-black">Staff Sign In</a>
                    {user ? (
                      <a href="/admin" className="block text-sm text-neutral-600 hover:text-black">Dashboard</a>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mb-4 text-sm font-semibold text-neutral-950">Service</div>
                  <div className="space-y-3">
                    <a href="#how-it-works" className="block text-sm text-neutral-600 hover:text-black">How It Works</a>
                    <a href="#faq" className="block text-sm text-neutral-600 hover:text-black">Questions</a>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-neutral-500">Northside Portal</div>
                    <div className="mt-1 text-lg font-semibold text-neutral-950">A cleaner way to manage qurbani</div>
                    <div className="mt-1 text-sm text-neutral-600">
                      Orders, tracking, slicing instructions, and collection — all together.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/order"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-medium text-white hover:bg-black"
                    >
                      Place Order
                    </a>
                    <a
                      href="/login"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-6 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
                    >
                      Staff Sign In
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-10 h-px bg-neutral-200" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
            <a href="#top" className="hover:text-black">Back to top ↑</a>
            <span>Northside Qurbani • {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}