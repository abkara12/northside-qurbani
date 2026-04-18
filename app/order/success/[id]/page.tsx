"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type WeightBreakdownItem = {
  id?: string;
  label: string;
  price?: number;
  quantity: number;
  subtotal?: number;
};

type SheepPreferenceItem = {
  sheepNo: number;
  weightLabel: string;
  cutPreferences: string[];
};

type OrderData = {
  orderType?: "qurbani" | "live";
  fullName?: string;
  phone?: string;
  email?: string;
  quantity?: number;
  liveQuantity?: number;
  preferredWeight?: string;
  weightBreakdown?: WeightBreakdownItem[];
  sheepPreferences?: SheepPreferenceItem[];
  cutPreferences?: string[];
  notes?: string;
  addServices?: boolean;
  delivery?: boolean;
  deliveryArea?: string;
  deliveryAddress?: string;
  fullDistributionCut?: boolean;
  selectedSheepTagNumbers?: string[];
  basePriceTotal?: number;
  servicesPerSheep?: number;
  servicesTotal?: number;
  deliveryPerSheep?: number;
  deliveryTotal?: number;
  totalPrice?: number;
  livePricePerSheep?: number;
  pricingVisible?: boolean;
  paymentStatus?: string;
  slaughtered?: boolean;
  delivered?: boolean;
  cancelled?: boolean;
  cancelReason?: string;
  queueNumber?: number | null;
  queueCheckedInAt?: any;
};

type AppSettings = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  referenceHint: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  accountName: "Northside Qurbani",
  bankName: "REPLACE WITH BANK NAME",
  accountNumber: "REPLACE WITH ACCOUNT NUMBER",
  accountType: "Business Cheque",
  branchCode: "REPLACE WITH BRANCH CODE",
  referenceHint:
    "Please send your proof of payment / payment reference to Moulana Shaheed or Uncle Yaqoob on WhatsApp.",
};

function formatZAR(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value || 0);
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
    <div className="flex flex-col gap-1 border-b border-white/10 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className={`text-sm ${strong ? "text-white/76" : "text-white/45"}`}>
        {label}
      </span>
      <span
        className={`text-sm break-words sm:max-w-[60%] sm:text-right ${
          strong ? "font-semibold text-white" : "font-medium text-white"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/75 lg:text-left">
      {children}
    </div>
  );
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "emerald" | "amber" | "sky" | "rose" | "violet";
}) {
  const styles =
    variant === "emerald"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
      : variant === "amber"
      ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
      : variant === "sky"
      ? "border-sky-300/20 bg-sky-300/10 text-sky-200"
      : variant === "rose"
      ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
      : "border-violet-300/20 bg-violet-300/10 text-violet-200";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.24em] ${styles}`}
    >
      {label}
    </div>
  );
}

function CopyValueButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  return (
    <button
      type="button"
      className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white transition hover:bg-white/10"
      onClick={handleCopy}
    >
      {copied ? "Copied" : "Copy Reference"}
    </button>
  );
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
          <p className="mt-2 break-all text-sm font-medium text-white">{value}</p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function isLiveOrder(order: OrderData | null) {
  return order?.orderType === "live";
}

function getWorkflowStatus(order: OrderData | null) {
  if (!order) {
    return { label: "Unavailable", variant: "rose" as const };
  }
  if (order.cancelled) {
    return { label: "Booking Cancelled", variant: "rose" as const };
  }
  if (order.delivered) {
    return {
      label: order.orderType === "live" ? "Collected" : "Delivered",
      variant: "emerald" as const,
    };
  }
  if (order.orderType === "live") {
    return { label: "Pending", variant: "violet" as const };
  }
  if (order.slaughtered) {
    return { label: "Slaughtered", variant: "sky" as const };
  }
  if ((order.queueNumber || 0) > 0) {
    return { label: "In Queue", variant: "violet" as const };
  }
  return { label: "Unslaughtered", variant: "violet" as const };
}

function getPaymentStatus(order: OrderData | null) {
  const paid = (order?.paymentStatus || "pending").toLowerCase() === "paid";
  return paid
    ? { label: "Payment Received", variant: "emerald" as const }
    : { label: "Payment Outstanding", variant: "amber" as const };
}

function totalSheep(order: OrderData | null) {
  if (!order) return 0;
  if (order.orderType === "live") {
    return order.liveQuantity || order.quantity || 0;
  }
  if (order.weightBreakdown?.length) {
    return order.weightBreakdown.reduce((sum, row) => sum + (row.quantity || 0), 0);
  }
  return order.quantity || 0;
}

function sheepSummary(order: OrderData | null) {
  if (!order) return "—";

  if (order.orderType === "live") {
    return `${order.liveQuantity || order.quantity || 0} live sheep`;
  }

  if (order.weightBreakdown?.length) {
    return order.weightBreakdown
      .map((row) => `${row.quantity} × ${row.label}`)
      .join(" • ");
  }

  return order.preferredWeight || "—";
}

function orderReferenceValue(id: string, order: OrderData | null) {
  const prefix = order?.orderType === "live" ? "LS" : "NQ";
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1] || "";
    setOrderId(id);

    if (!id) {
      setError("We could not find this booking.");
      setLoading(false);
      return;
    }

    const unsubOrder = onSnapshot(
      doc(db, "orders", id),
      (orderSnap) => {
        if (!orderSnap.exists()) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("northside_last_order_id");
            localStorage.removeItem("northside_last_order_reference");
          }

          setError("We could not find this booking.");
          setOrder(null);
          setLoading(false);
          return;
        }

        const orderData = orderSnap.data() as OrderData;

        if (orderData.cancelled) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("northside_last_order_id");
            localStorage.removeItem("northside_last_order_reference");
          }

          setError("We could not find this booking.");
          setOrder(null);
          setLoading(false);
          return;
        }

        setOrder(orderData);
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Error loading order:", err);
        setError("Something went wrong while loading the booking.");
        setLoading(false);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, "settings", "qurbani"),
      (settingsSnap) => {
        if (settingsSnap.exists()) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(settingsSnap.data() as Partial<AppSettings>),
          });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (err) => {
        console.error("Error loading settings:", err);
        setSettings(DEFAULT_SETTINGS);
      }
    );

    return () => {
      unsubOrder();
      unsubSettings();
    };
  }, []);

  const liveOrder = isLiveOrder(order);
  const orderReference = orderId ? orderReferenceValue(orderId, order) : "—";
  const workflowStatus = getWorkflowStatus(order);
  const paymentStatus = getPaymentStatus(order);
  const queueAssigned = !liveOrder && (order?.queueNumber || 0) > 0;
  const selectedTagNumbers = order?.selectedSheepTagNumbers?.filter(Boolean) || [];
  const hasSelectedTagNumbers = selectedTagNumbers.length > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />
        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#f5efe6]/[0.06] blur-3xl" />
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
            <div className="mt-1 text-sm text-white/55">Premium qurbani service</div>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Back Home
        </Link>
      </header>

      <section className="mx-auto max-w-6xl overflow-x-hidden px-5 pb-16 pt-2 sm:px-8 lg:px-10 lg:pb-24 lg:pt-4">
        {loading ? (
          <div className="rounded-[34px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">Loading</p>
            <h1 className="mt-4 text-[2rem] font-semibold text-white sm:text-[2.4rem]">
              Loading your booking
            </h1>
          </div>
        ) : error ? (
          <div className="rounded-[34px] border border-red-400/20 bg-red-400/10 p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-red-200">
              Booking unavailable
            </p>
            <h1 className="mt-4 text-[2rem] font-semibold text-white sm:text-[2.4rem]">
              We could not load this booking
            </h1>
            <p className="mt-4 text-red-100/80">{error}</p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/order"
                className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#161015]"
              >
                Place New Order
              </Link>

              <Link
                href="/"
                className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white"
              >
                Back Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-12 xl:gap-8">
            <div className="xl:col-span-7">
              <div className="rounded-[34px] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
                <div className="flex w-full justify-center lg:justify-start">
                  <StatusBadge
                    label={liveOrder ? "Order Confirmed" : "Booking Confirmed"}
                    variant="emerald"
                  />
                </div>

                <h1 className="mt-5 text-center text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[2.5rem] lg:text-left lg:text-[2.7rem]">
                  {liveOrder ? (
                    <>
                      Your live sheep order
                      <span className="mt-1 block">was received successfully.</span>
                    </>
                  ) : (
                    <>
                      Your qurbani booking
                      <span className="mt-1 block">was received successfully.</span>
                    </>
                  )}
                </h1>

                <p className="mx-auto mt-4 max-w-2xl text-center text-[0.98rem] leading-7 text-emerald-50/80 sm:text-[1.03rem] sm:leading-8 lg:mx-0 lg:text-left">
                  {liveOrder
                    ? "Thank you. Please keep your order reference safe for payment, delivery coordination, and any future follow-up."
                    : "Thank you. Please keep your booking reference safe for payment and any future follow-up."}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <StatusBadge label={workflowStatus.label} variant={workflowStatus.variant} />
                  <StatusBadge label={paymentStatus.label} variant={paymentStatus.variant} />
                </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                  <p className="text-sm text-white/50">
                    {liveOrder ? "Order reference" : "Booking reference"}
                  </p>
                  <p className="mt-2 break-all text-[1.2rem] font-semibold tracking-[0.08em] text-[#d8b67e] sm:text-[1.4rem]">
                    {orderReference}
                  </p>
                </div>

                {hasSelectedTagNumbers ? (
                  <div className="mt-6 rounded-[24px] border border-[#c6a268]/30 bg-[#c6a268]/10 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#d8b67e]">
                      Selected Sheep Tag Numbers
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {selectedTagNumbers.map((tag) => (
                        <div
                          key={tag}
                          className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/10 bg-black/20 px-5 text-sm font-semibold tracking-[0.08em] text-white"
                        >
                          {tag}
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-white/70">
  {liveOrder
    ? "Please keep these tag numbers ready for collection or delivery coordination."
    : "Please show these tag numbers to the team on qurbani day."}
</p>
                  </div>
                ) : null}

                {!liveOrder ? (
                  queueAssigned ? (
                    <div className="mt-6 rounded-[24px] border border-[#c6a268]/30 bg-[#c6a268]/10 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[#d8b67e]">
                            Queue number assigned
                          </p>
                          <p className="mt-2 text-[2rem] font-semibold leading-none text-white sm:text-[2.4rem]">
                            {order?.queueNumber}
                          </p>
                        </div>

                        <div className="max-w-sm text-sm leading-6 text-white/72">
                          Your booking has been added to the queue. Please keep this page open and use your queue number when called.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                      <p className="text-sm font-medium text-white/82">Queue status</p>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-white/65">
                        <p>Your booking has not yet been added to the queue.</p>
                        <p>Once staff assign your queue number, it will appear here automatically.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                    <p className="text-sm font-medium text-white/82">Next step</p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-white/65">
                      <p>Your live sheep order has been recorded successfully.</p>
                      <p>Staff will coordinate payment, delivery, or collection details from this order.</p>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                  <p className="text-sm font-medium text-white/82">What happens next?</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-white/65">
                    {liveOrder ? (
                      <>
                        <p>
                          Your live sheep order has been recorded with your quantity,
                          delivery preference, and customer details.
                        </p>
                        <p>
                          If pricing has been confirmed, payment can be made using the banking details below. If not, the final amount will be confirmed by the team first.
                        </p>
                        <p>
                          This page will continue to reflect live updates such as payment status and collection or delivery status.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Your booking has been recorded with your selected sizes, quantities,
                          pricing, and preferences.
                        </p>
                        <p>
                          Please make payment using the banking details below and send your proof of payment / payment reference as instructed.
                        </p>
                        <p>
                          This confirmation page will continue to reflect live updates such as payment status, workflow status, and queue number when assigned.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start lg:items-start">
                  <CopyValueButton value={orderReference} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-5">
              <div className="space-y-5 xl:sticky xl:top-6">
                <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#141016] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                    {liveOrder ? "Order summary" : "Booking summary"}
                  </p>
                  <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white lg:text-left">
                    Review your details
                  </h2>

                  <div className="mt-6">
                    <SummaryRow
                      label="Order type"
                      value={liveOrder ? "Live Sheep Purchase" : "Qurbani Service"}
                    />
                    <SummaryRow label="Full name" value={order?.fullName || "—"} />
                    <SummaryRow label="Phone" value={order?.phone || "—"} />
                    <SummaryRow label="Email" value={order?.email || "—"} />
                    <SummaryRow label="Total sheep" value={String(totalSheep(order))} />

                    {liveOrder ? (
                      <>
                        <SummaryRow label="Live sheep requested" value={sheepSummary(order)} />
                        <SummaryRow
                          label="Delivery"
                          value={order?.delivery ? "Included" : "Not added"}
                        />
                        <SummaryRow
                          label="Delivery area"
                          value={order?.deliveryArea || "No delivery"}
                        />
                        <SummaryRow
                          label="Delivery address"
                          value={order?.deliveryAddress || "No delivery"}
                        />
                        <SummaryRow
                          label="Payment status"
                          value={
                            (order?.paymentStatus || "pending").toLowerCase() === "paid"
                              ? "Paid"
                              : "Unpaid"
                          }
                        />
                        <SummaryRow label="Workflow status" value={workflowStatus.label} />
                        <SummaryRow
                          label="Price status"
                          value={
                            order?.pricingVisible === false
                              ? "To be confirmed"
                              : formatZAR(order?.totalPrice || 0)
                          }
                          strong
                        />
                      </>
                    ) : (
                      <>
                        <SummaryRow label="Sheep selected" value={sheepSummary(order)} />
                        <SummaryRow
                          label="Slicing preference"
                          value={
                            order?.sheepPreferences?.length
                              ? `${order.sheepPreferences.length} sheep configured`
                              : order?.fullDistributionCut
                              ? "Full sheep sliced for distribution"
                              : "Standard"
                          }
                        />
                        <SummaryRow
                          label="Delivery"
                          value={order?.delivery ? "Included" : "Not added"}
                        />
                        <SummaryRow
                          label="Delivery area"
                          value={order?.deliveryArea || "No delivery"}
                        />
                        <SummaryRow
                          label="Delivery address"
                          value={order?.deliveryAddress || "No delivery"}
                        />
                        <SummaryRow
                          label="Payment status"
                          value={
                            (order?.paymentStatus || "pending").toLowerCase() === "paid"
                              ? "Paid"
                              : "Unpaid"
                          }
                        />
                        <SummaryRow label="Workflow status" value={workflowStatus.label} />
                        <SummaryRow
                          label="Queue number"
                          value={queueAssigned ? String(order?.queueNumber) : "Not assigned yet"}
                        />
                        <SummaryRow
                          label="Total due"
                          value={formatZAR(order?.totalPrice || 0)}
                          strong
                        />
                      </>
                    )}
                  </div>
                </div>

                {!liveOrder && order?.weightBreakdown?.length ? (
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                      Weight breakdown
                    </p>

                    <div className="mt-4 space-y-3">
                      {order.weightBreakdown.map((row, index) => (
                        <div
                          key={row.id || `${row.label}-${index}`}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-white">{row.label}</p>
                              <p className="mt-1 text-sm text-white/55">{row.quantity} sheep</p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-white/55">
                                {formatZAR(row.price || 0)} each
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatZAR(row.subtotal || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!liveOrder && order?.sheepPreferences?.length ? (
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                      Slicing preferences
                    </p>

                    <div className="mt-4 space-y-3">
                      {order.sheepPreferences.map((item) => (
                        <div
                          key={`${item.sheepNo}-${item.weightLabel}`}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Sheep {item.sheepNo}
                            </p>
                            <p className="mt-1 text-xs text-white/45">{item.weightLabel}</p>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-white/75">
                            {item.cutPreferences?.length
                              ? item.cutPreferences.join(", ")
                              : "No slicing preference selected"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                    Banking details
                  </p>

                  <div className="mt-4 grid gap-3">
                    <CopyField label="Account name" value={settings.accountName} />
                    <CopyField label="Bank" value={settings.bankName} />
                    <CopyField label="Account number" value={settings.accountNumber} />
                    <CopyField label="Account type" value={settings.accountType} />
                    <CopyField label="Branch code" value={settings.branchCode} />

                    <div className="rounded-2xl border border-[#c6a268]/20 bg-[#c6a268]/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#d8b67e]">
                        Payment instruction
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-white">
                        {settings.referenceHint}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                    Confirmation kept safe
                  </p>
                  <div className="mt-4 grid gap-3">
                    <InfoCard>
                      {liveOrder
                        ? "Your live sheep order remains available on this confirmation page"
                        : "Your booking remains available on this confirmation page"}
                    </InfoCard>
                    <InfoCard>
                      {liveOrder
                        ? "Your order reference can be used for payment and follow-up"
                        : "Your booking reference can be used for payment and follow-up"}
                    </InfoCard>
                    <InfoCard>Your submitted pricing and preferences remain visible here</InfoCard>
                    <InfoCard>
                      Live workflow, payment status, and queue or collection status will reflect here as the order is updated
                    </InfoCard>
                  </div>
                </div>

                {order?.notes?.trim() ? (
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                      Additional notes
                    </p>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/75">
                      {order.notes}
                    </p>
                  </div>
                ) : null}

                {order?.cancelled && order?.cancelReason?.trim() ? (
                  <div className="rounded-[30px] border border-rose-400/20 bg-rose-400/10 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-rose-200 text-center lg:text-left">
                      Cancellation notes
                    </p>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-rose-100/85">
                      {order.cancelReason}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}