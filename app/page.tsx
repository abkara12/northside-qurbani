"use client";

import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#09070b] text-white overflow-x-hidden">
      
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />

        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/10 blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#141016]/30 blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/10 blur-3xl" />
      </div>

      {/* NAVBAR */}
      <header className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-[70px] w-[70px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
            <Image
              src="/logo4.png"
              alt="Logo"
              width={55}
              height={55}
              className="object-contain"
            />
          </div>

          <div>
            <div className="font-semibold text-lg">Northside Qurbani</div>
            <div className="text-sm text-white/50">Premium Qurbani Service</div>
          </div>
        </div>

        <Link
          href="/admin"
          className="text-sm border border-white/10 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10"
        >
          Admin
        </Link>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20 text-center">
        <h1 className="text-[2.8rem] sm:text-[3.8rem] font-semibold leading-[1.1] tracking-[-0.04em]">
          A seamless Qurbani
          <span className="block text-[#d8b67e]">experience.</span>
        </h1>

        <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[1.05rem] leading-7">
          Book your qurbani with ease. Select your sheep, confirm your order, and
          track your booking — all in one place.
        </p>

        {/* BUTTONS */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/order"
            className="h-[50px] px-8 rounded-full bg-[#c6a268] text-black font-semibold flex items-center justify-center"
          >
            Place Order
          </Link>

          <Link
            href="/lookup"
            className="h-[50px] px-8 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white/10"
          >
            Find My Booking
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="font-semibold text-lg">Simple Booking</h3>
          <p className="mt-2 text-sm text-white/60">
            Choose your sheep sizes, preferences, and submit your booking in minutes.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="font-semibold text-lg">Live Status</h3>
          <p className="mt-2 text-sm text-white/60">
            Track your qurbani — pending, slaughtered, or delivered.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="font-semibold text-lg">Easy Lookup</h3>
          <p className="mt-2 text-sm text-white/60">
            Find your booking anytime using your reference or phone number.
          </p>
        </div>

      </section>

      {/* FOOTER */}
      <footer className="text-center pb-10 text-sm text-white/40">
        Built by AK Web Design
      </footer>
    </main>
  );
}