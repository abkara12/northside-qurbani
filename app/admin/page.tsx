"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
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
   paymentStatus?: "pending" | "paid";
  slaughtered?: boolean;
  sliced?: boolean;
  delivered?: boolean;
  createdAt?: any;
  updatedAt?: any;
  cancelled?: boolean;
  cancelReason?: string;
  queueNumber?: number | null;
  queueCheckedInAt?: any;
  manualEntry?: boolean;
  bookingYear?: number;
  orderType?: "qurbani" | "live";
  liveQuantity?: number;
  livePricePerSheep?: number;
  pricingVisible?: boolean;
};

type SettingsWeightOption = {
  label: string;
  price: number;
  stock?: number | null;
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
  weightOptions: SettingsWeightOption[];
};

type EditFormState = {
  fullName: string;
  phone: string;
  email: string;
  cutPreferences: string;
  notes: string;
  addServices: boolean;
  delivery: boolean;
    paymentStatus: "pending" | "paid";
  slaughtered: boolean;
  sliced: boolean;
  delivered: boolean;
  cancelled: boolean;
  cancelReason: string;
  weightRows: Array<{
    id: string;
    label: string;
    quantity: string;
  }>;
  liveQuantity: string;
  livePricePerSheep: string;
  pricingVisible: boolean;
};

type ManualFormState = {
  fullName: string;
  phone: string;
  email: string;
  cutPreferences: string;
  notes: string;
  addServices: boolean;
  delivery: boolean;
  paymentStatus: "pending" | "paid";
  weightRows: Array<{
    id: string;
    label: string;
    quantity: string;
  }>;
};

type ExpenseItem = {
  id: string;
  title?: string;
  amount?: number;
  category?: "skinners" | "workers" | "trailer" | "other";
  notes?: string;
  createdAt?: any;
  createdByRole?: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  bookingsOpen: true,
  bookingCutoffDate: "",
  accountName: "Northside Qurbani",
  bankName: "REPLACE WITH BANK NAME",
  accountNumber: "REPLACE WITH ACCOUNT NUMBER",
  accountType: "Business Cheque",
  branchCode: "REPLACE WITH BRANCH CODE",
  referenceHint:
    "Please send your proof of payment / reference to Moulana Shaheed or Uncle Yaqoob on WhatsApp.",
  reminderMessageIntro:
    "Assalaamu alaikum. This is a kind reminder regarding your Northside Qurbani booking.",
  weightOptions: [
    { label: "35–39 kg", price: 2750, stock: null },
    { label: "40–45 kg", price: 3150, stock: null },
    { label: "46–50 kg", price: 3500, stock: null },
    { label: "51–55 kg", price: 3850, stock: null },
    { label: "56–60 kg", price: 4200, stock: null },
  ],
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

function slugId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanPhoneForWhatsApp(phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("27")) return digits;
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

function sheepSummary(order: OrderItem) {
  if (order.orderType === "live") {
    return `${order.liveQuantity || order.quantity || 0} live sheep`;
  }

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

function statusLabel(order: OrderItem) {
  if (order.cancelled) return "Cancelled";

  if (order.orderType === "live") {
    if (order.delivered) return "Delivered";
    return "Pending";
  }

  if (order.delivered) return "Delivered";
  if (order.slaughtered) return "Slaughtered";
  if ((order.queueNumber || 0) > 0) return "In Queue";
  return "Pending";
}

function rowsFromOrder(order: OrderItem) {
  if (order.orderType === "live") {
    return [];
  }

  if (order.weightBreakdown?.length) {
    return order.weightBreakdown.map((row) => ({
      id: row.id || slugId(),
      label: row.label,
      quantity: String(row.quantity || 1),
    }));
  }

  return [
    {
      id: slugId(),
      label: order.preferredWeight || "",
      quantity: String(order.quantity || 1),
    },
  ];
}

function buildLegacyPreferredWeight(weightBreakdown: WeightBreakdownItem[]) {
  return weightBreakdown.map((row) => `${row.label} x${row.quantity}`).join(", ");
}

function getPriceForLabel(label: string, settings: AppSettings) {
  const match = settings.weightOptions.find((item) => item.label === label.trim());
  return match?.price || 0;
}

function computeBreakdownFromRows(
  rows: Array<{ id: string; label: string; quantity: string }>,
  settings: AppSettings
) {
  const validRows = rows
    .map((row) => {
      const quantity = Number(row.quantity || 0);
      const price = getPriceForLabel(row.label, settings);
      const subtotal = quantity * price;
      return { id: row.id, label: row.label.trim(), quantity, price, subtotal };
    })
    .filter((row) => row.label && Number.isInteger(row.quantity) && row.quantity > 0);

  return validRows.map((row) => ({
    id: row.id,
    label: row.label,
    quantity: row.quantity,
    price: row.price,
    subtotal: row.subtotal,
  })) as WeightBreakdownItem[];
}

function bookingAmountLabel(order: OrderItem) {
  if (order.orderType === "live" && order.pricingVisible === false) {
    return "To be confirmed";
  }
  return formatZAR(order.totalPrice || 0);
}
function getLiveCalculatedTotal(editForm: EditFormState | null) {
  if (!editForm) return 0;
  return Number(editForm.liveQuantity || 0) * Number(editForm.livePricePerSheep || 0);
}

function normaliseStock(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function mergeWeightQuantities(rows: WeightBreakdownItem[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.label, (map.get(row.label) || 0) + row.quantity);
  }
  return map;
}

async function applyQurbaniStockTransaction({
  existingOrder,
  nextWeightBreakdown,
  buildOrderPayload,
}: {
  existingOrder?: OrderItem | null;
  nextWeightBreakdown: WeightBreakdownItem[];
  buildOrderPayload: () => Record<string, any>;
}) {
  const settingsRef = doc(db, "settings", "qurbani");
  const targetOrderRef = existingOrder
    ? doc(db, "orders", existingOrder.id)
    : doc(collection(db, "orders"));

  await runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    const liveSettings = settingsSnap.exists()
      ? ({ ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<AppSettings>) } as AppSettings)
      : DEFAULT_SETTINGS;

    const previousMap = mergeWeightQuantities(existingOrder?.weightBreakdown || []);
    const nextMap = mergeWeightQuantities(nextWeightBreakdown);

    const updatedWeightOptions = liveSettings.weightOptions.map((option) => {
      const currentStock = normaliseStock(option.stock);

      if (currentStock === null) {
        throw new Error(`Stock has not been set for ${option.label}.`);
      }

      const previousQty = previousMap.get(option.label) || 0;
      const nextQty = nextMap.get(option.label) || 0;
      const delta = nextQty - previousQty;

      if (delta === 0) return option;

      if (delta < 0) {
        return {
          ...option,
          stock: currentStock + Math.abs(delta),
        };
      }

      if (delta > currentStock) {
        throw new Error(`${option.label} only has ${currentStock} left.`);
      }

      return {
        ...option,
        stock: currentStock - delta,
      };
    });

    transaction.update(settingsRef, {
      weightOptions: updatedWeightOptions,
      updatedAt: serverTimestamp(),
    });

    if (existingOrder) {
      transaction.update(targetOrderRef, {
        ...buildOrderPayload(),
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(targetOrderRef, {
        ...buildOrderPayload(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
}


function buildPaymentReminderMessage(order: OrderItem, settings: AppSettings) {
  const ref = orderReference(order.id);
  const summary = sheepSummary(order);
  const amountLine =
    order.orderType === "live" && order.pricingVisible === false
      ? "Amount Due: To be confirmed by admin"
      : `Amount Due: ${formatZAR(order.totalPrice || 0)}`;

  return `${settings.reminderMessageIntro}

Booking Ref: ${ref}
Booking: ${summary}
${amountLine}

Bank: ${settings.bankName}
Account Name: ${settings.accountName}
Account Number: ${settings.accountNumber}
Account Type: ${settings.accountType}
Branch Code: ${settings.branchCode}

${settings.referenceHint}`;
}

function buildCancellationMessage(order: OrderItem, reason: string) {
  const ref = orderReference(order.id);
  return `Assalaamu alaikum.

Your Northside Qurbani booking (${ref}) has been cancelled.

Reason: ${reason || "No reason provided"}

If this was done in error, please contact the team directly.`;
}



function buildQueueAssignedMessage(order: OrderItem, assignedQueueNumber: number) {
  const ref = orderReference(order.id);

  return `Assalaamu alaikum.

Your Northside Qurbani booking has now been added to the queue.

Booking Ref: ${ref}
Queue Number: ${assignedQueueNumber}
Booking: ${sheepSummary(order)}

Please keep your queue number ready and show it when called.`;
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



function WorkflowBadge({ order }: { order: OrderItem }) {
  if (order.orderType === "live" && !order.cancelled && !order.delivered) {
    return null;
  }

  const label = statusLabel(order);
  const className =
    label === "Delivered"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : label === "Slaughtered"
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : label === "In Queue"
      ? "border-[#c6a268]/30 bg-[#c6a268]/15 text-[#f3dfb8]"
      : label === "Cancelled"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
      : "border-violet-400/20 bg-violet-400/10 text-violet-200";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {order.orderType === "live" && label === "Delivered" ? "Collected" : label}
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

function SectionCard({
  title,
  sub,
  children,
  highlight = false,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[30px] border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6 ${
        highlight
          ? "border-[#c6a268]/35 bg-[#c6a268]/[0.08]"
          : "border-white/10 bg-white/[0.045]"
      }`}
    >
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {sub ? <p className="mt-1 text-sm text-white/55">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MiniBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-4 space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-4 text-xs">
              <span className="text-white/65">{item.label}</span>
              <span className="font-medium text-white">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-[#c6a268]"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
 const [authReady, setAuthReady] = useState(false);
const [authorised, setAuthorised] = useState(false);
const [userRole, setUserRole] = useState<"admin" | "staff" | "">("");

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");

  const [mode, setMode] = useState<"simple" | "management">("simple");

  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [simpleSearch, setSimpleSearch] = useState("");

  const [updatingField, setUpdatingField] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOutstandingPanel, setShowOutstandingPanel] = useState(false);

  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
const [loadingExpenses, setLoadingExpenses] = useState(true);
const [showExpensesPanel, setShowExpensesPanel] = useState(false);
const [expenseSaving, setExpenseSaving] = useState(false);

const [expenseForm, setExpenseForm] = useState({
  title: "",
  amount: "",
  category: "other" as "skinners" | "workers" | "trailer" | "other",
  notes: "",
});

const isOwner = userRole === "admin";

  const [manualForm, setManualForm] = useState<ManualFormState>({
    fullName: "",
    phone: "",
    email: "",
    cutPreferences: "",
    notes: "",
    addServices: false,
    delivery: false,
    paymentStatus: "pending",
    weightRows: [{ id: slugId(), label: "", quantity: "1" }],
  });
  const [manualSaving, setManualSaving] = useState(false);

  const [bulkReminderActive, setBulkReminderActive] = useState(false);
  const [bulkReminderIndex, setBulkReminderIndex] = useState(0);
  const [bulkReminderTargets, setBulkReminderTargets] = useState<OrderItem[]>([]);

  const selectedBookingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setAuthorised(false);
      setUserRole("");
      setAuthReady(true);
      window.location.assign("/login");
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      const role = snap.exists() ? (snap.data() as any).role : null;
      const ok = role === "admin" || role === "staff";

      setAuthorised(ok);
      setUserRole(ok ? role : "");
      setAuthReady(true);

      if (!ok) {
        await signOut(auth);
        window.location.assign("/login");
      }
    } catch {
      setAuthorised(false);
      setUserRole("");
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
          return nextOrders.find((o) => o.id === prev.id) || null;
        });
      },
      (error) => {
        console.error("Orders snapshot error:", error);
        setLoadingOrders(false);
      }
    );
    return () => unsub();
  }, [authorised]);

  useEffect(() => {
    if (!authorised) return;
    const settingsRef = doc(db, "settings", "qurbani");
    const unsub = onSnapshot(
      settingsRef,
      async (snap) => {
        if (!snap.exists()) {
          try {
            await setDoc(settingsRef, {
              ...DEFAULT_SETTINGS,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setSettings(DEFAULT_SETTINGS);
          } catch (error) {
            console.error("Failed creating default settings:", error);
            setSettings(DEFAULT_SETTINGS);
          }
          return;
        }
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) });
      },
      (error) => {
        console.error("Settings snapshot error:", error);
      }
    );
    return () => unsub();
  }, [authorised]);

  useEffect(() => {
  if (!authorised || !isOwner) {
    setExpenses([]);
    setLoadingExpenses(false);
    return;
  }

  const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const nextExpenses: ExpenseItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ExpenseItem, "id">),
      }));
      setExpenses(nextExpenses);
      setLoadingExpenses(false);
    },
    (error) => {
      console.error("Expenses snapshot error:", error);
      setLoadingExpenses(false);
    }
  );

  return () => unsub();
}, [authorised, isOwner]);

useEffect(() => {
  if (!selectedOrder) {
    setEditForm(null);
    setHasUnsavedChanges(false);
    return;
  }

  setEditForm({
    fullName: selectedOrder.fullName || "",
    phone: selectedOrder.phone || "",
    email: selectedOrder.email || "",
    cutPreferences: (selectedOrder.cutPreferences || []).join(", "),
    notes: selectedOrder.notes || "",
    addServices: !!selectedOrder.addServices,
    delivery: !!selectedOrder.delivery,
        paymentStatus:
      (selectedOrder.paymentStatus || "pending").toLowerCase() === "paid"
        ? "paid"
        : "pending",
    slaughtered: !!selectedOrder.slaughtered,
    sliced: !!selectedOrder.sliced,
    delivered: !!selectedOrder.delivered,
    cancelled: !!selectedOrder.cancelled,
    cancelReason: selectedOrder.cancelReason || "",
    weightRows: rowsFromOrder(selectedOrder),
    liveQuantity: String(selectedOrder.liveQuantity || selectedOrder.quantity || 1),
    livePricePerSheep: String(selectedOrder.livePricePerSheep || 0),
    pricingVisible: selectedOrder.pricingVisible !== false,
  });

  setHasUnsavedChanges(false);
  setSaveMessage("");

  const timer = setTimeout(() => {
    selectedBookingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 120);

  return () => clearTimeout(timer);
}, [selectedOrder]);

  const activeOrders = useMemo(() => orders.filter((o) => !o.cancelled), [orders]);

  const activeQurbaniOrders = useMemo(
    () => activeOrders.filter((o) => o.orderType !== "live"),
    [activeOrders]
  );

  const nextQueueNumber = useMemo(() => {
    const maxQueue = activeQurbaniOrders.reduce((max, order) => {
      const value = order.queueNumber || 0;
      return value > max ? value : max;
    }, 0);
    return maxQueue + 1;
  }, [activeQurbaniOrders]);

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

    const payment = (order.paymentStatus || "pending").toLowerCase();
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "paid" && payment === "paid") ||
      (paymentFilter === "unpaid" && payment !== "paid");

    const matchesOrderType =
      orderTypeFilter === "all" ||
      (orderTypeFilter === "qurbani" && order.orderType !== "live") ||
      (orderTypeFilter === "live" && order.orderType === "live");

    const matchesWorkflow =
  workflowFilter === "all" ||
  (workflowFilter === "pending" &&
    !order.cancelled &&
    !order.delivered &&
    (order.orderType === "live" ? true : !order.slaughtered)) ||
  (workflowFilter === "slaughtered" &&
    order.orderType !== "live" &&
    !order.cancelled &&
    !!order.slaughtered &&
    !order.delivered) ||
    (workflowFilter === "sliced" &&
    order.orderType !== "live" &&
    !order.cancelled &&
    !!order.sliced) ||
  (workflowFilter === "awaiting_delivery" &&
    order.orderType !== "live" &&
    !order.cancelled &&
    !!order.slaughtered &&
    !order.delivered) ||
  (workflowFilter === "delivered" && !order.cancelled && !!order.delivered) ||
  (workflowFilter === "cancelled" && !!order.cancelled);
  


    return (
      matchesSearch &&
      matchesPayment &&
      matchesOrderType &&
      matchesWorkflow 
        );
  });

  return [...next].sort((a, b) => {
    const nameA = (a.fullName || "").trim();
    const nameB = (b.fullName || "").trim();
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });
}, [orders, search, paymentFilter, workflowFilter, orderTypeFilter]);

  const simpleSearchResults = useMemo(() => {
    const term = simpleSearch.trim().toLowerCase();
    if (!term) return [];
    return activeQurbaniOrders
      .filter(
        (order) =>
          order.fullName?.toLowerCase().includes(term) ||
          order.phone?.toLowerCase().includes(term) ||
          order.email?.toLowerCase().includes(term) ||
          orderReference(order.id).toLowerCase().includes(term)
      )
      .sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, {
          sensitivity: "base",
        })
      )
      .slice(0, 12);
  }, [activeQurbaniOrders, simpleSearch]);

  const queueOrders = useMemo(() => {
    return activeQurbaniOrders
      .filter((order) => !order.cancelled && !order.slaughtered && (order.queueNumber || 0) > 0)
      .sort((a, b) => (a.queueNumber || 999999) - (b.queueNumber || 999999));
  }, [activeQurbaniOrders]);

  const paidOrders = activeOrders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() === "paid"
  );
  const unpaidOrders = activeOrders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() !== "paid"
  );
  const slaughteredOrders = activeQurbaniOrders.filter((o) => !!o.slaughtered);
  const deliveredOrders = activeOrders.filter((o) => !!o.delivered);
  const pendingOrders = activeQurbaniOrders.filter((o) => !o.slaughtered && !o.cancelled);
  const cancelledOrders = orders.filter((o) => !!o.cancelled);
  const totalCollected = paidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalOutstanding = unpaidOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
 const liveOrders = activeOrders.filter((o) => o.orderType === "live");

const totalLiveSheepOrdered = liveOrders.reduce(
  (sum, order) => sum + (order.liveQuantity || order.quantity || 0),
  0
);

const totalLiveValue = liveOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

const totalExpenses = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
const netCollectedAfterExpenses = totalCollected - totalExpenses;

const liveOutstandingValue = liveOrders
  .filter((o) => (o.paymentStatus || "pending").toLowerCase() !== "paid")
  .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  const sizeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    activeQurbaniOrders.forEach((order) => {
      (order.weightBreakdown || []).forEach((row) => {
        map.set(row.label, (map.get(row.label) || 0) + (row.quantity || 0));
      });
    });
    return settings.weightOptions.map((option) => ({
      label: option.label,
      value: map.get(option.label) || 0,
    }));
  }, [activeQurbaniOrders, settings.weightOptions]);

  const currentBulkReminderOrder = bulkReminderTargets[bulkReminderIndex] || null;

    
  function markDirty() {
    setHasUnsavedChanges(true);
    setSaveMessage("");
  }

  async function updateField(orderId: string, payload: Partial<OrderItem>) {
    try {
      setUpdatingField(orderId);
      await updateDoc(doc(db, "orders", orderId), { ...payload, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Update failed:", error);
      alert("Unable to update this booking right now.");
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

  async function saveSettings() {
    try {
      setSettingsSaving(true);
      await setDoc(
        doc(db, "settings", "qurbani"),
        { ...settings, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (error) {
      console.error("Settings save failed:", error);
      alert("Could not save settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveExpense() {
  if (!isOwner) return;

  const title = expenseForm.title.trim();
  const amount = Number(expenseForm.amount || 0);

  if (!title) {
    alert("Please enter an expense title.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid expense amount.");
    return;
  }

  try {
    setExpenseSaving(true);

    await setDoc(doc(collection(db, "expenses")), {
      title,
      amount,
      category: expenseForm.category,
      notes: expenseForm.notes.trim(),
      createdAt: serverTimestamp(),
      createdByRole: userRole || "",
    });

    setExpenseForm({
      title: "",
      amount: "",
      category: "other",
      notes: "",
    });

    setSaveMessage("Expense added successfully.");
    setTimeout(() => setSaveMessage(""), 3000);
  } catch (error) {
    console.error("Expense save failed:", error);
    alert("Could not save expense.");
  } finally {
    setExpenseSaving(false);
  }
}

  function openWhatsAppForOrder(order: OrderItem, message: string) {
    const phone = cleanPhoneForWhatsApp(order.phone);
    if (!phone) {
      alert("This customer does not have a valid phone number saved.");
      return;
    }
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleBulkPaymentReminders() {
    const targets = unpaidOrders
      .filter((order) => cleanPhoneForWhatsApp(order.phone))
      .sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, {
          sensitivity: "base",
        })
      );

    if (!targets.length) {
      alert("There are no unpaid customers with valid phone numbers.");
      return;
    }

    setBulkReminderTargets(targets);
    setBulkReminderIndex(0);
    setBulkReminderActive(true);
    setShowOutstandingPanel(false);
    setShowManualForm(false);
    setShowSettings(false);
  }

  function openCurrentBulkReminder() {
    if (!currentBulkReminderOrder) return;
    openWhatsAppForOrder(
      currentBulkReminderOrder,
      buildPaymentReminderMessage(currentBulkReminderOrder, settings)
    );
  }

  function goToNextBulkReminder() {
    if (bulkReminderIndex >= bulkReminderTargets.length - 1) {
      setBulkReminderActive(false);
      setBulkReminderTargets([]);
      setBulkReminderIndex(0);
      setSaveMessage("Bulk reminder queue completed.");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    setBulkReminderIndex((prev) => prev + 1);
  }

  function skipBulkReminder() {
    goToNextBulkReminder();
  }

  function stopBulkReminder() {
    setBulkReminderActive(false);
    setBulkReminderTargets([]);
    setBulkReminderIndex(0);
  }

    async function handleQuickToggle(
    order: OrderItem,
    field: "paymentStatus" | "slaughtered" | "sliced" | "delivered"
  ) {
    if (field === "paymentStatus") {
      const next =
        (order.paymentStatus || "pending").toLowerCase() === "paid" ? "pending" : "paid";
      await updateField(order.id, { paymentStatus: next as "pending" | "paid" });
      return;
    }

    if (field === "slaughtered") {
      if (order.orderType === "live") return;

      const next = !order.slaughtered;
      await updateField(order.id, {
        slaughtered: next,
        queueNumber: next ? null : order.queueNumber || null,
      });
      return;
    }

        if (field === "sliced") {
      if (order.orderType === "live") return;
      if (order.cancelled) return;

      const next = !order.sliced;
      await updateField(order.id, { sliced: next });
      return;
    }

    if (field === "delivered") {
      const next = !order.delivered;
      if (next) {
        const confirmed = window.confirm("Mark this booking as delivered?");
        if (!confirmed) return;
      }
      await updateField(order.id, { delivered: next });
    }
  }

  async function handleCheckIn(order: OrderItem) {
  if (order.orderType === "live") return;
  if (order.cancelled || order.delivered || order.slaughtered) return;
  if (order.queueNumber && order.queueNumber > 0) return;

  const assignedQueueNumber = nextQueueNumber;

  try {
    setUpdatingField(order.id);

    await updateDoc(doc(db, "orders", order.id), {
      queueNumber: assignedQueueNumber,
      queueCheckedInAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setSimpleSearch("");
    setSaveMessage(`Queue number #${assignedQueueNumber} assigned successfully.`);
    setTimeout(() => setSaveMessage(""), 3000);

    const hasValidPhone = !!cleanPhoneForWhatsApp(order.phone);
    if (!hasValidPhone) return;

    const shouldOpenWhatsApp = window.confirm(
      `Queue #${assignedQueueNumber} assigned to ${order.fullName || "this customer"}.\n\nOpen WhatsApp notification now?`
    );

    if (shouldOpenWhatsApp) {
      openWhatsAppForOrder(
        order,
        buildQueueAssignedMessage(order, assignedQueueNumber)
      );
    }
  } catch (error) {
    console.error("Queue assignment failed:", error);
    alert("Unable to assign the queue number right now.");
  } finally {
    setUpdatingField("");
  }
}

  function handleOpenBooking(order: OrderItem) {
    setMode("management");
    setShowOutstandingPanel(false);
    setShowManualForm(false);
    setShowSettings(false);
    setSelectedOrder(order);

    setTimeout(() => {
      selectedBookingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

 async function saveEditForm() {
  if (!selectedOrder || !editForm) return;

  if (!editForm.fullName.trim()) {
    alert("Please enter the customer name.");
    return;
  }
  if (!editForm.phone.trim()) {
    alert("Please enter the customer phone number.");
    return;
  }
  if (editForm.cancelled && !editForm.cancelReason.trim()) {
    alert("Please enter a cancellation reason.");
    return;
  }

  try {
    setSavingEdit(true);

    if (selectedOrder.orderType === "live") {
      const liveQuantity = Number(editForm.liveQuantity || 0);
      const livePricePerSheep = Number(editForm.livePricePerSheep || 0);
      const pricingVisible = !!editForm.pricingVisible;

      if (!Number.isInteger(liveQuantity) || liveQuantity <= 0) {
        alert("Please enter a valid live sheep quantity.");
        return;
      }

      if (pricingVisible && livePricePerSheep < 0) {
        alert("Please enter a valid price per sheep.");
        return;
      }

      const totalPrice = pricingVisible ? liveQuantity * livePricePerSheep : 0;

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        notes: editForm.notes.trim(),
        quantity: liveQuantity,
        liveQuantity,
        livePricePerSheep,
        pricingVisible,
        totalPrice,
        paymentStatus: editForm.paymentStatus,
        sliced: false,
        delivered: editForm.cancelled ? false : editForm.delivered,
        cancelled: editForm.cancelled,
        cancelReason: editForm.cancelled ? editForm.cancelReason.trim() : "",
        slaughtered: false,
        queueNumber: null,
        queueCheckedInAt: null,
        addServices: false,
        delivery: false,
        servicesPerSheep: 0,
        servicesTotal: 0,
        deliveryPerSheep: 0,
        deliveryTotal: 0,
        basePriceTotal: pricingVisible ? totalPrice : 0,
        preferredWeight: "",
        weightBreakdown: [],
        cutPreferences: [],
        updatedAt: serverTimestamp(),
      });

      if (editForm.cancelled) {
        if (window.confirm("Open WhatsApp cancellation notice for this customer?")) {
          openWhatsAppForOrder(
            selectedOrder,
            buildCancellationMessage(selectedOrder, editForm.cancelReason.trim())
          );
        }
      }

      setHasUnsavedChanges(false);
      setSelectedOrder(null);
      setSaveMessage("Saved successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    const weightBreakdown = computeBreakdownFromRows(editForm.weightRows, settings);

    if (!weightBreakdown.length) {
      alert("Please add at least one valid sheep selection.");
      return;
    }

    const quantity = weightBreakdown.reduce((sum, row) => sum + row.quantity, 0);
    const basePriceTotal = weightBreakdown.reduce((sum, row) => sum + row.subtotal, 0);
    const servicesPerSheep = editForm.addServices ? 400 : 0;
    const deliveryPerSheep = editForm.delivery ? 100 : 0;
    const servicesTotal = quantity * servicesPerSheep;
    const deliveryTotal = quantity * deliveryPerSheep;
    const totalPrice = basePriceTotal + servicesTotal + deliveryTotal;
    const cutPreferences = editForm.cutPreferences
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const nextWeightBreakdown = editForm.cancelled ? [] : weightBreakdown;

    await applyQurbaniStockTransaction({
      existingOrder: selectedOrder,
      nextWeightBreakdown,
      buildOrderPayload: () => ({
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        quantity: editForm.cancelled ? 0 : quantity,
        preferredWeight: editForm.cancelled
          ? ""
          : buildLegacyPreferredWeight(weightBreakdown),
        weightBreakdown: nextWeightBreakdown,
        cutPreferences: editForm.cancelled ? [] : cutPreferences,
        notes: editForm.notes.trim(),
        addServices: editForm.cancelled ? false : editForm.addServices,
        delivery: editForm.cancelled ? false : editForm.delivery,
        basePriceTotal: editForm.cancelled ? 0 : basePriceTotal,
        servicesPerSheep: editForm.cancelled ? 0 : servicesPerSheep,
        servicesTotal: editForm.cancelled ? 0 : servicesTotal,
        deliveryPerSheep: editForm.cancelled ? 0 : deliveryPerSheep,
        deliveryTotal: editForm.cancelled ? 0 : deliveryTotal,
        totalPrice: editForm.cancelled ? 0 : totalPrice,
        paymentStatus: editForm.paymentStatus,
        slaughtered: editForm.cancelled ? false : editForm.slaughtered,
        sliced: editForm.cancelled ? false : editForm.sliced,
        delivered: editForm.cancelled ? false : editForm.delivered,
        cancelled: editForm.cancelled,
        cancelReason: editForm.cancelled ? editForm.cancelReason.trim() : "",
      }),
    });

    if (editForm.cancelled) {
      if (window.confirm("Open WhatsApp cancellation notice for this customer?")) {
        openWhatsAppForOrder(
          selectedOrder,
          buildCancellationMessage(selectedOrder, editForm.cancelReason.trim())
        );
      }
    }

    setHasUnsavedChanges(false);
    setSelectedOrder(null);
    setSaveMessage("Saved successfully.");
    setTimeout(() => setSaveMessage(""), 3000);
  } catch (error) {
    console.error("Failed saving edit form:", error);
    alert(error instanceof Error ? error.message : "Could not save this booking.");
  } finally {
    setSavingEdit(false);
  }
}

  async function submitManualBooking(e: FormEvent) {
  e.preventDefault();

  if (!manualForm.fullName.trim()) {
    alert("Please enter the customer name.");
    return;
  }
  if (!manualForm.phone.trim()) {
    alert("Please enter the customer phone number.");
    return;
  }

  const weightBreakdown = computeBreakdownFromRows(manualForm.weightRows, settings);
  if (!weightBreakdown.length) {
    alert("Please add at least one valid sheep selection.");
    return;
  }

  const quantity = weightBreakdown.reduce((sum, row) => sum + row.quantity, 0);
  const basePriceTotal = weightBreakdown.reduce((sum, row) => sum + row.subtotal, 0);
  const servicesPerSheep = manualForm.addServices ? 400 : 0;
  const deliveryPerSheep = manualForm.delivery ? 100 : 0;
  const servicesTotal = quantity * servicesPerSheep;
  const deliveryTotal = quantity * deliveryPerSheep;
  const totalPrice = basePriceTotal + servicesTotal + deliveryTotal;
  const cutPreferences = manualForm.cutPreferences
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    setManualSaving(true);

    await applyQurbaniStockTransaction({
      existingOrder: null,
      nextWeightBreakdown: weightBreakdown,
      buildOrderPayload: () => ({
        fullName: manualForm.fullName.trim(),
        phone: manualForm.phone.trim(),
        email: manualForm.email.trim(),
        quantity,
        preferredWeight: buildLegacyPreferredWeight(weightBreakdown),
        weightBreakdown,
        cutPreferences,
        notes: manualForm.notes.trim(),
        addServices: manualForm.addServices,
        delivery: manualForm.delivery,
        basePriceTotal,
        servicesPerSheep,
        servicesTotal,
        deliveryPerSheep,
        deliveryTotal,
        totalPrice,
        paymentStatus: manualForm.paymentStatus,
        slaughtered: false,
        sliced: false,
        delivered: false,
        cancelled: false,
        cancelReason: "",
        queueNumber: null,
        manualEntry: true,
        bookingYear: new Date().getFullYear(),
        orderType: "qurbani",
      }),
    });

    setManualForm({
      fullName: "",
      phone: "",
      email: "",
      cutPreferences: "",
      notes: "",
      addServices: false,
      delivery: false,
      paymentStatus: "pending",
      weightRows: [{ id: slugId(), label: "", quantity: "1" }],
    });
    setShowManualForm(false);
    setSaveMessage("Manual booking added successfully.");
    setTimeout(() => setSaveMessage(""), 3000);
  } catch (error) {
    console.error("Manual booking failed:", error);
    alert(error instanceof Error ? error.message : "Could not add manual booking.");
  } finally {
    setManualSaving(false);
  }
}

  if (!authReady || !authorised) {
    return (
      <main className="min-h-screen bg-[#09070b] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-8 py-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-[#d8b67e]">Northside Qurbani</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Opening the day's register</h1>
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
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#f5efe6]/[0.06] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
      </div>

      <header className="mx-auto max-w-7xl px-4 pb-0 pt-5 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-[56px] w-[56px] flex-shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 shadow-[0_14px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:h-[72px] sm:w-[72px] sm:rounded-[22px]">
              <Image
                src="/logo4.png"
                alt="Northside Qurbani"
                width={48}
                height={48}
                className="object-contain sm:w-[60px]"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
                Northside Qurbani
              </div>
              <div className="mt-0.5 text-sm text-white/55">Farm register</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#f5efe6] px-4 text-sm font-medium text-[#161015] transition hover:bg-[#e8dfd3]"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`flex h-11 items-center justify-center rounded-full text-sm font-medium transition ${
              mode === "simple"
                ? "bg-[#c6a268] text-[#161015]"
                : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            Simple Operations
          </button>
          <button
            type="button"
            onClick={() => setMode("management")}
            className={`flex h-11 items-center justify-center rounded-full text-sm font-medium transition ${
              mode === "management"
                ? "bg-[#c6a268] text-[#161015]"
                : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            Management
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-10 lg:pb-24">
        <div className="text-center xl:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[#d8b67e] backdrop-blur-xl">
            Northside Qurbani
          </div>
          <h1 className="mt-4 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2rem] font-semibold leading-[1.08] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
            {mode === "simple" ? "Qurbani Day Operations" : "Qurbani Management Dashboard"}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-[0.95rem] leading-7 text-white/62 sm:text-[1.04rem] sm:leading-8 xl:mx-0">
            {mode === "simple"
              ? "When a customer arrives at the farm, search for the qurbani booking and place them into the queue. Live sheep bookings stay out of this flow."
              : "Owner control for bookings, live sheep pricing, payments, settings, reminders, manual bookings, and full booking edits."}
          </p>
        </div>

        {mode === "simple" ? (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryCard label="Pending" value={String(pendingOrders.length)} />
              <SummaryCard
                label="In Queue"
                value={String(queueOrders.length)}
                helper={`Next #${nextQueueNumber}`}
              />
              <SummaryCard label="Slaughtered" value={String(slaughteredOrders.length)} />
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Add Customer To Queue</h3>
                <p className="mt-1 text-sm text-white/55">
                  Search qurbani customers below and place them into the queue in order of arrival.
                  Live sheep orders do not appear here.
                </p>
              </div>

              <label className="mb-3 block text-sm font-medium text-white/82">Search customer</label>

              <input
                type="text"
                value={simpleSearch}
                onChange={(e) => setSimpleSearch(e.target.value)}
                placeholder="Name, phone, email, or booking reference"
                className="h-14 w-full rounded-[20px] border border-white/10 bg-white/[0.05] px-5 text-base text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
              />

              {simpleSearch.trim() ? (
                <div className="mt-5 space-y-3">
                  {simpleSearchResults.length === 0 ? (
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                      No matching booking found.
                    </div>
                  ) : (
                    simpleSearchResults.map((order) => {
                      const alreadyInQueue = !!(order.queueNumber && order.queueNumber > 0);

                      return (
                        <div
                          key={order.id}
                          className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-white">
                              {order.fullName || "Unnamed booking"}
                            </div>
                            <PaymentBadge value={order.paymentStatus} />
                            <WorkflowBadge order={order} />
                          </div>

                          <div className="mt-2 text-sm text-white/55">
                            {orderReference(order.id)} • {order.phone || "No phone"}
                          </div>

                          <div className="mt-1 text-sm text-[#d8b67e]">
  {sheepSummary(order)}
  {order.orderType === "live" &&
  order.pricingVisible !== false &&
  (order.livePricePerSheep || 0) > 0
    ? ` • ${formatZAR(order.livePricePerSheep)} each`
    : ""}
</div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {alreadyInQueue ? (
                              <div className="inline-flex items-center rounded-full border border-[#c6a268]/30 bg-[#c6a268]/15 px-4 py-2 text-sm font-medium text-[#f3dfb8]">
                                Already in queue as #{order.queueNumber}
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={updatingField === order.id || !!order.cancelled || !!order.slaughtered}
                                onClick={() => handleCheckIn(order)}
                                className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {updatingField === order.id
                                ? "Assigning Queue Number..."
                                : `Put Customer Next In Queue (#${nextQueueNumber})`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/45">
                  Start typing the customer name, phone number, email, or booking reference to place
                  them into the slaughter queue.
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Slaughter Queue</h3>
                  <p className="mt-1 text-sm text-white/55">
                    In order of arrival. Live sheep orders stay out of this queue.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                  Next: #{nextQueueNumber}
                </div>
              </div>

              <div className="space-y-3">
                {queueOrders.length === 0 ? (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                    No customers in the queue yet. Search a customer above to check them in.
                  </div>
                ) : (
                  queueOrders.map((order, index) => (
                    <div
                      key={order.id}
                      className={`rounded-[22px] border p-4 transition ${
                        index === 0
                          ? "border-[#c6a268]/40 bg-[#c6a268]/[0.08]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-8 min-w-[48px] items-center justify-center rounded-full bg-[#c6a268] px-3 text-sm font-semibold text-[#161015]">
                            #{order.queueNumber}
                          </span>
                          <span className="text-base font-semibold text-white">
                            {order.fullName || "Unnamed"}
                          </span>
                          <PaymentBadge value={order.paymentStatus} />
                        </div>
                        {isOwner ? (
  <span className="text-sm font-semibold text-[#d8b67e]">
    {bookingAmountLabel(order)}
  </span>
) : null}
                      </div>

                      {index === 0 && (
                        <div className="mt-3 inline-flex rounded-full border border-[#c6a268]/30 bg-[#c6a268]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3dfb8]">
                          Next Customer
                        </div>
                      )}

                      <div className="mt-2 text-sm text-white/55">
                        {order.phone || "No phone"} • {sheepSummary(order)}
                      </div>

                      {order.cutPreferences && order.cutPreferences.length > 0 && (
                        <div className="mt-1 text-xs text-white/40">
                          Cuts: {order.cutPreferences.join(", ")}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingField === order.id}
                          onClick={() => handleQuickToggle(order, "paymentStatus")}
                          className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                            (order.paymentStatus || "pending").toLowerCase() === "paid"
                              ? "bg-[#c6a268] text-[#161015]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {(order.paymentStatus || "pending").toLowerCase() === "paid"
                            ? "Paid"
                            : "Mark Paid"}
                        </button>

                        <button
                          type="button"
                          disabled={updatingField === order.id || !!order.cancelled}
                          onClick={() => handleQuickToggle(order, "slaughtered")}
                          className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                            order.slaughtered
                              ? "bg-[#c6a268] text-[#161015]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {order.slaughtered ? "Slaughtered" : "Mark Slaughtered"}
                        </button>

                        {order.orderType !== "live" && (
  <button
    type="button"
    disabled={updatingField === order.id || !!order.cancelled}
    onClick={() => handleQuickToggle(order, "sliced")}
    className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
      order.sliced
        ? "bg-[#c6a268] text-[#161015]"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {order.sliced ? "Sliced" : "Mark Sliced"}
  </button>
)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <div className={`grid gap-4 sm:grid-cols-2 ${isOwner ? "xl:grid-cols-10" : "xl:grid-cols-3"}`}>
  <SummaryCard
    label="Total Bookings"
    value={String(activeOrders.length)}
    helper={`${cancelledOrders.length} cancelled`}
  />

  {isOwner && (
    <SummaryCard
      label="Collected"
      value={formatZAR(totalCollected)}
      helper={`${paidOrders.length} paid`}
    />
  )}

  {isOwner && (
    <SummaryCard
      label="Live Sheep Value"
      value={formatZAR(totalLiveValue)}
      helper="All live sheep totals"
    />
  )}

  {isOwner && (
    <SummaryCard
      label="Live Unpaid"
      value={formatZAR(liveOutstandingValue)}
      helper="Outstanding live sheep"
    />
  )}

  {isOwner && (
    <SummaryCard
      label="Outstanding"
      value={formatZAR(totalOutstanding)}
      helper={`${unpaidOrders.length} unpaid`}
    />
  )}

  {isOwner && (
  <SummaryCard
    label="Expenses"
    value={formatZAR(totalExpenses)}
    helper={`${expenses.length} logged`}
  />
)}

{isOwner && (
  <SummaryCard
    label="Net After Expenses"
    value={formatZAR(netCollectedAfterExpenses)}
    helper="Collected minus expenses"
  />
)}

  <SummaryCard
    label="Slaughtered"
    value={String(slaughteredOrders.length)}
    helper={`${deliveredOrders.length} delivered`}
  />

  <SummaryCard
  label="Awaiting Delivery"
  value={String(
    activeQurbaniOrders.filter(
      (o) => !o.cancelled && !!o.slaughtered && !o.delivered
    ).length
  )}
  helper="Slaughtered, not delivered"
/>

  <SummaryCard
    label="Live Sheep Ordered"
    value={String(totalLiveSheepOrdered)}
    helper={`${liveOrders.length} live bookings`}
  />
</div>
            <div className="grid gap-4 md:grid-cols-1">
              <MiniBarChart title="Booked Sheep By Size" data={sizeBreakdown} />
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
              <div className="flex flex-wrap gap-3">
  <button
    type="button"
    onClick={() => {
      setShowManualForm((prev) => !prev);
      if (showSettings) setShowSettings(false);
    }}
    className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
      showManualForm
        ? "bg-[#c6a268] text-[#161015]"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {showManualForm ? "Hide Manual Booking" : "Add Manual Booking"}
  </button>

  {isOwner && (
    <button
      type="button"
      onClick={() => setShowOutstandingPanel((prev) => !prev)}
      className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
        showOutstandingPanel
          ? "bg-[#c6a268] text-[#161015]"
          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      {showOutstandingPanel ? "Hide Outstanding Payments" : "Outstanding Payments"}
    </button>
  )}

  {isOwner && (
  <button
    type="button"
    onClick={() => setShowExpensesPanel((prev) => !prev)}
    className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
      showExpensesPanel
        ? "bg-[#c6a268] text-[#161015]"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {showExpensesPanel ? "Hide Expenses" : "Expenses"}
  </button>
)}

  <button
    type="button"
    onClick={() => {
      setShowSettings((prev) => !prev);
      if (showManualForm) setShowManualForm(false);
    }}
    className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
      showSettings
        ? "bg-[#c6a268] text-[#161015]"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {showSettings ? "Hide Settings" : "Settings"}
  </button>

  {isOwner && (
    <button
      type="button"
      onClick={handleBulkPaymentReminders}
      className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
    >
      Start Bulk Reminder Queue
    </button>
  )}
</div>

              {saveMessage ? (
                <div className="mt-4 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  {saveMessage}
                </div>
              ) : null}

              {isOwner && bulkReminderActive && currentBulkReminderOrder ? (
                <div className="mt-6 rounded-[28px] border border-[#c6a268]/25 bg-[#c6a268]/[0.06] p-5">
                  <h3 className="text-lg font-semibold text-white">Bulk Reminder Queue</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Open each unpaid customer one by one, send the message, then continue to the next.
                  </p>

                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm text-white/45">
                      Customer {bulkReminderIndex + 1} of {bulkReminderTargets.length}
                    </div>

                    <div className="mt-2 text-lg font-semibold text-white">
                      {currentBulkReminderOrder.fullName || "Unnamed booking"}
                    </div>

                    <div className="mt-1 text-sm text-white/55">
                      {orderReference(currentBulkReminderOrder.id)} •{" "}
                      {currentBulkReminderOrder.phone || "No phone"}
                    </div>

                    <div className="mt-1 text-sm text-[#d8b67e]">
                      {sheepSummary(currentBulkReminderOrder)}
                    </div>

                    <div className="mt-1 text-sm font-medium text-white">
                      {bookingAmountLabel(currentBulkReminderOrder)}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={openCurrentBulkReminder}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-[#c6a268] px-5 text-sm font-semibold text-[#161015] transition hover:brightness-105"
                      >
                        Open WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={goToNextBulkReminder}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        Next Customer
                      </button>

                      <button
                        type="button"
                        onClick={skipBulkReminder}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        Skip
                      </button>

                      <button
                        type="button"
                        onClick={stopBulkReminder}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/10 px-5 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"
                      >
                        End Bulk Session
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_auto_auto_auto] xl:items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/82">Search</label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, phone, email, reference, or sheep size"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-[#c6a268]/60 focus:bg-white/[0.07]"
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Payment</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton
                      active={paymentFilter === "all"}
                      label="All"
                      onClick={() => setPaymentFilter("all")}
                    />
                    <FilterButton
                      active={paymentFilter === "unpaid"}
                      label="Unpaid"
                      onClick={() => setPaymentFilter("unpaid")}
                    />
                    <FilterButton
                      active={paymentFilter === "paid"}
                      label="Paid"
                      onClick={() => setPaymentFilter("paid")}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Type</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton
                      active={orderTypeFilter === "all"}
                      label="All"
                      onClick={() => setOrderTypeFilter("all")}
                    />
                    <FilterButton
                      active={orderTypeFilter === "qurbani"}
                      label="Qurbani"
                      onClick={() => setOrderTypeFilter("qurbani")}
                    />
                    <FilterButton
                      active={orderTypeFilter === "live"}
                      label="Live Sheep"
                      onClick={() => setOrderTypeFilter("live")}
                    />
                  </div>
                </div>

                
                <div>
                  <div className="mb-2 text-sm font-medium text-white/82">Status</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton
                      active={workflowFilter === "all"}
                      label="All"
                      onClick={() => setWorkflowFilter("all")}
                    />
                    <FilterButton
                      active={workflowFilter === "pending"}
                      label="Pending"
                      onClick={() => setWorkflowFilter("pending")}
                    />
                    <FilterButton
  active={workflowFilter === "slaughtered"}
  label="Slaughtered"
  onClick={() => setWorkflowFilter("slaughtered")}
/>
<FilterButton
  active={workflowFilter === "sliced"}
  label="Sliced"
  onClick={() => setWorkflowFilter("sliced")}
/>
<FilterButton
  active={workflowFilter === "awaiting_delivery"}
  label="Awaiting Delivery"
  onClick={() => setWorkflowFilter("awaiting_delivery")}
/>
<FilterButton
  active={workflowFilter === "delivered"}
  label="Delivered"
  onClick={() => setWorkflowFilter("delivered")}
/>
                    <FilterButton
                      active={workflowFilter === "cancelled"}
                      label="Cancelled"
                      onClick={() => setWorkflowFilter("cancelled")}
                    />
                  </div>
                </div>
              </div>

              {showManualForm ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Add Manual Booking</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Add a qurbani booking directly for a customer without using the order page.
                  </p>

                  <form onSubmit={submitManualBooking} className="mt-5 grid gap-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      {[["Full name", "fullName"], ["Phone number", "phone"], ["Email", "email"]].map(
                        ([label, key]) => (
                          <div key={key}>
                            <label className="mb-2 block text-sm font-medium text-white/82">{label}</label>
                            <input
                              value={(manualForm as any)[key]}
                              onChange={(e) =>
                                setManualForm((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                            />
                          </div>
                        )
                      )}
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">Sheep selections</p>
                          <p className="text-sm text-white/55">Mix multiple sizes in one booking.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setManualForm((prev) => ({
                              ...prev,
                              weightRows: [...prev.weightRows, { id: slugId(), label: "", quantity: "1" }],
                            }))
                          }
                          className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          Add Row
                        </button>
                      </div>

                      <div className="space-y-3">
                        {manualForm.weightRows.map((row) => (
                          <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                            <select
                              value={row.label}
                              onChange={(e) =>
                                setManualForm((prev) => ({
                                  ...prev,
                                  weightRows: prev.weightRows.map((item) =>
                                    item.id === row.id ? { ...item, label: e.target.value } : item
                                  ),
                                }))
                              }
                              className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                            >
                              <option value="" className="text-black">
                                Select size
                              </option>
                              {settings.weightOptions.map((option) => (
                                <option key={option.label} value={option.label} className="text-black">
                                  {option.label} — {formatZAR(option.price)}
{typeof option.stock === "number" ? ` — ${option.stock} left` : ""}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                setManualForm((prev) => ({
                                  ...prev,
                                  weightRows: prev.weightRows.map((item) =>
                                    item.id === row.id ? { ...item, quantity: e.target.value } : item
                                  ),
                                }))
                              }
                              className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setManualForm((prev) => ({
                                  ...prev,
                                  weightRows:
                                    prev.weightRows.length === 1
                                      ? prev.weightRows
                                      : prev.weightRows.filter((item) => item.id !== row.id),
                                }))
                              }
                              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">Notes</label>
                        <textarea
                          rows={4}
                          value={manualForm.notes}
                          onChange={(e) =>
                            setManualForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: "addServices", onLabel: "Services Added", offLabel: "Services Off" },
                        { key: "delivery", onLabel: "Delivery Added", offLabel: "Delivery Off" },
                      ].map(({ key, onLabel, offLabel }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setManualForm((prev) => ({ ...prev, [key]: !(prev as any)[key] }))
                          }
                          className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                            (manualForm as any)[key]
                              ? "bg-[#c6a268] text-[#161015]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {(manualForm as any)[key] ? onLabel : offLabel}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          setManualForm((prev) => ({
                            ...prev,
                            paymentStatus: prev.paymentStatus === "paid" ? "pending" : "paid",
                          }))
                        }
                        className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                          manualForm.paymentStatus === "paid"
                            ? "bg-[#c6a268] text-[#161015]"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        {manualForm.paymentStatus === "paid" ? "Marked Paid" : "Marked Unpaid"}
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={manualSaving}
                        className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {manualSaving ? "Saving..." : "Save Manual Booking"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualForm(false)}
                        className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {showSettings ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Settings</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Banking details, booking dates, and yearly sheep prices.
                  </p>

                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
  <div className="mb-4">
    <p className="font-medium text-white">Sheep Prices & Stock</p>
    <p className="text-sm text-white/55">
      Set prices AND stock. Leave stock empty = unlimited.
    </p>
  </div>

  <div className="space-y-3">
    {settings.weightOptions.map((option, index) => (
      <div key={`${option.label}-${index}`} className="grid gap-3 md:grid-cols-[1fr_150px_150px]">

        {/* LABEL */}
        <input
          value={option.label}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              weightOptions: prev.weightOptions.map((item, i) =>
                i === index ? { ...item, label: e.target.value } : item
              ),
            }))
          }
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          placeholder="Weight label"
        />

        {/* PRICE */}
        <input
          type="number"
          min={0}
          value={option.price}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              weightOptions: prev.weightOptions.map((item, i) =>
                i === index ? { ...item, price: Number(e.target.value || 0) } : item
              ),
            }))
          }
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          placeholder="Price"
        />

        {/* STOCK */}
        <input
          type="number"
          min={0}
          value={option.stock ?? ""}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              weightOptions: prev.weightOptions.map((item, i) =>
                i === index
                  ? {
                      ...item,
                      stock:
                        e.target.value.trim() === ""
                          ? null
                          : Number(e.target.value),
                    }
                  : item
              ),
            }))
          }
          className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          placeholder="Stock"
        />
      </div>
    ))}
  </div>
</div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={saveSettings}
                      disabled={settingsSaving}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {settingsSaving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </div>
              ) : null}

              {isOwner && showOutstandingPanel ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Outstanding Payments</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Quick follow-up list of unpaid customers.
                  </p>

                  <div className="mt-5 space-y-3">
                    {unpaidOrders.length === 0 ? (
                      <div className="text-sm text-white/55">No unpaid customers right now.</div>
                    ) : (
                      unpaidOrders.slice(0, 10).map((order) => (
                        <div
                          key={order.id}
                          className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
  <div className="font-medium text-white">{order.fullName}</div>
  {order.orderType === "live" && (
    <span className="inline-flex rounded-full border border-[#c6a268]/30 bg-[#c6a268]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3dfb8]">
      Live Sheep
    </span>
  )}
</div>
                              <div className="mt-1 text-sm text-white/55">{order.phone}</div>
                            </div>
                            <div className="text-sm font-semibold text-[#d8b67e]">
  {isOwner ? bookingAmountLabel(order) : ""}
</div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openWhatsAppForOrder(order, buildPaymentReminderMessage(order, settings))
                              }
                              className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                            >
                              Remind
                            </button>
                            <button
  type="button"
  onClick={() => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      setHasUnsavedChanges(false);
      setSaveMessage("");
    } else {
      handleOpenBooking(order);
    }
  }}
  className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
>
  {selectedOrder?.id === order.id ? "Close" : "Open"}
</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              {isOwner && showExpensesPanel ? (
  <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-5">
    <h3 className="text-lg font-semibold text-white">Expenses</h3>
    <p className="mt-1 text-sm text-white/55">
      Track farm costs like skinners, workers, trailer hire, and any other operational expenses.
    </p>

    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Total Expenses" value={formatZAR(totalExpenses)} />
      <SummaryCard label="Collected" value={formatZAR(totalCollected)} />
      <SummaryCard label="Outstanding" value={formatZAR(totalOutstanding)} />
      <SummaryCard label="Net After Expenses" value={formatZAR(netCollectedAfterExpenses)} />
    </div>

    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-base font-semibold text-white">Add Expense</h4>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/82">Title</label>
          <input
            value={expenseForm.title}
            onChange={(e) =>
              setExpenseForm((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g. Skinners"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/82">Amount</label>
          <input
            type="number"
            min={0}
            value={expenseForm.amount}
            onChange={(e) =>
              setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="Enter amount"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/82">Category</label>
          <select
            value={expenseForm.category}
            onChange={(e) =>
              setExpenseForm((prev) => ({
                ...prev,
                category: e.target.value as "skinners" | "workers" | "trailer" | "other",
              }))
            }
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
          >
            <option value="skinners" className="text-black">Skinners</option>
            <option value="workers" className="text-black">Workers</option>
            <option value="trailer" className="text-black">Trailer</option>
            <option value="other" className="text-black">Other</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={saveExpense}
            disabled={expenseSaving}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:opacity-60"
          >
            {expenseSaving ? "Saving..." : "Save Expense"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-white/82">Notes</label>
        <textarea
          rows={3}
          value={expenseForm.notes}
          onChange={(e) =>
            setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Optional notes"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
        />
      </div>
    </div>

    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-base font-semibold text-white">Recent Expenses</h4>

      <div className="mt-4 space-y-3">
        {loadingExpenses ? (
          <div className="text-sm text-white/55">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="text-sm text-white/55">No expenses logged yet.</div>
        ) : (
          expenses.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{item.title || "Untitled expense"}</div>
                  <div className="mt-1 text-sm text-white/55">
                    {(item.category || "other").toUpperCase()} • {formatDate(item.createdAt)}
                  </div>
                  {item.notes ? (
                    <div className="mt-2 text-sm text-white/60">{item.notes}</div>
                  ) : null}
                </div>

                <div className="text-sm font-semibold text-[#d8b67e]">
                  {formatZAR(item.amount || 0)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
) : null}
            </div>



            <div className="grid gap-8 xl:grid-cols-12 xl:gap-8">
              <div className="xl:col-span-7">
                <SectionCard
                  title="Bookings"
                  sub="Find the booking, open it, and manage it from one clear editor."
                >
                  <div className="space-y-4">
                    {loadingOrders ? (
                      <div className="text-sm text-white/60">Loading bookings...</div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="text-sm text-white/60">
                        No bookings found for the current filter.
                      </div>
                    ) : (
                      filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className={`rounded-[24px] border p-4 transition ${
                            selectedOrder?.id === order.id
                              ? "border-[#c6a268]/30 bg-[#c6a268]/[0.08]"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
  <div className="text-base font-semibold text-white">
    {order.fullName || "Unnamed booking"}
  </div>
  <PaymentBadge value={order.paymentStatus} />
  <WorkflowBadge order={order} />
  {order.orderType !== "live" && order.sliced ? (
    <span className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200">
      Sliced
    </span>
  ) : null}
  {order.orderType === "live" && (
    <span className="inline-flex rounded-full border border-[#c6a268]/30 bg-[#c6a268]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3dfb8]">
      Live Sheep
    </span>
  )}
                                {order.manualEntry && (
                                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                                    Manual
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-sm text-white/55">
                                {orderReference(order.id)} • {order.phone || "No phone"}
                              </div>

                              <div className="mt-1 text-sm text-[#d8b67e]">
  {sheepSummary(order)}
  {order.orderType === "live" && order.pricingVisible !== false && (order.livePricePerSheep || 0) > 0
    ? ` • ${formatZAR(order.livePricePerSheep)} each`
    : ""}
</div>

                              {isOwner ? (
  <div className="mt-2 text-sm font-medium text-white">
    {bookingAmountLabel(order)}
  </div>
) : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={updatingField === order.id}
                                onClick={() => handleQuickToggle(order, "paymentStatus")}
                                className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                                  (order.paymentStatus || "pending").toLowerCase() === "paid"
                                    ? "bg-[#c6a268] text-[#161015]"
                                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                }`}
                              >
                                {(order.paymentStatus || "pending").toLowerCase() === "paid"
                                  ? "Paid"
                                  : "Mark Paid"}
                              </button>

                              {order.orderType !== "live" && (
                                <button
                                  type="button"
                                  disabled={updatingField === order.id || !!order.cancelled}
                                  onClick={() => handleQuickToggle(order, "slaughtered")}
                                  className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                                    order.slaughtered
                                      ? "bg-[#c6a268] text-[#161015]"
                                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                  }`}
                                >
                                  {order.slaughtered ? "Slaughtered" : "Mark Slaughtered"}
                                </button>

                                
                              )}

                              {order.orderType !== "live" && (
  <button
    type="button"
    disabled={updatingField === order.id || !!order.cancelled}
    onClick={() => handleQuickToggle(order, "sliced")}
    className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
      order.sliced
        ? "bg-[#c6a268] text-[#161015]"
        : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {order.sliced ? "Sliced" : "Mark Sliced"}
  </button>
)}

            
                              

                              <button
                                type="button"
                                disabled={updatingField === order.id || !!order.cancelled}
                                onClick={() => handleQuickToggle(order, "delivered")}
                                className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
                                  order.delivered
                                    ? "bg-[#c6a268] text-[#161015]"
                                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                }`}
                              >
                                {order.delivered ? "Delivered" : "Mark Delivered"}
                              </button>

                             <button
  type="button"
  onClick={() => {
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
      setHasUnsavedChanges(false);
      setSaveMessage("");
    } else {
      handleOpenBooking(order);
    }
  }}
  className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
>
  {selectedOrder?.id === order.id ? "Close" : "Open"}
</button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SectionCard>
              </div>

              <div className="xl:col-span-5">
                <div ref={selectedBookingRef} className="xl:sticky xl:top-6">
                  <SectionCard
                    title="Currently Editing"
                    sub={
                      selectedOrder
                        ? `${selectedOrder.fullName || "Booking"} • ${orderReference(selectedOrder.id)}`
                        : "Choose any booking from the list to open it here."
                    }
                    highlight={!!selectedOrder}
                  >
                    {!selectedOrder || !editForm ? (
                      <div className="text-sm text-white/55">No booking selected yet.</div>
                    ) : selectedOrder.orderType === "live" ? (
                      <div className="space-y-5">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                          <DetailRow label="Reference" value={orderReference(selectedOrder.id)} strong />
                          <DetailRow label="Created" value={formatDate(selectedOrder.createdAt)} />
                          <DetailRow
                            label="Booking Type"
                            value="Live Sheep Booking"
                          />
                          <DetailRow
                            label="Live Sheep Quantity"
                            value={`${selectedOrder.liveQuantity || selectedOrder.quantity || 0} sheep`}
                          />
                          {isOwner ? (
  <DetailRow
    label="Total"
    value={
      editForm.pricingVisible
        ? formatZAR(getLiveCalculatedTotal(editForm))
        : "To be confirmed"
    }
  />
) : null}
{(!editForm.pricingVisible || Number(editForm.livePricePerSheep || 0) <= 0) && (
    <div className="rounded-[20px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      This live sheep booking is still awaiting admin pricing.
    </div>
  )}
                          <DetailRow label="Current Status" value={statusLabel(selectedOrder)} />
                          <DetailRow label="Queue" value="Not used for live sheep" />
                        </div>

                        {hasUnsavedChanges ? (
                          <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
                            Unsaved changes
                          </div>
                        ) : null}

                        <div className="space-y-4">
                          {[["Full name", "fullName"], ["Phone", "phone"], ["Email", "email"]].map(
                            ([label, key]) => (
                              <div key={key}>
                                <label className="mb-2 block text-sm font-medium text-white/82">
                                  {label}
                                </label>
                                <input
                                  value={(editForm as any)[key]}
                                  onChange={(e) => {
                                    markDirty();
                                    setEditForm((prev) =>
                                      prev ? { ...prev, [key]: e.target.value } : prev
                                    );
                                  }}
                                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                                />
                              </div>
                            )
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-white/82">
                                Live sheep quantity
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={editForm.liveQuantity}
                                onChange={(e) => {
                                  markDirty();
                                  setEditForm((prev) =>
                                    prev ? { ...prev, liveQuantity: e.target.value } : prev
                                  );
                                }}
                                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-white/82">
                                Price per sheep
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={editForm.livePricePerSheep}
                                onChange={(e) => {
                                  markDirty();
                                  setEditForm((prev) =>
                                    prev ? { ...prev, livePricePerSheep: e.target.value } : prev
                                  );
                                }}
                                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                              />
                            </div>
                            {isOwner ? (
  <div className="mt-2 text-2xl font-semibold text-white">
    {editForm.pricingVisible
      ? formatZAR(getLiveCalculatedTotal(editForm))
      : "To be confirmed"}
  </div>
) : null}
                          </div>

                          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">Live pricing</p>
                                <p className="text-sm text-white/55">
                                  Admin controls the price for live sheep bookings here.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  markDirty();
                                  setEditForm((prev) =>
                                    prev ? { ...prev, pricingVisible: !prev.pricingVisible } : prev
                                  );
                                }}
                                className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                  editForm.pricingVisible
                                    ? "bg-[#c6a268] text-[#161015]"
                                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                }`}
                              >
                                {editForm.pricingVisible ? "Pricing Visible" : "Pricing Hidden"}
                              </button>
                            </div>

                            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/10 p-4">
                              <div className="text-sm text-white/55">Calculated total</div>
                              <div className="mt-2 text-2xl font-semibold text-white">
  {editForm.pricingVisible ? formatZAR(getLiveCalculatedTotal(editForm)) : "To be confirmed"}
</div>
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/82">
                              Notes
                            </label>
                            <textarea
                              rows={3}
                              value={editForm.notes}
                              onChange={(e) => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : prev
                                );
                              }}
                              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        paymentStatus:
                                          prev.paymentStatus === "paid" ? "pending" : "paid",
                                      }
                                    : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.paymentStatus === "paid"
                                  ? "bg-[#c6a268] text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.paymentStatus === "paid" ? "Marked Paid" : "Marked Unpaid"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, delivered: !prev.delivered } : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.delivered
                                  ? "bg-[#c6a268] text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.delivered ? "Delivered" : "Awaiting Collection"}
                            </button>
                          </div>

                          <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4">
                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, cancelled: !prev.cancelled } : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.cancelled
                                  ? "bg-rose-300 text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.cancelled ? "Booking Cancelled" : "Cancel Booking"}
                            </button>

                            {editForm.cancelled ? (
                              <div className="mt-4">
                                <label className="mb-2 block text-sm font-medium text-white/90">
                                  Cancellation reason
                                </label>
                                <textarea
                                  rows={3}
                                  value={editForm.cancelReason}
                                  onChange={(e) => {
                                    markDirty();
                                    setEditForm((prev) =>
                                      prev ? { ...prev, cancelReason: e.target.value } : prev
                                    );
                                  }}
                                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                                />
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={saveEditForm}
                              className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:opacity-60"
                            >
                              {savingEdit ? "Saving..." : "Save Live Booking Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openWhatsAppForOrder(
                                  selectedOrder,
                                  buildPaymentReminderMessage(selectedOrder, settings)
                                )
                              }
                              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                              WhatsApp Reminder
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                          <DetailRow label="Reference" value={orderReference(selectedOrder.id)} strong />
                          <DetailRow label="Created" value={formatDate(selectedOrder.createdAt)} />
                          <DetailRow label="Booking" value={sheepSummary(selectedOrder)} />
                          {isOwner ? (
  <DetailRow
    label="Total"
    value={formatZAR(selectedOrder.totalPrice || 0)}
  />
) : null}
                          <DetailRow
  label="Current Status"
  value={
    statusLabel(selectedOrder) === "Delivered"
      ? "Collected"
      : statusLabel(selectedOrder)
  }
/>
                          <DetailRow
                            label="Queue"
                            value={
                              (selectedOrder.queueNumber || 0) > 0
                                ? `In queue as #${selectedOrder.queueNumber}`
                                : "Not in live queue"
                            }
                          />
                        </div>

                        {hasUnsavedChanges ? (
                          <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
                            Unsaved changes
                          </div>
                        ) : null}

                        <div className="space-y-4">
                          {[["Full name", "fullName"], ["Phone", "phone"], ["Email", "email"]].map(
                            ([label, key]) => (
                              <div key={key}>
                                <label className="mb-2 block text-sm font-medium text-white/82">
                                  {label}
                                </label>
                                <input
                                  value={(editForm as any)[key]}
                                  onChange={(e) => {
                                    markDirty();
                                    setEditForm((prev) =>
                                      prev ? { ...prev, [key]: e.target.value } : prev
                                    );
                                  }}
                                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                                />
                              </div>
                            )
                          )}

                          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-white">Edit sheep selections</p>
                                <p className="text-sm text-white/55">
                                  Correct kg categories and quantities here.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  markDirty();
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          weightRows: [
                                            ...prev.weightRows,
                                            { id: slugId(), label: "", quantity: "1" },
                                          ],
                                        }
                                      : prev
                                  );
                                }}
                                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                              >
                                Add Row
                              </button>
                            </div>

                            <div className="space-y-3">
                              {editForm.weightRows.map((row) => (
                                <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                                  <select
                                    value={row.label}
                                    onChange={(e) => {
                                      markDirty();
                                      setEditForm((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              weightRows: prev.weightRows.map((item) =>
                                                item.id === row.id
                                                  ? { ...item, label: e.target.value }
                                                  : item
                                              ),
                                            }
                                          : prev
                                      );
                                    }}
                                    className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                                  >
                                    <option value="" className="text-black">
                                      Select size
                                    </option>
                                    {settings.weightOptions.map((option) => (
                                      <option
                                        key={option.label}
                                        value={option.label}
                                        className="text-black"
                                      >
                                        {option.label} — {formatZAR(option.price)}
{typeof option.stock === "number" ? ` — ${option.stock} left` : ""}
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    type="number"
                                    min={1}
                                    value={row.quantity}
                                    onChange={(e) => {
                                      markDirty();
                                      setEditForm((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              weightRows: prev.weightRows.map((item) =>
                                                item.id === row.id
                                                  ? { ...item, quantity: e.target.value }
                                                  : item
                                              ),
                                            }
                                          : prev
                                      );
                                    }}
                                    className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      markDirty();
                                      setEditForm((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              weightRows:
                                                prev.weightRows.length === 1
                                                  ? prev.weightRows
                                                  : prev.weightRows.filter(
                                                      (item) => item.id !== row.id
                                                    ),
                                            }
                                          : prev
                                      );
                                    }}
                                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/82">
                              Notes
                            </label>
                            <textarea
                              rows={3}
                              value={editForm.notes}
                              onChange={(e) => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : prev
                                );
                              }}
                              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {[
                              { key: "addServices", on: "Services Added", off: "Services Off" },
                              { key: "delivery", on: "Delivery Added", off: "Delivery Off" },
                            ].map(({ key, on, off }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  markDirty();
                                  setEditForm((prev) =>
                                    prev ? { ...prev, [key]: !(prev as any)[key] } : prev
                                  );
                                }}
                                className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                  (editForm as any)[key]
                                    ? "bg-[#c6a268] text-[#161015]"
                                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                }`}
                              >
                                {(editForm as any)[key] ? on : off}
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        paymentStatus:
                                          prev.paymentStatus === "paid" ? "pending" : "paid",
                                      }
                                    : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.paymentStatus === "paid"
                                  ? "bg-[#c6a268] text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.paymentStatus === "paid" ? "Marked Paid" : "Marked Unpaid"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, slaughtered: !prev.slaughtered } : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.slaughtered
                                  ? "bg-[#c6a268] text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.slaughtered ? "Slaughtered" : "Pending"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, delivered: !prev.delivered } : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.delivered
                                  ? "bg-[#c6a268] text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.delivered ? "Delivered" : "Awaiting Delivery"}
                            </button>
                          </div>

                          <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4">
                            <button
                              type="button"
                              onClick={() => {
                                markDirty();
                                setEditForm((prev) =>
                                  prev ? { ...prev, cancelled: !prev.cancelled } : prev
                                );
                              }}
                              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                                editForm.cancelled
                                  ? "bg-rose-300 text-[#161015]"
                                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {editForm.cancelled ? "Booking Cancelled" : "Cancel Booking"}
                            </button>

                            {editForm.cancelled ? (
                              <div className="mt-4">
                                <label className="mb-2 block text-sm font-medium text-white/90">
                                  Cancellation reason
                                </label>
                                <textarea
                                  rows={3}
                                  value={editForm.cancelReason}
                                  onChange={(e) => {
                                    markDirty();
                                    setEditForm((prev) =>
                                      prev ? { ...prev, cancelReason: e.target.value } : prev
                                    );
                                  }}
                                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                                />
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={saveEditForm}
                              className="inline-flex h-12 items-center justify-center rounded-full bg-[#c6a268] px-6 text-sm font-semibold text-[#161015] transition hover:brightness-105 disabled:opacity-60"
                            >
                              {savingEdit ? "Saving..." : "Save Booking Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openWhatsAppForOrder(
                                  selectedOrder,
                                  buildPaymentReminderMessage(selectedOrder, settings)
                                )
                              }
                              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                              WhatsApp Reminder
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}