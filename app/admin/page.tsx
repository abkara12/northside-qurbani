"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type OrderItem = {
  id: string;
  fullName?: string;
  phone?: string;
  email?: string;
  quantity?: number;
  preferredWeight?: string;
  cutPreferences?: string[];
  notes?: string;
  addServices?: boolean;
  delivery?: boolean;
  basePricePerSheep?: number;
  servicesPerSheep?: number;
  deliveryPerSheep?: number;
  pricePerSheep?: number;
  totalPrice?: number;

  paymentStatus?: string;

  tagsIssued?: boolean;
  fetched?: boolean;
  takenForSlaughter?: boolean;
  slaughtered?: boolean;
  processed?: boolean;
  readyForCollection?: boolean;
  collected?: boolean;

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

function boolLabel(value?: boolean) {
  return value ? "Done" : "Pending";
}

function WorkflowBadge({
  value,
  doneText = "Done",
  pendingText = "Pending",
}: {
  value?: boolean;
  doneText?: string;
  pendingText?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        value
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/20 bg-amber-400/10 text-amber-200"
      }`}
    >
      {value ? doneText : pendingText}
    </span>
  );
}

function PaymentBadge({ value }: { value?: string }) {
  const paid = (value || "pending").toLowerCase() === "paid";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        paid
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/20 bg-amber-400/10 text-amber-200"
      }`}
    >
      {paid ? "Paid" : "Pending"}
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
          ? "bg-[#c6a268] text-[#161015] shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
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
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="text-sm text-white/45">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${subtle ? "text-white" : "text-[#d8b67e]"}`}>
        {value}
      </div>
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

function ToggleActionButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
  const [updatingField, setUpdatingField] = useState<string>("");

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

    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.fullName?.toLowerCase().includes(term) ||
        order.phone?.toLowerCase().includes(term) ||
        order.email?.toLowerCase().includes(term) ||
        orderReference(order.id).toLowerCase().includes(term);

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "paid" && (order.paymentStatus || "pending").toLowerCase() === "paid") ||
        (paymentFilter === "pending" && (order.paymentStatus || "pending").toLowerCase() !== "paid");

      let matchesWorkflow = true;

      if (workflowFilter === "tagsPending") matchesWorkflow = !order.tagsIssued;
      if (workflowFilter === "fetchedPending") matchesWorkflow = !!order.tagsIssued && !order.fetched;
      if (workflowFilter === "slaughterPending") matchesWorkflow = !!order.fetched && !order.slaughtered;
      if (workflowFilter === "processingPending") matchesWorkflow = !!order.slaughtered && !order.processed;
      if (workflowFilter === "readyPending") matchesWorkflow = !!order.processed && !order.readyForCollection;
      if (workflowFilter === "ready") matchesWorkflow = !!order.readyForCollection && !order.collected;
      if (workflowFilter === "collected") matchesWorkflow = !!order.collected;

      return matchesSearch && matchesPayment && matchesWorkflow;
    });
  }, [orders, search, paymentFilter, workflowFilter]);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const paidCount = orders.filter((o) => (o.paymentStatus || "pending") === "paid").length;
  const tagsIssuedCount = orders.filter((o) => !!o.tagsIssued).length;
  const slaughteredCount = orders.filter((o) => !!o.slaughtered).length;
  const readyCount = orders.filter((o) => !!o.readyForCollection && !o.collected).length;
  const collectedCount = orders.filter((o) => !!o.collected).length;

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
            <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">Loading</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Preparing dashboard</h1>
            <p className="mt-3 text-white/65">Please wait while access is verified.</p>
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,162,104,0.05),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(74,42,59,0.18),transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
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
            <div className="mt-1 text-sm text-white/55">
              Staff dashboard
            </div>
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
                Operations dashboard
              </div>

              <h1 className="mt-5 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
                Manage qurbani-day
                <span className="mt-1 block">operations with</span>
                <span className="mt-1 block">clarity and control.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-[0.98rem] leading-7 text-white/68 sm:text-[1.03rem] sm:leading-8 xl:mx-0">
                Track arrivals, tags, fetching, slaughter, processing, readiness, and collection
                from one refined operational workspace.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Total bookings" value={String(totalOrders)} subtle />
              <SummaryCard label="Estimated revenue" value={formatZAR(totalRevenue)} />
              <SummaryCard label="Paid bookings" value={String(paidCount)} subtle />
              <SummaryCard label="Tags issued" value={String(tagsIssuedCount)} subtle />
              <SummaryCard label="Slaughtered" value={String(slaughteredCount)} subtle />
              <SummaryCard label="Ready / Collected" value={`${readyCount} / ${collectedCount}`} subtle />
            </div>

            <div className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_auto_auto] xl:items-center">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/82">
                    Search bookings
                  </label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, phone, email, or booking reference"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Payment</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={paymentFilter === "all"} label="All" onClick={() => setPaymentFilter("all")} />
                    <FilterButton active={paymentFilter === "pending"} label="Pending" onClick={() => setPaymentFilter("pending")} />
                    <FilterButton active={paymentFilter === "paid"} label="Paid" onClick={() => setPaymentFilter("paid")} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Workflow</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={workflowFilter === "all"} label="All" onClick={() => setWorkflowFilter("all")} />
                    <FilterButton active={workflowFilter === "tagsPending"} label="Awaiting Tags" onClick={() => setWorkflowFilter("tagsPending")} />
                    <FilterButton active={workflowFilter === "fetchedPending"} label="Awaiting Fetch" onClick={() => setWorkflowFilter("fetchedPending")} />
                    <FilterButton active={workflowFilter === "slaughterPending"} label="Awaiting Slaughter" onClick={() => setWorkflowFilter("slaughterPending")} />
                    <FilterButton active={workflowFilter === "processingPending"} label="Awaiting Processing" onClick={() => setWorkflowFilter("processingPending")} />
                    <FilterButton active={workflowFilter === "ready"} label="Ready" onClick={() => setWorkflowFilter("ready")} />
                    <FilterButton active={workflowFilter === "collected"} label="Collected" onClick={() => setWorkflowFilter("collected")} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                <div className="text-center sm:text-left">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#d8b67e]">
                    Live bookings
                  </p>
                  <h2 className="mt-2 text-[1.5rem] font-semibold text-white">
                    Qurbani-day management
                  </h2>
                </div>
              </div>

              {loadingOrders ? (
                <div className="px-6 py-10 text-center text-white/65">
                  Loading bookings...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="px-6 py-10 text-center text-white/65">
                  No bookings match the current filters.
                </div>
              ) : (
                <div className="grid gap-0">
                  {filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="border-t border-white/10 px-5 py-5 text-left transition hover:bg-white/[0.04] sm:px-6"
                    >
                      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr_0.5fr_0.8fr_0.8fr_0.8fr] xl:items-center xl:gap-4">
                        <div>
                          <div className="font-semibold text-white">{order.fullName || "—"}</div>
                          <div className="mt-1 text-sm text-white/52">{order.phone || "—"}</div>
                        </div>

                        <div className="text-sm font-medium text-[#d8b67e]">
                          {orderReference(order.id)}
                        </div>

                        <div className="text-sm text-white">{order.quantity || "—"}</div>

                        <div className="text-sm font-semibold text-white">
                          {formatZAR(order.totalPrice)}
                        </div>

                        <div>
                          <PaymentBadge value={order.paymentStatus} />
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <WorkflowBadge value={order.tagsIssued} doneText="Tagged" pendingText="No Tags" />
                          <WorkflowBadge value={order.slaughtered} doneText="Slaughtered" pendingText="Not Slaughtered" />
                          <WorkflowBadge value={order.readyForCollection} doneText="Ready" pendingText="Not Ready" />
                          <WorkflowBadge value={order.collected} doneText="Collected" pendingText="Not Collected" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 xl:hidden">
                        <div className="text-sm text-white/58">
                          Reference: <span className="font-medium text-[#d8b67e]">{orderReference(order.id)}</span>
                        </div>
                        <div className="text-sm text-white/58">
                          Quantity: <span className="font-medium text-white">{order.quantity || "—"}</span>
                        </div>
                        <div className="text-sm text-white/58">
                          Total due: <span className="font-semibold text-white">{formatZAR(order.totalPrice)}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <PaymentBadge value={order.paymentStatus} />
                          <WorkflowBadge value={order.tagsIssued} doneText="Tagged" pendingText="No Tags" />
                          <WorkflowBadge value={order.fetched} doneText="Fetched" pendingText="Not Fetched" />
                          <WorkflowBadge value={order.slaughtered} doneText="Slaughtered" pendingText="Not Slaughtered" />
                          <WorkflowBadge value={order.readyForCollection} doneText="Ready" pendingText="Not Ready" />
                          <WorkflowBadge value={order.collected} doneText="Collected" pendingText="Not Collected" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="space-y-6 xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <p className="text-center text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] xl:text-left">
                  Order details
                </p>
                <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white xl:text-left">
                  {selectedOrder ? "Selected booking" : "No booking selected"}
                </h2>
                <p className="mt-2 text-center text-sm leading-6 text-white/60 xl:text-left">
                  {selectedOrder
                    ? "Review the full order and update qurbani-day workflow steps below."
                    : "Select a booking from the list to review its details."}
                </p>

                {selectedOrder ? (
                  <>
                    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <div className="text-sm text-white/45">Booking reference</div>
                      <div className="mt-2 break-all text-[1.2rem] font-semibold tracking-[0.08em] text-[#d8b67e] sm:text-[1.35rem]">
                        {orderReference(selectedOrder.id)}
                      </div>
                    </div>

                    <div className="mt-6">
                      <DetailRow label="Customer name" value={selectedOrder.fullName || "—"} />
                      <DetailRow label="Phone" value={selectedOrder.phone || "—"} />
                      <DetailRow label="Email" value={selectedOrder.email || "—"} />
                      <DetailRow label="Quantity" value={String(selectedOrder.quantity || "—")} />
                      <DetailRow label="Weight range" value={selectedOrder.preferredWeight || "—"} />
                      <DetailRow
                        label="Cutting preferences"
                        value={selectedOrder.cutPreferences?.length ? selectedOrder.cutPreferences.join(", ") : "—"}
                      />
                      <DetailRow
                        label="Service package"
                        value={selectedOrder.addServices ? "Included" : "Not added"}
                      />
                      <DetailRow
                        label="Delivery"
                        value={selectedOrder.delivery ? "Included" : "Not added"}
                      />
                      <DetailRow label="Total due" value={formatZAR(selectedOrder.totalPrice)} strong />
                      <DetailRow label="Payment status" value={(selectedOrder.paymentStatus || "pending").toUpperCase()} />
                      <DetailRow label="Tags issued" value={boolLabel(selectedOrder.tagsIssued)} />
                      <DetailRow label="Fetched" value={boolLabel(selectedOrder.fetched)} />
                      <DetailRow label="Taken for slaughter" value={boolLabel(selectedOrder.takenForSlaughter)} />
                      <DetailRow label="Slaughtered" value={boolLabel(selectedOrder.slaughtered)} />
                      <DetailRow label="Processed" value={boolLabel(selectedOrder.processed)} />
                      <DetailRow label="Ready for collection" value={boolLabel(selectedOrder.readyForCollection)} />
                      <DetailRow label="Collected" value={boolLabel(selectedOrder.collected)} />
                      <DetailRow label="Created" value={formatDate(selectedOrder.createdAt)} />
                    </div>

                    {selectedOrder.notes ? (
                      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Additional notes</div>
                        <div className="mt-2 text-sm leading-6 text-white/68">
                          {selectedOrder.notes}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-4">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Payment status</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["pending", "paid"].map((value) => (
                            <ToggleActionButton
                              key={value}
                              active={(selectedOrder.paymentStatus || "pending") === value}
                              label={value === "paid" ? "Mark Paid" : "Mark Pending"}
                              disabled={updatingField === `${selectedOrder.id}-paymentStatus`}
                              onClick={() => updateField(selectedOrder.id, "paymentStatus", value)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-medium text-white/82">Qurbani-day workflow</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ToggleActionButton
                            active={!!selectedOrder.tagsIssued}
                            label="Tags Issued"
                            disabled={updatingField === `${selectedOrder.id}-tagsIssued`}
                            onClick={() => updateField(selectedOrder.id, "tagsIssued", !selectedOrder.tagsIssued)}
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.fetched}
                            label="Fetched"
                            disabled={updatingField === `${selectedOrder.id}-fetched`}
                            onClick={() => updateField(selectedOrder.id, "fetched", !selectedOrder.fetched)}
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.takenForSlaughter}
                            label="Taken for Slaughter"
                            disabled={updatingField === `${selectedOrder.id}-takenForSlaughter`}
                            onClick={() =>
                              updateField(
                                selectedOrder.id,
                                "takenForSlaughter",
                                !selectedOrder.takenForSlaughter
                              )
                            }
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.slaughtered}
                            label="Slaughtered"
                            disabled={updatingField === `${selectedOrder.id}-slaughtered`}
                            onClick={() =>
                              updateField(selectedOrder.id, "slaughtered", !selectedOrder.slaughtered)
                            }
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.processed}
                            label="Processed"
                            disabled={updatingField === `${selectedOrder.id}-processed`}
                            onClick={() =>
                              updateField(selectedOrder.id, "processed", !selectedOrder.processed)
                            }
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.readyForCollection}
                            label="Ready for Collection"
                            disabled={updatingField === `${selectedOrder.id}-readyForCollection`}
                            onClick={() =>
                              updateField(
                                selectedOrder.id,
                                "readyForCollection",
                                !selectedOrder.readyForCollection
                              )
                            }
                          />
                          <ToggleActionButton
                            active={!!selectedOrder.collected}
                            label="Collected"
                            disabled={updatingField === `${selectedOrder.id}-collected`}
                            onClick={() =>
                              updateField(selectedOrder.id, "collected", !selectedOrder.collected)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}