"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type WeightOption = {
  label: string;
  price: number;
};

const weightOptions: WeightOption[] = [
  { label: "35–39 kg — R2750", price: 2750 },
  { label: "40–45 kg — R3150", price: 3150 },
  { label: "46–50 kg — R3500", price: 3500 },
  { label: "51–55 kg — R3850", price: 3850 },
  { label: "56–60 kg — R4200", price: 4200 },
];

const cutPreferenceOptions = [
  "Curry packs",
  "Chops",
  "Ribs",
  "Whole leg",
  "Liver",
  "Back legs sliced",
  "Front leg whole",
  "Front leg sliced",
];

type FormData = {
  fullName: string;
  phone: string;
  email: string;
  quantity: string;
  preferredWeight: string;
  addServices: boolean;
  delivery: boolean;
  cutPreferences: string[];
  notes: string;
  agree: boolean;
};

type Errors = Partial<Record<keyof FormData, string>>;

const initialForm: FormData = {
  fullName: "",
  phone: "",
  email: "",
  quantity: "1",
  preferredWeight: "",
  addServices: false,
  delivery: false,
  cutPreferences: [],
  notes: "",
  agree: false,
};

function formatZAR(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

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
      className="mb-2 block text-sm font-medium text-white/82"
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
  min,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  min?: number;
  error?: string;
}) {
  return (
    <div>
      <input
        id={id}
        type={type}
        min={min}
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
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <span className={`text-sm ${strong ? "text-white/76" : "text-white/45"}`}>
        {label}
      </span>
      <span
        className={`text-right text-sm ${
          strong ? "font-semibold text-white" : "font-medium text-white"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function CutPreferenceCard({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-2xl border px-4 py-3 text-center text-sm transition lg:text-left ${
        checked
          ? "border-[#c6a268]/60 bg-[#c6a268]/10 text-white"
          : "border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.07]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] ${
            checked
              ? "border-[#c6a268] bg-[#c6a268] text-[#161015]"
              : "border-white/20 text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
    </button>
  );
}

function SmallInfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/75 lg:text-left">
      {children}
    </div>
  );
}

export default function OrderPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const quantityNumber = Math.max(0, Number(form.quantity) || 0);

  const selectedWeight = useMemo(
    () => weightOptions.find((w) => w.label === form.preferredWeight) || null,
    [form.preferredWeight]
  );

  const basePricePerSheep = selectedWeight?.price || 0;
  const servicesPerSheep = form.addServices ? 400 : 0;
  const deliveryPerSheep = form.delivery ? 100 : 0;
  const pricePerSheep = basePricePerSheep + servicesPerSheep + deliveryPerSheep;
  const totalPrice = quantityNumber * pricePerSheep;

  const filledCount = useMemo(() => {
    const fields = [
      form.fullName,
      form.phone,
      form.quantity,
      form.preferredWeight,
    ];
    return fields.filter(Boolean).length + (form.cutPreferences.length > 0 ? 1 : 0);
  }, [form]);

  const progress = Math.round((filledCount / 5) * 100);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleCutPreference(value: string) {
    setForm((prev) => {
      const exists = prev.cutPreferences.includes(value);
      return {
        ...prev,
        cutPreferences: exists
          ? prev.cutPreferences.filter((item) => item !== value)
          : [...prev.cutPreferences, value],
      };
    });
    setErrors((prev) => ({ ...prev, cutPreferences: undefined }));
  }

  function validate() {
    const nextErrors: Errors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Please enter your full name.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone number.";

    if (!form.quantity.trim()) {
      nextErrors.quantity = "Please enter quantity.";
    } else if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1) {
      nextErrors.quantity = "Please enter a valid quantity.";
    }

    if (!form.preferredWeight) {
      nextErrors.preferredWeight = "Please select a weight range.";
    }

    if (form.cutPreferences.length === 0) {
      nextErrors.cutPreferences = "Please choose at least one cutting preference.";
    }

    if (!form.agree) {
      nextErrors.agree = "Please confirm before submitting.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!validate()) return;

    try {
      setSubmitting(true);

      const orderRef = await addDoc(collection(db, "orders"), {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        quantity: quantityNumber,
        preferredWeight: form.preferredWeight,
        cutPreferences: form.cutPreferences,
        notes: form.notes.trim(),
        addServices: form.addServices,
        delivery: form.delivery,
        basePricePerSheep,
        servicesPerSheep,
        deliveryPerSheep,
        pricePerSheep,
        totalPrice,
        paymentStatus: "pending",
        processingStatus: "pending",
        collectionStatus: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/order/success?id=${orderRef.id}`);
    } catch (error) {
      console.error("Error saving order:", error);
      setSubmitError("Something went wrong while saving the order. Please try again.");
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

        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Back Home
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-2 sm:px-10 lg:pb-24 lg:pt-4">
        <div className="grid gap-8 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl">
              Place Order
            </div>

            <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
              Complete your qurbani
              <span className="mt-1 block">booking with clarity</span>
              <span className="mt-1 block">and confidence.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-[1rem] leading-7 text-center text-white/68 sm:text-[1.05rem] sm:leading-8 lg:text-left">
              Submit your booking through a clear and carefully guided process designed
              to make ordering feel simple, reassuring, and smooth from start to finish.
            </p>

            <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-center lg:text-left">
                  <p className="text-sm uppercase tracking-[0.22em] text-[#d8b67e]">
                    Booking progress
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    Complete the details below to finalise your order.
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
                  <div className="mb-5 text-center lg:text-left">
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
                  <div className="mb-5 text-center lg:text-left">
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
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        value={form.quantity}
                        onChange={(value) => updateField("quantity", value)}
                        placeholder="Enter quantity"
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
                        options={weightOptions.map((w) => w.label)}
                        placeholder="Select weight range"
                        error={errors.preferredWeight}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center lg:text-left">
                        <p className="text-sm font-medium text-white/80">
                          Optional service package
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/55">
                          Skinning, cleaning, storage, slicing, and packaging —{" "}
                          <span className="font-medium text-[#d8b67e]">
                            R400 per sheep
                          </span>
                        </p>

                        <label className="mt-4 flex items-start justify-center gap-3 lg:justify-start">
                          <input
                            type="checkbox"
                            checked={form.addServices}
                            onChange={(e) => updateField("addServices", e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c6a268]"
                          />
                          <span className="text-sm text-white/75">
                            Add the service package to this order
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center lg:text-left">
                        <p className="text-sm font-medium text-white/80">
                          Delivery
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/55">
                          Delivery is charged at{" "}
                          <span className="font-medium text-[#d8b67e]">
                            R100 per sheep
                          </span>
                        </p>

                        <label className="mt-4 flex items-start justify-center gap-3 lg:justify-start">
                          <input
                            type="checkbox"
                            checked={form.delivery}
                            onChange={(e) => updateField("delivery", e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c6a268]"
                          />
                          <span className="text-sm text-white/75">
                            Add delivery to this order
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="mb-2 text-center lg:text-left">
                        <Label htmlFor="cutPreferences" required>
                          Cutting preferences
                        </Label>
                        <p className="text-sm leading-6 text-white/50">
                          Select as many options as required.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {cutPreferenceOptions.map((item) => (
                          <CutPreferenceCard
                            key={item}
                            label={item}
                            checked={form.cutPreferences.includes(item)}
                            onToggle={() => toggleCutPreference(item)}
                          />
                        ))}
                      </div>

                      {errors.cutPreferences ? (
                        <p className="mt-2 text-center text-xs text-red-300 lg:text-left">
                          {errors.cutPreferences}
                        </p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="notes">
                        Additional notes <span className="text-white/35">(optional)</span>
                      </Label>
                      <TextArea
                        id="notes"
                        value={form.notes}
                        onChange={(value) => updateField("notes", value)}
                        placeholder="Add any additional notes or special requests"
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
                    <p className="mt-2 text-center text-xs text-red-300 lg:text-left">{errors.agree}</p>
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
                    disabled={submitting}
                    className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015] shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_20px_38px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-70 sm:text-[15px]"
                  >
                    {submitting ? "Submitting..." : "Submit Booking"}
                  </button>
                </div>

                {submitError ? (
                  <div className="rounded-[24px] border border-red-400/20 bg-red-400/10 p-5">
                    <p className="text-center text-sm font-semibold text-red-200 lg:text-left">
                      Could not save booking
                    </p>
                    <p className="mt-1 text-center text-sm leading-6 text-red-100/80 lg:text-left">
                      {submitError}
                    </p>
                  </div>
                ) : null}
              </div>
            </form>
          </div>

          <div className="xl:col-span-5">
            <div className="space-y-6 xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                  Booking summary
                </p>
                <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white lg:text-left">
                  Review your details
                </h2>
                <p className="mt-2 text-center text-sm leading-6 text-white/60 lg:text-left">
                  Your quantity, pricing, selected services, and total update live as you complete the form.
                </p>

                <div className="mt-6">
                  <SummaryRow label="Full name" value={form.fullName} />
                  <SummaryRow label="Phone" value={form.phone} />
                  <SummaryRow label="Quantity" value={form.quantity || "—"} />
                  <SummaryRow label="Weight range" value={form.preferredWeight} />
                  <SummaryRow
                    label="Cutting preferences"
                    value={
                      form.cutPreferences.length
                        ? form.cutPreferences.join(", ")
                        : "—"
                    }
                  />
                  <SummaryRow
                    label="Service package"
                    value={form.addServices ? "Included" : "Not added"}
                  />
                  <SummaryRow
                    label="Delivery"
                    value={form.delivery ? "Included" : "Not added"}
                  />
                </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="space-y-1">
                    <SummaryRow
                      label="Base price per sheep"
                      value={basePricePerSheep ? formatZAR(basePricePerSheep) : "—"}
                    />
                    <SummaryRow
                      label="Service package per sheep"
                      value={form.addServices ? formatZAR(400) : formatZAR(0)}
                    />
                    <SummaryRow
                      label="Delivery per sheep"
                      value={form.delivery ? formatZAR(100) : formatZAR(0)}
                    />
                    <SummaryRow
                      label="Total per sheep"
                      value={pricePerSheep ? formatZAR(pricePerSheep) : "—"}
                      strong
                    />
                  </div>

                  <div className="mt-4 h-px bg-white/10" />

                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div className="text-center lg:text-left">
                      <p className="text-sm text-white/50">Estimated total due</p>
                      <p className="mt-1 text-xs text-white/40">
                        Based on the quantity and options selected above
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-[#d8b67e]">
                        {totalPrice ? formatZAR(totalPrice) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                  Included pricing
                </p>
                <div className="mt-4 grid gap-3">
                  <SmallInfoCard>Live total pricing shown before submission</SmallInfoCard>
                  <SmallInfoCard>Weight-based sheep pricing in kilograms</SmallInfoCard>
                  <SmallInfoCard>Optional services at R400 per sheep</SmallInfoCard>
                  <SmallInfoCard>Optional delivery at R100 per sheep</SmallInfoCard>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                  Booking confidence
                </p>
                <div className="mt-4 grid gap-3">
                  <SmallInfoCard>Clear booking flow from start to finish</SmallInfoCard>
                  <SmallInfoCard>Multiple cutting preferences can be selected</SmallInfoCard>
                  <SmallInfoCard>Live summary keeps the total visible throughout</SmallInfoCard>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}