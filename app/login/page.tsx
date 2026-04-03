"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function getFriendlyError(message: string) {
    if (message.includes("auth/invalid-email")) return "Please enter a valid email address.";
    if (message.includes("auth/user-not-found")) return "No staff account was found with that email.";
    if (message.includes("auth/wrong-password")) return "The password you entered is incorrect.";
    if (message.includes("auth/invalid-credential")) return "The email or password entered is incorrect.";
    if (message.includes("auth/too-many-requests")) return "Too many attempts. Please try again shortly.";
    return "Unable to sign in right now. Please try again.";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      window.location.assign("/admin");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(getFriendlyError(err?.message || ""));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />
        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[##4f422f]/[0.26] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,162,104,0.05),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(74,42,59,0.18),transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-screen bg-[url('/noise.png')]" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <Link href="/" className="flex items-center gap-4">
          <div className="grid h-[78px] w-[78px] place-items-center rounded-[22px] border border-white/10 bg-white/5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <Image
              src="/logo4.png"
              alt="Northside Qurbani"
              width={65}
              height={65}
              className="object-contain"
              priority
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
              Northside Qurbani
            </div>
            <div className="mt-1 text-sm text-white/55">
              Staff access
            </div>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Back Home
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-2 sm:px-10 lg:pb-24 lg:pt-4">
        <div className="grid gap-8 xl:grid-cols-12 xl:gap-10">
          <div className="text-center xl:col-span-6 xl:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl">
              Staff Sign In
            </div>

            <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
              Access the operations
              <span className="mt-1 block">dashboard with</span>
              <span className="mt-1 block">clarity and control.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-[0.98rem] leading-7 text-white/68 sm:text-[1.03rem] sm:leading-8 xl:mx-0">
              Sign in to manage customer bookings, review totals, track payment status,
              and coordinate processing and collection from one refined workspace.
            </p>

            <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-3 xl:mx-0">
              {[
                { title: "Bookings", text: "Review all incoming orders clearly" },
                { title: "Statuses", text: "Update payment and collection progress" },
                { title: "Operations", text: "Keep the day organised and smooth" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/10 bg-white/[0.045] px-5 py-4 text-center shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:text-left"
                >
                  <div className="text-sm text-white/42">{item.title}</div>
                  <div className="mt-1 text-sm font-semibold leading-snug text-white">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-6">
            <div className="mx-auto max-w-xl rounded-[34px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
              <div className="text-center xl:text-left">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                  Staff access
                </p>
                <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.03em] text-white sm:text-[2.2rem]">
                  Sign in to continue
                </h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-white/65">
                  Use your staff credentials to access the dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-6">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-white/82"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-white/82"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
                  />
                </div>

                {error ? (
                  <div className="rounded-[24px] border border-red-400/20 bg-red-400/10 p-4 text-center xl:text-left">
                    <p className="text-sm font-semibold text-red-200">
                      Unable to sign in
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-100/80">
                      {error}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <Link
                    href="/"
                    className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px]"
                  >
                    Back Home
                  </Link>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#4f422f] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-70 sm:text-[15px]"
                  >
                    {submitting ? "Signing In..." : "Sign In"}
                  </button>
                </div>

                <div className="text-center xl:text-left">
                  <Link
                    href="/staff-register"
                    className="text-sm font-medium text-[#d8b67e] transition hover:text-white"
                  >
                    Need staff access? Create a staff account
                  </Link>
                </div>
              </form>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5 text-center xl:text-left">
                <p className="text-sm font-medium text-white/80">
                  Access is restricted to authorised staff only
                </p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Once signed in, staff can manage bookings, review totals, and update
                  order progress throughout the qurbani process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}