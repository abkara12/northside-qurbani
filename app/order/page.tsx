"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type OrderType = "qurbani" | "live";

type WeightOption = {
  label: string;
  price: number;
};

type WeightSelectionRow = {
  id: string;
  weightLabel: string;
  quantity: string;
};

type WeightBreakdownItem = {
  id: string;
  label: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type AppSettings = {
  bookingsOpen: boolean;
  bookingCutoffDate: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  referenceHint: string;
  reminderMessageIntro: string;
  weightOptions: WeightOption[];
  liveSheepPriceEnabled: boolean;
  liveSheepPrice: number;
  liveSheepNote: string;
};

type FormData = {
  orderType: OrderType;
  fullName: string;
  phone: string;
  email: string;

  // Qurbani
  weightSelections: WeightSelectionRow[];
  addServices: boolean;
  delivery: boolean;

  // Live sheep
  liveQuantity: string;
  liveDelivery: boolean;

  notes: string;
  agree: boolean;
};

type Errors = {
  orderType?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  weightSelections?: string;
  liveQuantity?: string;
  notes?: string;
  agree?: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  bookingsOpen: true,
  bookingCutoffDate: "",
  accountName: "Northside Qurbani",
  bankName: "REPLACE WITH BANK NAME",
  accountNumber: "REPLACE WITH ACCOUNT NUMBER",
  accountType: "Business Cheque",
  branchCode: "REPLACE WITH BRANCH CODE",
  referenceHint: "Please use your name and surname as the payment reference.",
  reminderMessageIntro:
    "Assalaamu alaikum. This is a kind reminder regarding your Northside Qurbani booking.",
  weightOptions: [
    { label: "35–39 kg", price: 2750 },
    { label: "40–45 kg", price: 3150 },
    { label: "46–50 kg", price: 3500 },
    { label: "51–55 kg", price: 3850 },
    { label: "56–60 kg", price: 4200 },
  ],
  liveSheepPriceEnabled: false,
  liveSheepPrice: 0,
  liveSheepNote:
    "Live sheep purchases are handled separately from qurbani processing bookings.",
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialForm(): FormData {
  return {
    orderType: "qurbani",
    fullName: "",
    phone: "",
    email: "",
    weightSelections: [
      {
        id: makeId(),
        weightLabel: "",
        quantity: "1",
      },
    ],
    addServices: false,
    delivery: false,
    liveQuantity: "1",
    liveDelivery: false,
    notes: "",
    agree: false,
  };
}

function formatZAR(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isBookingsClosed(settings: AppSettings) {
  if (!settings.bookingsOpen) return true;
  if (!settings.bookingCutoffDate) return false;
  return settings.bookingCutoffDate < getTodayDateString();
}

function Label({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor?: string;
  children: ReactNode;
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
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  min?: number;
  error?: string;
  disabled?: boolean;
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
        disabled={disabled}
        className={`h-12 w-full rounded-2xl border bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60 ${
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
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`h-12 w-full rounded-2xl border bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60 ${
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
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        disabled={disabled}
        className={`w-full rounded-2xl border bg-white/[0.05] px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60 ${
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

function SmallInfoCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/75 lg:text-left">
      {children}
    </div>
  );
}

function BookingRowCard({
  index,
  row,
  onWeightChange,
  onQuantityChange,
  onRemove,
  canRemove,
  error,
  options,
  disabled = false,
}: {
  index: number;
  row: WeightSelectionRow;
  onWeightChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  error?: string;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Selection {index + 1}</p>
          <p className="mt-1 text-xs text-white/45">
            Choose a weight range and quantity.
          </p>
        </div>

        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`weight-${row.id}`} required>
            Weight range
          </Label>
          <Select
            id={`weight-${row.id}`}
            value={row.weightLabel}
            onChange={onWeightChange}
            options={options}
            placeholder="Select weight range"
            error={error}
            disabled={disabled}
          />
        </div>

        <div>
          <Label htmlFor={`quantity-${row.id}`} required>
            Number of sheep
          </Label>
          <Input
            id={`quantity-${row.id}`}
            type="number"
            min={1}
            value={row.quantity}
            onChange={onQuantityChange}
            placeholder="Enter quantity"
            error={error}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

function OrderTypeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-left transition ${
        active
          ? "border-[#c6a268]/60 bg-[#c6a268]/10 shadow-[0_16px_32px_rgba(198,162,104,0.10)]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
        </div>

        <div
          className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
            active
              ? "border-[#c6a268] bg-[#c6a268] text-[#161015]"
              : "border-white/20 text-transparent"
          }`}
        >
          ✓
        </div>
      </div>
    </button>
  );
}

export default function OrderPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [form, setForm] = useState<FormData>(createInitialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "qurbani"),
      (snap) => {
        if (snap.exists()) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(snap.data() as Partial<AppSettings>),
          });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setSettingsLoaded(true);
      },
      (error) => {
        console.error("Settings load failed:", error);
        setSettings(DEFAULT_SETTINGS);
        setSettingsLoaded(true);
      }
    );

    return () => unsub();
  }, []);

  const bookingClosed = isBookingsClosed(settings);

  const weightSelectOptions = useMemo(() => {
    return settings.weightOptions.map((w) => `${w.label} — ${formatZAR(w.price)}`);
  }, [settings.weightOptions]);

  const parsedSelections = useMemo(() => {
    return form.weightSelections.map((row) => {
      const selectedOption =
        settings.weightOptions.find(
          (option) =>
            `${option.label} — ${formatZAR(option.price)}` === row.weightLabel
        ) || null;

      const quantity = Math.max(0, Number(row.quantity) || 0);
      const price = selectedOption?.price || 0;
      const subtotal = price * quantity;

      return {
        ...row,
        quantityNumber: quantity,
        selectedOption,
        subtotal,
      };
    });
  }, [form.weightSelections, settings.weightOptions]);

  const qurbaniQuantity = parsedSelections.reduce(
    (sum, row) => sum + row.quantityNumber,
    0
  );

  const liveQuantityNumber = Math.max(0, Number(form.liveQuantity) || 0);

  const effectiveQuantity =
    form.orderType === "qurbani" ? qurbaniQuantity : liveQuantityNumber;

  const weightBreakdown: WeightBreakdownItem[] = parsedSelections
    .filter((row) => row.selectedOption && row.quantityNumber > 0)
    .map((row) => ({
      id: row.id,
      label: row.selectedOption!.label,
      price: row.selectedOption!.price,
      quantity: row.quantityNumber,
      subtotal: row.subtotal,
    }));

  const basePriceTotal = weightBreakdown.reduce((sum, row) => sum + row.subtotal, 0);

  const servicesPerSheep = form.orderType === "qurbani" && form.addServices ? 400 : 0;
  const deliveryPerSheep =
    form.orderType === "qurbani"
      ? form.delivery
        ? 100
        : 0
      : form.liveDelivery
      ? 100
      : 0;

  const servicesTotal = effectiveQuantity * servicesPerSheep;
  const deliveryTotal = effectiveQuantity * deliveryPerSheep;

  const liveBaseTotal =
    settings.liveSheepPriceEnabled && settings.liveSheepPrice > 0
      ? liveQuantityNumber * settings.liveSheepPrice
      : 0;

  const totalPrice =
    form.orderType === "qurbani"
      ? basePriceTotal + servicesTotal + deliveryTotal
      : liveBaseTotal + deliveryTotal;

  const pricingVisible =
    form.orderType === "qurbani"
      ? totalPrice > 0
      : settings.liveSheepPriceEnabled && settings.liveSheepPrice > 0;

  const legacyPreferredWeight = weightBreakdown
    .map((row) => `${row.label} x${row.quantity}`)
    .join(", ");

  const filledCount = useMemo(() => {
    const base =
      (form.orderType ? 1 : 0) +
      (form.fullName.trim() ? 1 : 0) +
      (form.phone.trim() ? 1 : 0) +
      (form.orderType === "qurbani"
        ? weightBreakdown.length > 0
          ? 1
          : 0
        : liveQuantityNumber > 0
        ? 1
        : 0) +
      (form.agree ? 1 : 0);

    return base;
  }, [
    form.orderType,
    form.fullName,
    form.phone,
    form.agree,
    weightBreakdown.length,
    liveQuantityNumber,
  ]);

  const progress = Math.round((filledCount / 5) * 100);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function updateWeightRow(id: string, patch: Partial<WeightSelectionRow>) {
    setForm((prev) => ({
      ...prev,
      weightSelections: prev.weightSelections.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    }));
    setErrors((prev) => ({ ...prev, weightSelections: undefined }));
  }

  function addWeightRow() {
    setForm((prev) => ({
      ...prev,
      weightSelections: [
        ...prev.weightSelections,
        {
          id: makeId(),
          weightLabel: "",
          quantity: "1",
        },
      ],
    }));
  }

  function removeWeightRow(id: string) {
    setForm((prev) => ({
      ...prev,
      weightSelections: prev.weightSelections.filter((row) => row.id !== id),
    }));
    setErrors((prev) => ({ ...prev, weightSelections: undefined }));
  }

  function switchOrderType(type: OrderType) {
    setForm((prev) => ({
      ...prev,
      orderType: type,
      addServices: type === "qurbani" ? prev.addServices : false,
      delivery: type === "qurbani" ? prev.delivery : false,
      liveDelivery: type === "live" ? prev.liveDelivery : false,
    }));
    setErrors((prev) => ({
      ...prev,
      orderType: undefined,
      weightSelections: undefined,
      liveQuantity: undefined,
    }));
  }

  function validate() {
    const nextErrors: Errors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Please enter your full name.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter your phone number.";

    if (form.orderType === "qurbani") {
      const hasValidWeightSelections =
        form.weightSelections.length > 0 &&
        form.weightSelections.every((row) => {
          const qty = Number(row.quantity);
          return row.weightLabel && Number.isInteger(qty) && qty >= 1;
        });

      if (!hasValidWeightSelections) {
        nextErrors.weightSelections =
          "Please complete each sheep selection with a valid weight range and quantity.";
      }
    }

    if (form.orderType === "live") {
      const qty = Number(form.liveQuantity);
      if (!Number.isInteger(qty) || qty < 1) {
        nextErrors.liveQuantity =
          "Please enter a valid number of live sheep required.";
      }
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

    if (bookingClosed) {
      setSubmitError("Bookings are currently closed.");
      return;
    }

    if (!validate()) return;

    try {
      setSubmitting(true);

      const isQurbani = form.orderType === "qurbani";
      const orderRef = await addDoc(collection(db, "orders"), {
        orderType: form.orderType,

        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),

        quantity: effectiveQuantity,

        preferredWeight: isQurbani ? legacyPreferredWeight : "",
        weightBreakdown: isQurbani ? weightBreakdown : [],

        liveQuantity: isQurbani ? null : liveQuantityNumber,
        livePriceEnabled: isQurbani ? false : settings.liveSheepPriceEnabled,
        livePricePerSheep:
          isQurbani || !settings.liveSheepPriceEnabled
            ? null
            : settings.liveSheepPrice,
        liveBaseTotal: isQurbani ? 0 : liveBaseTotal,

        addServices: isQurbani ? form.addServices : false,
        delivery: isQurbani ? form.delivery : form.liveDelivery,
        liveDelivery: isQurbani ? false : form.liveDelivery,

        basePriceTotal: isQurbani ? basePriceTotal : liveBaseTotal,
        servicesPerSheep,
        servicesTotal,
        deliveryPerSheep,
        deliveryTotal,
        totalPrice,
        pricingVisible,

        notes: form.notes.trim(),

        paymentStatus: "pending",
        slaughtered: false,
        delivered: false,
        cancelled: false,
        cancelReason: "",
        queueNumber: null,
        manualEntry: false,
        bookingYear: new Date().getFullYear(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const savedOrderId = orderRef.id;
      const prefix = form.orderType === "qurbani" ? "NQ" : "LS";
      const savedOrderReference = `${prefix}-${savedOrderId
        .slice(0, 8)
        .toUpperCase()}`;

      if (typeof window !== "undefined") {
        localStorage.setItem("northside_last_order_id", savedOrderId);
        localStorage.setItem("northside_last_order_reference", savedOrderReference);
      }

      window.location.assign(`/order/success/${savedOrderId}`);
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
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#141016]/[0.26] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
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
              Premium qurbani and livestock bookings
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
        {!settingsLoaded ? (
          <div className="rounded-[34px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">
              Loading
            </p>
            <h1 className="mt-4 text-[2rem] font-semibold text-white sm:text-[2.4rem]">
              Preparing the booking form
            </h1>
          </div>
        ) : bookingClosed ? (
          <div className="rounded-[34px] border border-amber-400/20 bg-amber-400/10 p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-200">
              Bookings Closed
            </p>
            <h1 className="mt-4 text-[2rem] font-semibold text-white sm:text-[2.4rem]">
              Orders are currently closed
            </h1>
            <p className="mt-4 text-amber-50/80">
              Please contact the team directly if you need assistance.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015]"
              >
                Back Home
              </Link>

              <Link
                href="/lookup"
                className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white"
              >
                Find Existing Booking
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl lg:mx-0">
                Place Order
              </div>

              <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-center text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.05em] text-transparent sm:text-[2.7rem] lg:text-left lg:text-[3.8rem]">
                Book qurbani or
                <span className="mt-1 block">purchase live sheep</span>
                <span className="mt-1 block">with confidence.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-center text-[0.98rem] leading-7 text-white/68 sm:text-[1.03rem] sm:leading-8 lg:mx-0 lg:text-left">
                Choose the type of order you need, complete your details, and submit
                everything in one smooth premium flow.
              </p>

              <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="text-center lg:text-left">
                    <p className="text-sm uppercase tracking-[0.22em] text-[#d8b67e]">
                      Booking progress
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
                noValidate
                className="mt-8 rounded-[34px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7"
              >
                <div className="grid gap-8">
                  <div>
                    <div className="mb-5 text-center lg:text-left">
                      <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                        Order type
                      </p>
                      <h2 className="mt-2 text-[1.45rem] font-semibold text-white">
                        What would you like to book?
                      </h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <OrderTypeCard
                        active={form.orderType === "qurbani"}
                        title="Qurbani Service"
                        description="Choose sheep by weight range and add services like processing and delivery."
                        onClick={() => switchOrderType("qurbani")}
                      />
                      <OrderTypeCard
                        active={form.orderType === "live"}
                        title="Live Sheep Purchase"
                        description="Submit a separate booking for customers buying live sheep directly."
                        onClick={() => switchOrderType("live")}
                      />
                    </div>
                  </div>

                  <div className="h-px bg-white/10" />

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

                  {form.orderType === "qurbani" ? (
                    <>
                      <div>
                        <div className="mb-5 text-center lg:text-left">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                            Sheep selection
                          </p>
                          <h2 className="mt-2 text-[1.45rem] font-semibold text-white">
                            Quantity and weight ranges
                          </h2>
                        </div>

                        <div className="grid gap-4">
                          {form.weightSelections.map((row, index) => (
                            <BookingRowCard
                              key={row.id}
                              index={index}
                              row={row}
                              onWeightChange={(value) =>
                                updateWeightRow(row.id, { weightLabel: value })
                              }
                              onQuantityChange={(value) =>
                                updateWeightRow(row.id, { quantity: value })
                              }
                              onRemove={() => removeWeightRow(row.id)}
                              canRemove={form.weightSelections.length > 1}
                              error={errors.weightSelections}
                              options={weightSelectOptions}
                            />
                          ))}
                        </div>

                        {errors.weightSelections ? (
                          <p className="mt-3 text-xs text-red-300">
                            {errors.weightSelections}
                          </p>
                        ) : null}

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={addWeightRow}
                            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                          >
                            Add another weight category
                          </button>
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
                          <div className="sm:col-span-2">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center lg:text-left">
                              <p className="text-sm font-medium text-white/80">
                                Service package
                              </p>
                              <p className="mt-1 text-sm leading-6 text-white/55">
                                Skinning, cleaning, storage, slicing, and packaging —
                                <span className="font-medium text-[#d8b67e]">
                                  {" "}
                                  {formatZAR(400)} per sheep
                                </span>
                              </p>

                              <label className="mt-4 flex items-start justify-center gap-3 lg:justify-start">
                                <input
                                  type="checkbox"
                                  checked={form.addServices}
                                  onChange={(e) =>
                                    updateField("addServices", e.target.checked)
                                  }
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
                                Delivery is charged at
                                <span className="font-medium text-[#d8b67e]">
                                  {" "}
                                  {formatZAR(100)} per sheep
                                </span>
                              </p>

                              <label className="mt-4 flex items-start justify-center gap-3 lg:justify-start">
                                <input
                                  type="checkbox"
                                  checked={form.delivery}
                                  onChange={(e) =>
                                    updateField("delivery", e.target.checked)
                                  }
                                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c6a268]"
                                />
                                <span className="text-sm text-white/75">
                                  Add delivery to this order
                                </span>
                              </label>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <Label htmlFor="notes">
                              Additional notes{" "}
                              <span className="text-white/35">(optional)</span>
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
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="mb-5 text-center lg:text-left">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e]">
                            Live sheep order
                          </p>
                          <h2 className="mt-2 text-[1.45rem] font-semibold text-white">
                            Purchase details
                          </h2>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label htmlFor="liveQuantity" required>
                              Number of live sheep
                            </Label>
                            <Input
                              id="liveQuantity"
                              type="number"
                              min={1}
                              value={form.liveQuantity}
                              onChange={(value) => updateField("liveQuantity", value)}
                              placeholder="Enter number of sheep"
                              error={errors.liveQuantity}
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-center lg:text-left">
                              <p className="text-sm font-medium text-white/80">
                                Delivery
                              </p>
                              <p className="mt-1 text-sm leading-6 text-white/55">
                                Add delivery only if live sheep delivery is required.
                                <span className="font-medium text-[#d8b67e]">
                                  {" "}
                                  {formatZAR(100)} per sheep
                                </span>
                              </p>

                              <label className="mt-4 flex items-start justify-center gap-3 lg:justify-start">
                                <input
                                  type="checkbox"
                                  checked={form.liveDelivery}
                                  onChange={(e) =>
                                    updateField("liveDelivery", e.target.checked)
                                  }
                                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c6a268]"
                                />
                                <span className="text-sm text-white/75">
                                  Add delivery to this live sheep order
                                </span>
                              </label>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <div className="rounded-[24px] border border-white/10 bg-[#c6a268]/[0.06] p-4">
                              <p className="text-sm font-medium text-white">
                                Live sheep note
                              </p>
                              <p className="mt-2 text-sm leading-6 text-white/60">
                                {settings.liveSheepNote}
                              </p>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <Label htmlFor="notes">
                              Additional notes{" "}
                              <span className="text-white/35">(optional)</span>
                            </Label>
                            <TextArea
                              id="notes"
                              value={form.notes}
                              onChange={(value) => updateField("notes", value)}
                              placeholder="Add any special requests, preferred timing, or collection details"
                              error={errors.notes}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

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
                      </div>
                    </label>
                    {errors.agree ? (
                      <p className="mt-2 text-center text-xs text-red-300 lg:text-left">
                        {errors.agree}
                      </p>
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
                      {submitting
                        ? "Submitting..."
                        : form.orderType === "qurbani"
                        ? "Submit Qurbani Booking"
                        : "Submit Live Sheep Order"}
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
                <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#141016] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="text-center text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] lg:text-left">
                    Booking summary
                  </p>
                  <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white lg:text-left">
                    Review your details
                  </h2>

                  <div className="mt-6">
                    <SummaryRow
                      label="Order type"
                      value={
                        form.orderType === "qurbani"
                          ? "Qurbani Service"
                          : "Live Sheep Purchase"
                      }
                    />
                    <SummaryRow label="Full name" value={form.fullName} />
                    <SummaryRow label="Phone" value={form.phone} />

                    {form.orderType === "qurbani" ? (
                      <div className="border-b border-white/10 py-3">
                        <div className="mb-2 text-sm text-white/45">Sheep selected</div>
                        {weightBreakdown.length ? (
                          <div className="space-y-2">
                            {weightBreakdown.map((row) => (
                              <div
                                key={row.id}
                                className="flex items-start justify-between gap-4 text-sm"
                              >
                                <span className="text-white">
                                  {row.quantity} × {row.label}
                                </span>
                                <span className="font-medium text-white">
                                  {formatZAR(row.subtotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-white">—</div>
                        )}
                      </div>
                    ) : (
                      <SummaryRow
                        label="Live sheep required"
                        value={liveQuantityNumber ? String(liveQuantityNumber) : "—"}
                      />
                    )}

                    <SummaryRow
                      label="Service package"
                      value={
                        form.orderType === "qurbani"
                          ? form.addServices
                            ? "Included"
                            : "Not added"
                          : "Not applicable"
                      }
                    />
                    <SummaryRow
                      label="Delivery"
                      value={
                        form.orderType === "qurbani"
                          ? form.delivery
                            ? "Included"
                            : "Not added"
                          : form.liveDelivery
                          ? "Included"
                          : "Not added"
                      }
                    />
                  </div>

                  <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                    <SummaryRow
                      label="Total sheep"
                      value={effectiveQuantity ? String(effectiveQuantity) : "—"}
                    />

                    {form.orderType === "qurbani" ? (
                      <>
                        <SummaryRow
                          label="Base sheep total"
                          value={basePriceTotal ? formatZAR(basePriceTotal) : "—"}
                        />
                        <SummaryRow
                          label="Service total"
                          value={servicesTotal ? formatZAR(servicesTotal) : "—"}
                        />
                        <SummaryRow
                          label="Delivery total"
                          value={deliveryTotal ? formatZAR(deliveryTotal) : "—"}
                        />
                      </>
                    ) : (
                      <>
                        <SummaryRow
                          label="Live sheep total"
                          value={
                            settings.liveSheepPriceEnabled && liveBaseTotal
                              ? formatZAR(liveBaseTotal)
                              : settings.liveSheepPriceEnabled
                              ? formatZAR(0)
                              : "Price confirmed manually"
                          }
                        />
                        <SummaryRow
                          label="Delivery total"
                          value={
                            deliveryTotal
                              ? formatZAR(deliveryTotal)
                              : form.liveDelivery
                              ? formatZAR(0)
                              : "—"
                          }
                        />
                      </>
                    )}

                    <SummaryRow
                      label="Total due"
                      value={
                        pricingVisible
                          ? formatZAR(totalPrice)
                          : "To be confirmed"
                      }
                      strong
                    />
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <p className="text-center text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] lg:text-left">
                    Included pricing
                  </p>
                  <div className="mt-4 grid gap-3">
                    <SmallInfoCard>
                      Switch between qurbani service and live sheep purchase on one page
                    </SmallInfoCard>
                    <SmallInfoCard>
                      Multiple weight categories can be booked in one qurbani order
                    </SmallInfoCard>
                    <SmallInfoCard>
                      Skinning, slicing, cleaning, storage and packaging at{" "}
                      {formatZAR(400)} per sheep
                    </SmallInfoCard>
                    <SmallInfoCard>
                      Delivery at {formatZAR(100)} per sheep
                    </SmallInfoCard>
                    <SmallInfoCard>
                      {settings.liveSheepPriceEnabled && settings.liveSheepPrice > 0
                        ? `Live sheep pricing currently set at ${formatZAR(
                            settings.liveSheepPrice
                          )} per sheep`
                        : "Live sheep pricing can stay manual until you are ready to set a fixed amount"}
                    </SmallInfoCard>
                    <SmallInfoCard>
                      Prices and bank details pull from admin settings
                    </SmallInfoCard>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}