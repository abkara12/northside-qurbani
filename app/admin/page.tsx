"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, MouseEvent } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";

type WeightBreakdownItem = {
  id: string;
  label: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type OrderItem = {
  id: string;
  fullName?: string;
  phone?: string;
  email?: string;
  quantity?: number;
  preferredWeight?: string;
  weightBreakdown?: WeightBreakdownItem[];
  cutPreferences?: string[];
  notes?: string;
  addServices?: boolean;
  delivery?: boolean;
  servicesPerSheep?: number;
  servicesTotal?: number;
  deliveryPerSheep?: number;
  deliveryTotal?: number;
  basePriceTotal?: number;
  totalPrice?: number;
  paymentStatus?: string;
  slaughtered?: boolean;
  delivered?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

function formatZAR(value?: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: any) {
  try {
    if (!value) return "—";
    if (value?.toDate) {
      return value.toDate().toLocaleString("en-ZA", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
    return "—";
  } catch {
    return "—";
  }
}

function orderReference(id: string) {
  return `NQ-${id.slice(0, 8).toUpperCase()}`;
}

function sheepSummary(order: OrderItem) {
  if (order.weightBreakdown?.length) {
    return order.weightBreakdown
      .map((row) => `${row.quantity} × ${row.label}`)
      .join(" • ");
  }

  const qty = order.quantity || 0;
  const weight = order.preferredWeight?.trim();

  if (qty && weight) return `${qty} sheep • ${weight}`;
  if (qty) return `${qty} sheep`;
  if (weight) return weight;
  return "—";
}

function PaymentBadge({ value }: { value?: string }) {
  const paid = (value || "pending").toLowerCase() === "paid";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        paid
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/20 bg-amber-400/10 text-amber-200"
      }`}
    >
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function SlaughteredBadge({ slaughtered }: { slaughtered?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        slaughtered
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-sky-400/20 bg-sky-400/10 text-sky-200"
      }`}
    >
      {slaughtered ? "Slaughtered" : "Pending"}
    </span>
  );
}

function DeliveryBadge({ delivered }: { delivered?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        delivered
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-violet-400/20 bg-violet-400/10 text-violet-200"
      }`}
    >
      {delivered ? "Delivered" : "Awaiting Delivery"}
    </span>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition ${
        active
          ? "bg-[#c6a268] text-[#161015] shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="text-sm text-white/45">{label}</div>
      <div className="mt-2 text-[1.35rem] font-semibold text-white">{value}</div>
      {helper ? <div className="mt-1 text-xs text-white/42">{helper}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/10 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-sm text-white/45">{label}</span>
      <span
        className={`text-sm break-words sm:max-w-[62%] sm:text-right ${
          strong ? "font-semibold text-white" : "font-medium text-white"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function QuickActionButton({
  active,
  label,
  onClick,
  disabled,
  compact = false,
}: {
  active?: boolean;
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "px-3.5 py-2 text-[12px]" : "px-4 py-2 text-sm"
      } ${
        active
          ? "bg-[#c6a268] text-[#161015]"
          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminPage() {
  const [authReady, setAuthReady] = useState(false);
  const [authorised, setAuthorised] = useState(false);

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [updatingField, setUpdatingField] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setAuthorised(false);
        setAuthReady(true);
        window.location.assign("/login");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const role = snap.exists() ? (snap.data() as any).role : null;
        const ok = role === "admin" || role === "staff";

        setAuthorised(ok);
        setAuthReady(true);

        if (!ok) {
          await signOut(auth);
          window.location.assign("/login");
        }
      } catch {
        setAuthorised(false);
        setAuthReady(true);
        await signOut(auth);
        window.location.assign("/login");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authorised) return;

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const nextOrders: OrderItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<OrderItem, "id">),
        }));

        setOrders(nextOrders);
        setLoadingOrders(false);

        setSelectedOrder((prev) => {
          if (!prev) return prev;
          const refreshed = nextOrders.find((o) => o.id === prev.id);
          return refreshed || prev;
        });
      },
      (error) => {
        console.error("Orders snapshot error:", error);
        setLoadingOrders(false);
      }
    );

    return () => unsub();
  }, [authorised]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    const next = orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.fullName?.toLowerCase().includes(term) ||
        order.phone?.toLowerCase().includes(term) ||
        order.email?.toLowerCase().includes(term) ||
        orderReference(order.id).toLowerCase().includes(term) ||
        sheepSummary(order).toLowerCase().includes(term);

      const status = (order.paymentStatus || "pending").toLowerCase();

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "paid" && status === "paid") ||
        (paymentFilter === "unpaid" && status !== "paid");

      let matchesWorkflow = true;

      if (workflowFilter === "notSlaughtered") matchesWorkflow = !order.slaughtered;
      if (workflowFilter === "slaughtered") matchesWorkflow = !!order.slaughtered;
      if (workflowFilter === "awaitingDelivery") {
        matchesWorkflow = !!order.slaughtered && !order.delivered;
      }
      if (workflowFilter === "delivered") matchesWorkflow = !!order.delivered;

      return matchesSearch && matchesPayment && matchesWorkflow;
    });

    return [...next].sort((a, b) => {
      const aPriority =
        (a.delivered ? 100 : 0) +
        (a.slaughtered ? 10 : 0) +
        ((a.paymentStatus || "pending").toLowerCase() === "paid" ? 1 : 0);

      const bPriority =
        (b.delivered ? 100 : 0) +
        (b.slaughtered ? 10 : 0) +
        ((b.paymentStatus || "pending").toLowerCase() === "paid" ? 1 : 0);

      return aPriority - bPriority;
    });
  }, [orders, search, paymentFilter, workflowFilter]);

  const totalOrders = orders.length;
  const paidCount = orders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() === "paid"
  ).length;
  const unpaidCount = orders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() !== "paid"
  ).length;
  const slaughteredCount = orders.filter((o) => !!o.slaughtered).length;
  const awaitingDeliveryCount = orders.filter(
    (o) => !!o.slaughtered && !o.delivered
  ).length;
  const deliveredCount = orders.filter((o) => !!o.delivered).length;

  async function updateField(orderId: string, field: keyof OrderItem, value: any) {
    try {
      setUpdatingField(`${orderId}-${String(field)}`);
      await updateDoc(doc(db, "orders", orderId), {
        [field]: value,
      });
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      setUpdatingField("");
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      window.location.assign("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  if (!authReady || !authorised) {
    return (
      <main className="min-h-screen bg-[#09070b] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-8 py-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">
              Northside Qurbani
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-white">
              Opening the day’s register
            </h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />
        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#4a2a3b]/[0.26] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-4">
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
            <div className="mt-1 text-sm text-white/55">Farm register</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Homepage
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#4a2a3b] px-5 text-sm font-medium text-white transition hover:bg-[#3c2130]"
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-2 sm:px-10 lg:pb-24 lg:pt-4">
        <div className="grid gap-8 xl:grid-cols-12 xl:gap-8">
          <div className="xl:col-span-8">
            <div className="text-center xl:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl">
                Northside Qurbani
              </div>

              <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
                Qurbani Day Register
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-[1rem] leading-7 text-white/62 sm:text-[1.04rem] sm:leading-8 xl:mx-0">
                Customer bookings for the day.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Bookings" value={String(totalOrders)} />
              <SummaryCard label="Unpaid" value={String(unpaidCount)} helper={`${paidCount} paid`} />
              <SummaryCard label="Slaughtered" value={String(slaughteredCount)} />
              <SummaryCard
                label="Awaiting delivery"
                value={String(awaitingDeliveryCount)}
                helper={`${deliveredCount} delivered`}
              />
            </div>

            <div className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[1.3fr_auto_auto] xl:items-center">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/82">
                    Search
                  </label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, phone, email, or reference"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Payment</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={paymentFilter === "all"} label="All" onClick={() => setPaymentFilter("all")} />
                    <FilterButton active={paymentFilter === "unpaid"} label="Unpaid" onClick={() => setPaymentFilter("unpaid")} />
                    <FilterButton active={paymentFilter === "paid"} label="Paid" onClick={() => setPaymentFilter("paid")} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Status</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={workflowFilter === "all"} label="All" onClick={() => setWorkflowFilter("all")} />
                    <FilterButton active={workflowFilter === "notSlaughtered"} label="Pending" onClick={() => setWorkflowFilter("notSlaughtered")} />
                    <FilterButton active={workflowFilter === "slaughtered"} label="Slaughtered" onClick={() => setWorkflowFilter("slaughtered")} />
                    <FilterButton active={workflowFilter === "awaitingDelivery"} label="Awaiting Delivery" onClick={() => setWorkflowFilter("awaitingDelivery")} />
                    <FilterButton active={workflowFilter === "delivered"} label="Delivered" onClick={() => setWorkflowFilter("delivered")} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#d8b67e]">
                    Customer list
                  </p>
                  <h2 className="mt-2 text-[1.5rem] font-semibold text-white">
                    Bookings
                  </h2>
                </div>

                <div className="text-xs text-white/45 sm:text-right">
                  Select a booking to view the full details
                </div>
              </div>

              {loadingOrders ? (
                <div className="py-10 text-center text-white/65">Loading bookings...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-10 text-center text-white/65">
                  No bookings match the current filters.
                </div>
              ) : (
                <div className="mt-6 grid gap-4">
                  {filteredOrders.map((order) => {
                    const busyPayment = updatingField === `${order.id}-paymentStatus`;
                    const busySlaughtered = updatingField === `${order.id}-slaughtered`;
                    const busyDelivered = updatingField === `${order.id}-delivered`;

                    const isSelected = selectedOrder?.id === order.id;
                    const isMuted = !!order.slaughtered && !!order.delivered;

                    return (
                      <div
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrder(order)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedOrder(order);
                          }
                        }}
                        className={`cursor-pointer rounded-[28px] border p-5 text-left transition sm:p-6 ${
                          isSelected
                            ? "border-[#c6a268]/60 bg-white/[0.08] shadow-[0_20px_44px_rgba(0,0,0,0.18)]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        } ${isMuted ? "opacity-75" : "opacity-100"}`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-[1.1rem] font-semibold text-white sm:text-[1.2rem]">
                                {order.fullName || "Unnamed Customer"}
                              </h3>
                              {isSelected ? (
                                <span className="rounded-full border border-[#c6a268]/30 bg-[#c6a268]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e1c089]">
                                  Selected
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/60">
                              <span>{order.phone || "No phone number"}</span>
                              <span className="text-white/30">•</span>
                              <span>{sheepSummary(order)}</span>
                              <span className="text-white/30">•</span>
                              <span>{orderReference(order.id)}</span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <PaymentBadge value={order.paymentStatus} />
                              <SlaughteredBadge slaughtered={order.slaughtered} />
                              <DeliveryBadge delivered={order.delivered} />
                            </div>
                          </div>

                          <div className="shrink-0 text-left lg:text-right">
                            <div className="text-xs uppercase tracking-[0.22em] text-white/38">
                              Total
                            </div>
                            <div className="mt-1 text-[1.1rem] font-semibold text-white">
                              {formatZAR(order.totalPrice)}
                            </div>
                          </div>
                        </div>

                        <div className="my-5 h-px w-full bg-white/10" />

                        <div className="flex flex-wrap gap-2">
                          <QuickActionButton
                            compact
                            active={(order.paymentStatus || "pending").toLowerCase() === "paid"}
                            label={(order.paymentStatus || "pending").toLowerCase() === "paid" ? "Paid" : "Mark Paid"}
                            disabled={busyPayment}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateField(
                                order.id,
                                "paymentStatus",
                                (order.paymentStatus || "pending").toLowerCase() === "paid"
                                  ? "pending"
                                  : "paid"
                              );
                            }}
                          />

                          <QuickActionButton
                            compact
                            active={!!order.slaughtered}
                            label={order.slaughtered ? "Slaughtered" : "Mark Slaughtered"}
                            disabled={busySlaughtered}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateField(order.id, "slaughtered", !order.slaughtered);
                            }}
                          />

                          <QuickActionButton
                            compact
                            active={!!order.delivered}
                            label={order.delivered ? "Delivered" : "Mark Delivered"}
                            disabled={busyDelivered}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateField(order.id, "delivered", !order.delivered);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="space-y-6 xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <p className="text-center text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] xl:text-left">
                  Booking
                </p>
                <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white xl:text-left">
                  {selectedOrder ? "Selected booking" : "Select a booking"}
                </h2>

                {selectedOrder ? (
                  <>
                    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <div className="text-sm text-white/45">Reference</div>
                      <div className="mt-2 break-all text-[1.2rem] font-semibold tracking-[0.08em] text-[#d8b67e] sm:text-[1.35rem]">
                        {orderReference(selectedOrder.id)}
                      </div>
                    </div>

                    <div className="mt-6">
                      <DetailRow label="Customer name" value={selectedOrder.fullName || "—"} />
                      <DetailRow label="Phone" value={selectedOrder.phone || "—"} />
                      <DetailRow label="Email" value={selectedOrder.email || "—"} />
                      <DetailRow label="Sheep" value={sheepSummary(selectedOrder)} />
                      <DetailRow
                        label="Slicing preferences"
                        value={
                          selectedOrder.cutPreferences?.length
                            ? selectedOrder.cutPreferences.join(", ")
                            : "—"
                        }
                      />
                      <DetailRow
                        label="Service package"
                        value={selectedOrder.addServices ? "Included" : "Not added"}
                      />
                      <DetailRow
                        label="Delivery"
                        value={selectedOrder.delivery ? "Included" : "Not added"}
                      />
                      <DetailRow
                        label="Total due"
                        value={formatZAR(selectedOrder.totalPrice)}
                        strong
                      />
                      <DetailRow
                        label="Payment"
                        value={
                          (selectedOrder.paymentStatus || "pending").toLowerCase() === "paid"
                            ? "PAID"
                            : "UNPAID"
                        }
                      />
                      <DetailRow
                        label="Slaughtered"
                        value={selectedOrder.slaughtered ? "YES" : "NO"}
                      />
                      <DetailRow
                        label="Delivery status"
                        value={selectedOrder.delivered ? "DELIVERED" : "AWAITING DELIVERY"}
                      />
                      <DetailRow label="Created" value={formatDate(selectedOrder.createdAt)} />
                    </div>

                    {selectedOrder.weightBreakdown?.length ? (
                      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Weight breakdown</div>
                        <div className="mt-3 space-y-3">
                          {selectedOrder.weightBreakdown.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-start justify-between gap-3 text-sm"
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
                      </div>
                    ) : null}

                    {selectedOrder.notes ? (
                      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Notes</div>
                        <div className="mt-2 text-sm leading-6 text-white/68">
                          {selectedOrder.notes}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-4">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Payment</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["pending", "paid"].map((value) => (
                            <QuickActionButton
                              key={value}
                              active={(selectedOrder.paymentStatus || "pending") === value}
                              label={value === "paid" ? "Mark Paid" : "Mark Unpaid"}
                              disabled={updatingField === `${selectedOrder.id}-paymentStatus`}
                              onClick={(_e) =>
                                updateField(selectedOrder.id, "paymentStatus", value)
                              }
                            />
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Slaughter status</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <QuickActionButton
                            active={!!selectedOrder.slaughtered}
                            label={selectedOrder.slaughtered ? "Slaughtered" : "Mark Slaughtered"}
                            disabled={updatingField === `${selectedOrder.id}-slaughtered`}
                            onClick={(_e) =>
                              updateField(
                                selectedOrder.id,
                                "slaughtered",
                                !selectedOrder.slaughtered
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Delivery</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <QuickActionButton
                            active={!!selectedOrder.delivered}
                            label={selectedOrder.delivered ? "Delivered" : "Mark Delivered"}
                            disabled={updatingField === `${selectedOrder.id}-delivered`}
                            onClick={(_e) =>
                              updateField(
                                selectedOrder.id,
                                "delivered",
                                !selectedOrder.delivered
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#d8b67e]">
                  Overview
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">Paid</span>
                    <span className="text-sm font-semibold text-white">{paidCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">Unpaid</span>
                    <span className="text-sm font-semibold text-white">{unpaidCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">Slaughtered</span>
                    <span className="text-sm font-semibold text-white">{slaughteredCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">Awaiting delivery</span>
                    <span className="text-sm font-semibold text-white">{awaitingDeliveryCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">Delivered</span>
                    <span className="text-sm font-semibold text-white">{deliveredCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}