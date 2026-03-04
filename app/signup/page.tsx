"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";

function friendlySignupError(code?: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    default:
      return "Signup failed. Please try again.";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // ✅ Create a profile doc so Admin can search students by email + set roles
     await setDoc(
  doc(db, "users", cred.user.uid),
  {
    email: (cred.user.email ?? cleanEmail).toLowerCase(),
    username: username.trim(),
    role: "student",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);

      router.push("/");
    } catch (error: any) {
      setErr(friendlySignupError(error?.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-gray-900">
      {/* background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#efe8da] via-[#f7f4ee] to-white" />
        <div className="absolute -top-56 left-[-10%] h-[780px] w-[780px] rounded-full bg-[#B8963D]/30 blur-3xl" />
        <div className="absolute top-[-20%] right-[-15%] h-[900px] w-[900px] rounded-full bg-black/20 blur-3xl" />
        <div className="absolute -bottom-72 left-[20%] h-[980px] w-[980px] rounded-full bg-[#B8963D]/22 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(0,0,0,0.18) 1px, transparent 1px), linear-gradient(-45deg, rgba(0,0,0,0.18) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            backgroundPosition: "0 0, 36px 36px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_15%,transparent_55%,rgba(0,0,0,0.12))]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        {/* top */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="h-[80px] w-[85px] rounded-xl bg-white/100 backdrop-blur border border-gray-300 shadow-sm grid place-items-center">
              <Image src="/logo4.png" alt="Hifdh Journal" width={58} height={58} className="rounded" />
            </div>
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-black">
            Already have an account? <span className="text-[#B8963D]">Sign In</span>
          </Link>
        </div>

        <div className="mt-10 grid lg:grid-cols-12 gap-8 items-stretch">
          {/* left */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur-xl backdrop-blur p-8 shadow-lg">
              <p className="uppercase tracking-widest text-xs text-[#B8963D]">Student Portal</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight leading-tight">
                Create your account
              </h1>
              <p className="mt-3 text-gray-700 leading-relaxed">
                Sign up to track <span className="font-semibold">Sabak</span>,{" "}
                <span className="font-semibold">Sabak Dhor</span>,{" "}
                <span className="font-semibold">Dhor</span> and your{" "}
                <span className="font-semibold">weekly goals</span>.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {["Secure login", "Private progress", "Weekly targets", "Clean overview"].map(
                  (t) => (
                    <div
                      key={t}
                      className="rounded-2xl border border-gray-300 bg-white/70 px-4 py-4 text-sm font-medium"
                    >
                      {t}
                      <div className="mt-1 h-1 w-10 rounded-full bg-[#B8963D]/60" />
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-black text-white p-7 shadow-xl relative overflow-hidden">
              <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#B8963D]/25 blur-2xl" />
              <p className="text-white/70 text-sm italic leading-relaxed">
                “And We have certainly made the Qur’an easy for remembrance, so is there any who
                will remember?”
              </p>
              <p className="mt-4 text-white/70 text-sm">Surah Al-Qamar • 54:17</p>
            </div>
          </div>

          {/* right form */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur p-8 shadow-lg">
              <h2 className="text-2xl font-semibold tracking-tight">Sign Up</h2>
              <p className="mt-2 text-sm text-gray-600">
                Use your email to create your student account.
              </p>

              {err && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {err}
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <div>
              <label className="text-sm font-medium text-gray-800">
              Student's Name
              </label>
              <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
                required
                  placeholder="e.g. Muhammad Ahmed"
                className="mt-2 w-full h-12 rounded-2xl border border-gray-300 bg-white/80 px-4 outline-none focus:ring-2 focus:ring-[#B8963D]/40"
                />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-800">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder="student@email.com"
                    className="mt-2 w-full h-12 rounded-2xl border border-gray-300 bg-white/80 px-4 outline-none focus:ring-2 focus:ring-[#B8963D]/40"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-800">Password</label>

                  <div className="mt-2 relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Minimum 6 characters"
                      className="w-full h-12 rounded-2xl border border-gray-300 bg-white/80 px-4 pr-24 outline-none focus:ring-2 focus:ring-[#B8963D]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-3 rounded-xl border border-gray-300 bg-white/70 text-sm font-medium hover:bg-white"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="mt-2 h-12 rounded-2xl bg-black text-white font-semibold hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create Account"}
                </button>

                <div className="text-sm text-gray-600 text-center">
                  By signing up you agree to use the portal respectfully.
                </div>
              </form>

              <div className="mt-6 text-center text-sm text-gray-700">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-[#B8963D] hover:underline">
                  Sign In
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
