"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type FormData = {
  fullName: string;
  phone: string;
  email: string;
  quantity: string;
  preferredWeight: string;
  collectionDay: string;
  collectionTime: string;
  cutPreference: string;
  notes: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof FormData, string>>;

const initialForm: FormData = {
  fullName: "",
  phone: "",
  email: "",
  quantity: "",
  preferredWeight: "",
  collectionDay: "",
  collectionTime: "",
  cutPreference: "",
  notes: "",
  agree: false,
};

const quantityOptions = ["1", "2", "3", "4", "5+"];
const weightOptions = [
  "No preference",
  "Smaller side",
  "Medium",
  "Larger side",
];
const collectionDayOptions = [
  "Day 1",
  "Day 2",
  "Day 3",
];
const collectionTimeOptions = [
  "Morning",
  "Afternoon",
  "Evening",
  "Flexible",
];
const cutOptions = [
  "Standard cut",
  "Smaller portions",
  "Larger portions",
  "Leave as large cuts",
];

function Label({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-white/80"
    >
      {children}
      {required ? <span className="ml-1 text-[#d8b67e]">*</span> : null}
    </label>
  );
}

function Input({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-12 w-full rounded-2xl border bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:bg-white/[0.07] ${
          error
            ? "border-red-400/70"
            : "border-white/10 focus:border-[#c6a268]/60"
        }`}
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full rounded-2xl border bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition focus:bg-white/[0.07] ${
          error
            ? "border-red-400/70"
            : "border-white/10 focus:border-[#c6a268]/60"
        }`}
      >
        <option value="" disabled className="text-black">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option} className="text-black">
            {option}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function TextArea({
  id,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className={`w-full rounded-2xl border bg-white/[0.05] px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:bg-white/[0.07] ${
          error
            ? "border-red-400/70"
            : "border-white/10 focus:border-[#c6a268]/60"
        }`}
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm text-white/45">{label}</span>
      <span className="text-right text-sm font-medium text-white">
        {value || "—"}
      </span>
    </div>
  );
}

export default function OrderPage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const filledCount = useMemo(() => {
    const fields = [
      form.fullName,
      form.phone,
      form.quantity,
      form.preferredWeight,
      form.collectionDay,
      form.collectionTime,
      form.cutPreference,
    ];
    return fields.filter(Boolean).length;
  }, [form]);

  const progress = Math.round((filledCount / 7) * 100);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const nextErrors: Errors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Please enter your full name.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone number.";
    if (!form.quantity) nextErrors.quantity = "Please select quantity.";
    if (!form.preferredWeight) nextErrors.preferredWeight = "Please select a preference.";
    if (!form.collectionDay) nextErrors.collectionDay = "Please select a collection day.";
    if (!form.collectionTime) nextErrors.collectionTime = "Please select a collection time.";
    if (!form.cutPreference) nextErrors.cutPreference = "Please select a cut preference.";
    if (!form.agree) nextErrors.agree = "Please confirm before submitting.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Replace this with your Firestore / backend submission logic next.
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
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

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <Link href="/" className="flex items-center gap-4">
          <div className="grid h-[78px] w-[78px] place-items-center rounded-[22px] border border-white/10 bg-white/5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <Image
              src="/logo4.png"
              alt="Northside Qurbani"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </div>
          <div className="hidden sm:block">
            <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
              Northside Qurbani
            </div>
            <div className="mt-1 text-sm text-white/55">
              Premium qurbani service
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Back Home
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#4a2a3b] px-5 text-sm font-medium text-white transition hover:bg-[#3c2130]"
          >
            Staff Sign In
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-2 sm:px-10 lg:pb-24 lg:pt-4">
        <div className="grid gap-8 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl">
              Place Order
            </div>

            <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.03] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
              Complete your qurbani
              <span className="mt-1 block">booking with clarity</span>
              <span className="mt-1 block">and confidence.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-[1rem] leading-7 text-white/68 sm:text-[1.05rem] sm:leading-8">
              Fill in the details below and submit your booking through a clear,
              premium ordering experience designed to make the process simple and smooth.
            </p>

            <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-[#d8b67e]">
                    Booking progress
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    Complete the details below to submit your order.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{progress}%</div>
                  <div className="text-xs text-white/45">Completed</div>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#c6a268_0%,#e3c794_100%)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 rounded-[34px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7"
            >
              <div className="grid gap-8">
                <div>
                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                      Customer details
                    </p>
                    <h2 className="mt-2 text-[1.45rem] font-semibold text-white">
                      Your information
                    </h2>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="fullName" required>
                        Full name
                      </Label>
                      <Input
                        id="fullName"
                        value={form.fullName}
                        onChange={(value) => updateField("fullName", value)}
                        placeholder="Enter your full name"
                        error={errors.fullName}
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone" required>
                        Phone number
                      </Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(value) => updateField("phone", value)}
                        placeholder="Enter your phone number"
                        error={errors.phone}
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">
                        Email address <span className="text-white/35">(optional)</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(value) => updateField("email", value)}
                        placeholder="Enter your email address"
                        error={errors.email}
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div>
                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                      Order details
                    </p>
                    <h2 className="mt-2 text-[1.45rem] font-semibold text-white">
                      Booking preferences
                    </h2>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="quantity" required>
                        Quantity
                      </Label>
                      <Select
                        id="quantity"
                        value={form.quantity}
                        onChange={(value) => updateField("quantity", value)}
                        options={quantityOptions}
                        placeholder="Select quantity"
                        error={errors.quantity}
                      />
                    </div>

                    <div>
                      <Label htmlFor="preferredWeight" required>
                        Preferred weight
                      </Label>
                      <Select
                        id="preferredWeight"
                        value={form.preferredWeight}
                        onChange={(value) => updateField("preferredWeight", value)}
                        options={weightOptions}
                        placeholder="Select weight preference"
                        error={errors.preferredWeight}
                      />
                    </div>

                    <div>
                      <Label htmlFor="collectionDay" required>
                        Collection day
                      </Label>
                      <Select
                        id="collectionDay"
                        value={form.collectionDay}
                        onChange={(value) => updateField("collectionDay", value)}
                        options={collectionDayOptions}
                        placeholder="Select collection day"
                        error={errors.collectionDay}
                      />
                    </div>

                    <div>
                      <Label htmlFor="collectionTime" required>
                        Collection time
                      </Label>
                      <Select
                        id="collectionTime"
                        value={form.collectionTime}
                        onChange={(value) => updateField("collectionTime", value)}
                        options={collectionTimeOptions}
                        placeholder="Select collection time"
                        error={errors.collectionTime}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="cutPreference" required>
                        Cutting preference
                      </Label>
                      <Select
                        id="cutPreference"
                        value={form.cutPreference}
                        onChange={(value) => updateField("cutPreference", value)}
                        options={cutOptions}
                        placeholder="Select cutting preference"
                        error={errors.cutPreference}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="notes">
                        Additional notes <span className="text-white/35">(optional)</span>
                      </Label>
                      <TextArea
                        id="notes"
                        value={form.notes}
                        onChange={(value) => updateField("notes", value)}
                        placeholder="Add any additional notes or requests"
                        error={errors.notes}
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div>
                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <input
                      type="checkbox"
                      checked={form.agree}
                      onChange={(e) => updateField("agree", e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c6a268]"
                    />
                    <div>
                      <p className="text-sm text-white/80">
                        I confirm that the information provided above is correct.
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Please review your details carefully before submitting your booking.
                      </p>
                    </div>
                  </label>
                  {errors.agree ? (
                    <p className="mt-2 text-xs text-red-300">{errors.agree}</p>
                  ) : null}
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <Link
                    href="/"
                    className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px]"
                  >
                    Back Home
                  </Link>

                  <button
                    type="submit"
                    className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] sm:text-[15px]"
                  >
                    Submit Booking
                  </button>
                </div>

                {submitted ? (
                  <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <p className="text-sm font-semibold text-emerald-200">
                      Booking ready
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-100/80">
                      Your form has passed validation. The next step is to connect this
                      submit action to your backend or Firestore so the booking is saved.
                    </p>
                  </div>
                ) : null}
              </div>
            </form>
          </div>

          <div className="xl:col-span-5">
            <div className="sticky top-6 space-y-6">
              <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                  Booking summary
                </p>
                <h2 className="mt-3 text-[1.6rem] font-semibold text-white">
                  Review your details
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  As you complete the form, your booking summary will update here.
                </p>

                <div className="mt-6">
                  <SummaryRow label="Full name" value={form.fullName} />
                  <SummaryRow label="Phone" value={form.phone} />
                  <SummaryRow label="Quantity" value={form.quantity} />
                  <SummaryRow label="Weight" value={form.preferredWeight} />
                  <SummaryRow label="Collection day" value={form.collectionDay} />
                  <SummaryRow label="Collection time" value={form.collectionTime} />
                  <SummaryRow label="Cutting preference" value={form.cutPreference} />
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                  Why this experience feels different
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    "Clear, guided booking flow",
                    "Structured order capture",
                    "Premium customer experience",
                    "Designed for mobile and desktop",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                  Need staff access?
                </p>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Staff can sign in separately to manage bookings, view order information,
                  and coordinate updates throughout the process.
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/10 sm:text-[14px]"
                >
                  Staff Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}