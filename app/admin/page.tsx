"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
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
  delivered?: boolean;
  createdAt?: any;
  updatedAt?: any;
  cancelled?: boolean;
  cancelReason?: string;
  queueNumber?: number | null;
  manualEntry?: boolean;
  bookingYear?: number;
};

type SettingsWeightOption = {
  label: string;
  price: number;
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
  delivered: boolean;
  queueNumber: string;
  cancelled: boolean;
  cancelReason: string;
  weightRows: Array<{
    id: string;
    label: string;
    quantity: string;
  }>;
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
};

const CUT_PREFERENCE_OPTIONS = [
  "Curry packs",
  "Chops",
  "Ribs",
  "Whole leg",
  "Liver",
  "Back legs sliced",
  "Front legs whole",
  "Front legs sliced",
];

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
  if (order.delivered) return "Delivered";
  if (order.slaughtered) return "Slaughtered";
  return "Pending";
}

function totalSheep(order: OrderItem) {
  if (order.weightBreakdown?.length) {
    return order.weightBreakdown.reduce((sum, row) => sum + (row.quantity || 0), 0);
  }
  return order.quantity || 0;
}

function buildLegacyPreferredWeight(weightBreakdown: WeightBreakdownItem[]) {
  return weightBreakdown.map((row) => `${row.label} x${row.quantity}`).join(", ");
}

function rowsFromOrder(order: OrderItem) {
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

      return {
        id: row.id,
        label: row.label.trim(),
        quantity,
        price,
        subtotal,
      };
    })
    .filter((row) => row.label && Number.isInteger(row.quantity) && row.quantity > 0);

  const weightBreakdown: WeightBreakdownItem[] = validRows.map((row) => ({
    id: row.id,
    label: row.label,
    quantity: row.quantity,
    price: row.price,
    subtotal: row.subtotal,
  }));

  return weightBreakdown;
}

function buildPaymentReminderMessage(order: OrderItem, settings: AppSettings) {
  const ref = orderReference(order.id);
  const summary = sheepSummary(order);
  const total = formatZAR(order.totalPrice || 0);

  return `${settings.reminderMessageIntro}

Booking Ref: ${ref}
Booking: ${summary}
Amount Due: ${total}

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

function buildSlaughteredMessage(order: OrderItem) {
  const ref = orderReference(order.id);
  return `Assalaamu alaikum.

Your Northside Qurbani booking (${ref}) has been marked as slaughtered.

Jazakumullahu khayran.`;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportOrdersToCSV(orders: OrderItem[]) {
  const headers = [
    "Reference",
    "Name",
    "Phone",
    "Email",
    "Booking",
    "Sheep Count",
    "Total Price",
    "Payment Status",
    "Status",
    "Cancelled",
    "Cancel Reason",
    "Queue Number",
    "Manual Entry",
    "Created At",
    "Cut Preferences",
    "Notes",
  ];

  const rows = orders.map((order) => [
    orderReference(order.id),
    order.fullName || "",
    order.phone || "",
    order.email || "",
    sheepSummary(order),
    String(totalSheep(order)),
    String(order.totalPrice || 0),
    order.paymentStatus || "pending",
    statusLabel(order),
    order.cancelled ? "Yes" : "No",
    order.cancelReason || "",
    order.queueNumber ?? "",
    order.manualEntry ? "Yes" : "No",
    formatDate(order.createdAt),
    (order.cutPreferences || []).join(" | "),
    (order.notes || "").replace(/\n/g, " "),
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  downloadTextFile("northside-qurbani-orders.csv", csv, "text/csv;charset=utf-8");
}

function openPrintWindow(orders: OrderItem[]) {
  const htmlRows = orders
    .map(
      (order, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${orderReference(order.id)}</td>
          <td>${order.fullName || ""}</td>
          <td>${order.phone || ""}</td>
          <td>${sheepSummary(order)}</td>
          <td>${totalSheep(order)}</td>
          <td>${formatZAR(order.totalPrice || 0)}</td>
          <td>${order.paymentStatus || "pending"}</td>
          <td>${statusLabel(order)}</td>
          <td>${order.queueNumber ?? ""}</td>
          <td>${order.notes || ""}</td>
        </tr>
      `
    )
    .join("");

  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Northside Qurbani Bookings</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin-bottom: 8px; }
          p { margin-top: 0; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Northside Qurbani Booking List</h1>
        <p>Generated on ${new Date().toLocaleString("en-ZA")}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ref</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Booking</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Queue</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
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
  const label = statusLabel(order);

  const className =
    label === "Delivered"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : label === "Slaughtered"
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : label === "Cancelled"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
      : "border-violet-400/20 bg-violet-400/10 text-violet-200";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
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
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6">
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

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [specialFilter, setSpecialFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [updatingField, setUpdatingField] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(snap.data() as Partial<AppSettings>),
        });
      },
      (error) => {
        console.error("Settings snapshot error:", error);
      }
    );

    return () => unsub();
  }, [authorised]);

  useEffect(() => {
    if (!selectedOrder) {
      setEditForm(null);
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
      delivered: !!selectedOrder.delivered,
      queueNumber:
        selectedOrder.queueNumber === null || selectedOrder.queueNumber === undefined
          ? ""
          : String(selectedOrder.queueNumber),
      cancelled: !!selectedOrder.cancelled,
      cancelReason: selectedOrder.cancelReason || "",
      weightRows: rowsFromOrder(selectedOrder),
    });
  }, [selectedOrder]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !order.cancelled),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    const next = orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.fullName?.toLowerCase().includes(term) ||
        order.phone?.toLowerCase().includes(term) ||
        order.email?.toLowerCase().includes(term) ||
        orderReference(order.id).toLowerCase().includes(term) ||
        sheepSummary(order).toLowerCase().includes(term) ||
        (order.notes || "").toLowerCase().includes(term);

      const payment = (order.paymentStatus || "pending").toLowerCase();

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "paid" && payment === "paid") ||
        (paymentFilter === "unpaid" && payment !== "paid");

      const matchesWorkflow =
        workflowFilter === "all" ||
        (workflowFilter === "pending" &&
          !order.cancelled &&
          !order.slaughtered &&
          !order.delivered) ||
        (workflowFilter === "slaughtered" &&
          !!order.slaughtered &&
          !order.delivered &&
          !order.cancelled) ||
        (workflowFilter === "delivered" && !!order.delivered && !order.cancelled) ||
        (workflowFilter === "cancelled" && !!order.cancelled);

      const matchesSpecial =
        specialFilter === "all" ||
        (specialFilter === "queue" &&
          !order.cancelled &&
          !order.delivered &&
          (order.queueNumber || 0) > 0) ||
        (specialFilter === "manual" && !!order.manualEntry) ||
        (specialFilter === "withNotes" && !!order.notes?.trim()) ||
        (specialFilter === "outstanding" &&
          !order.cancelled &&
          (order.paymentStatus || "pending").toLowerCase() !== "paid");

      return matchesSearch && matchesPayment && matchesWorkflow && matchesSpecial;
    });

    return [...next].sort((a, b) => {
      const queueA = a.queueNumber || 999999;
      const queueB = b.queueNumber || 999999;

      if (specialFilter === "queue" && queueA !== queueB) {
        return queueA - queueB;
      }

      const nameA = (a.fullName || "").trim();
      const nameB = (b.fullName || "").trim();

      if (!nameA && !nameB) return 0;
      if (!nameA) return 1;
      if (!nameB) return -1;

      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [orders, search, paymentFilter, workflowFilter, specialFilter]);

  const totalOrders = activeOrders.length;
  const paidOrders = activeOrders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() === "paid"
  );
  const unpaidOrders = activeOrders.filter(
    (o) => (o.paymentStatus || "pending").toLowerCase() !== "paid"
  );
  const slaughteredOrders = activeOrders.filter((o) => !!o.slaughtered);
  const deliveredOrders = activeOrders.filter((o) => !!o.delivered);
  const pendingOrders = activeOrders.filter(
    (o) => !o.slaughtered && !o.delivered && !o.cancelled
  );
  const cancelledOrders = orders.filter((o) => !!o.cancelled);

  const totalExpectedRevenue = activeOrders.reduce(
    (sum, order) => sum + (order.totalPrice || 0),
    0
  );
  const totalCollected = paidOrders.reduce(
    (sum, order) => sum + (order.totalPrice || 0),
    0
  );
  const totalOutstanding = unpaidOrders.reduce(
    (sum, order) => sum + (order.totalPrice || 0),
    0
  );

  const sizeBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    activeOrders.forEach((order) => {
      (order.weightBreakdown || []).forEach((row) => {
        map.set(row.label, (map.get(row.label) || 0) + (row.quantity || 0));
      });
    });

    return settings.weightOptions.map((option) => ({
      label: option.label,
      value: map.get(option.label) || 0,
    }));
  }, [activeOrders, settings.weightOptions]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, number>();

    activeOrders.forEach((order) => {
      const date = order.createdAt?.toDate?.();
      if (!date) return;
      const label = date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
      });
      map.set(label, (map.get(label) || 0) + 1);
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .slice(-7);
  }, [activeOrders]);

  async function updateField(orderId: string, payload: Partial<OrderItem>) {
    try {
      setUpdatingField(orderId);
      await updateDoc(doc(db, "orders", orderId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
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
        {
          ...settings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Settings save failed:", error);
      alert("Could not save settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  function openWhatsAppForOrder(order: OrderItem, message: string) {
    const phone = cleanPhoneForWhatsApp(order.phone);
    if (!phone) {
      alert("This customer does not have a valid phone number saved.");
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleBulkPaymentReminders() {
    const targets = unpaidOrders.filter((order) => cleanPhoneForWhatsApp(order.phone));
    if (!targets.length) {
      alert("There are no unpaid customers with valid phone numbers.");
      return;
    }

    const confirmed = window.confirm(
      `This will open ${targets.length} WhatsApp reminder tab(s). Continue?`
    );
    if (!confirmed) return;

    targets.forEach((order, index) => {
      const message = buildPaymentReminderMessage(order, settings);
      setTimeout(() => {
        openWhatsAppForOrder(order, message);
      }, index * 250);
    });
  }

  async function handleQuickToggle(
    order: OrderItem,
    field: "paymentStatus" | "slaughtered" | "delivered"
  ) {
    if (field === "paymentStatus") {
      const next = (order.paymentStatus || "pending").toLowerCase() === "paid" ? "pending" : "paid";
      await updateField(order.id, { paymentStatus: next as "pending" | "paid" });
      return;
    }

    if (field === "slaughtered") {
      const next = !order.slaughtered;
      await updateField(order.id, { slaughtered: next });

      if (next && !order.cancelled) {
        const shouldOpenWhatsApp = window.confirm(
          "Open WhatsApp slaughter confirmation for this customer?"
        );
        if (shouldOpenWhatsApp) {
          openWhatsAppForOrder(order, buildSlaughteredMessage(order));
        }
      }
      return;
    }

    if (field === "delivered") {
      const next = !order.delivered;
      await updateField(order.id, { delivered: next });
    }
  }

  async function saveEditForm() {
    if (!selectedOrder || !editForm) return;

    const weightBreakdown = computeBreakdownFromRows(editForm.weightRows, settings);

    if (!editForm.fullName.trim()) {
      alert("Please enter the customer name.");
      return;
    }

    if (!editForm.phone.trim()) {
      alert("Please enter the customer phone number.");
      return;
    }

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

    const queueNumberValue =
      editForm.queueNumber.trim() === "" ? null : Number(editForm.queueNumber);

    if (
      queueNumberValue !== null &&
      (!Number.isInteger(queueNumberValue) || queueNumberValue < 1)
    ) {
      alert("Queue number must be a whole number.");
      return;
    }

    try {
      setSavingEdit(true);

      await updateDoc(doc(db, "orders", selectedOrder.id), {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        quantity,
        preferredWeight: buildLegacyPreferredWeight(weightBreakdown),
        weightBreakdown,
        cutPreferences,
        notes: editForm.notes.trim(),
        addServices: editForm.addServices,
        delivery: editForm.delivery,
        basePriceTotal,
        servicesPerSheep,
        servicesTotal,
        deliveryPerSheep,
        deliveryTotal,
        totalPrice,
        paymentStatus: editForm.paymentStatus,
        slaughtered: editForm.cancelled ? false : editForm.slaughtered,
        delivered: editForm.cancelled ? false : editForm.delivered,
        queueNumber: editForm.cancelled ? null : queueNumberValue,
        cancelled: editForm.cancelled,
        cancelReason: editForm.cancelled ? editForm.cancelReason.trim() : "",
        updatedAt: serverTimestamp(),
      });

      if (editForm.cancelled && editForm.cancelReason.trim()) {
        const shouldOpenWhatsApp = window.confirm(
          "Open WhatsApp cancellation notice for this customer?"
        );
        if (shouldOpenWhatsApp) {
          openWhatsAppForOrder(
            selectedOrder,
            buildCancellationMessage(selectedOrder, editForm.cancelReason.trim())
          );
        }
      }
    } catch (error) {
      console.error("Failed saving edit form:", error);
      alert("Could not save this booking.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveQuickNotes(order: OrderItem, notes: string) {
    await updateField(order.id, { notes });
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

      await addDoc(collection(db, "orders"), {
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
        delivered: false,
        cancelled: false,
        cancelReason: "",
        queueNumber: null,
        manualEntry: true,
        bookingYear: new Date().getFullYear(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
    } catch (error) {
      console.error("Manual booking failed:", error);
      alert("Could not add manual booking.");
    } finally {
      setManualSaving(false);
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
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[#f5efe6]/[0.06] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-4">
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
            <div className="mt-1 text-sm text-white/55">Farm register</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Homepage
          </Link>

          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            {showSettings ? "Hide Settings" : "Settings"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#f5efe6] px-5 text-sm font-medium text-[#161015] transition hover:bg-[#e8dfd3]"
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

              <h1 className="mt-5 pb-2 bg-[linear-gradient(135deg,#fbf4e8_0%,#d8b67e_44%,#ffffff_100%)] bg-clip-text text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.05em] text-transparent sm:text-[3rem] lg:text-[3.8rem]">
                Qurbani Day Register
              </h1>

              <p className="mx-auto mt-5 max-w-3xl text-[1rem] leading-7 text-white/62 sm:text-[1.04rem] sm:leading-8 xl:mx-0">
                Customer bookings, queue management, reminders, settings, reports,
                edits, and manual entries from one dashboard.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Bookings" value={String(totalOrders)} helper={`${cancelledOrders.length} cancelled`} />
              <SummaryCard label="Expected Revenue" value={formatZAR(totalExpectedRevenue)} helper={`${formatZAR(totalCollected)} collected`} />
              <SummaryCard label="Outstanding" value={formatZAR(totalOutstanding)} helper={`${unpaidOrders.length} unpaid`} />
              <SummaryCard label="Pending / Slaughtered / Delivered" value={`${pendingOrders.length} / ${slaughteredOrders.length} / ${deliveredOrders.length}`} />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <MiniBarChart title="Most Popular Sheep Sizes" data={sizeBreakdown} />
              <MiniBarChart title="Recent Booking Trend" data={bookingsByDay.length ? bookingsByDay : [{ label: "No data", value: 0 }]} />
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
                    placeholder="Name, phone, email, reference, notes, or sheep size"
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
                  <div className="mb-2 text-sm font-medium text-white/82">Workflow</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton active={workflowFilter === "all"} label="All" onClick={() => setWorkflowFilter("all")} />
                    <FilterButton active={workflowFilter === "pending"} label="Pending" onClick={() => setWorkflowFilter("pending")} />
                    <FilterButton active={workflowFilter === "slaughtered"} label="Slaughtered" onClick={() => setWorkflowFilter("slaughtered")} />
                    <FilterButton active={workflowFilter === "delivered"} label="Delivered" onClick={() => setWorkflowFilter("delivered")} />
                    <FilterButton active={workflowFilter === "cancelled"} label="Cancelled" onClick={() => setWorkflowFilter("cancelled")} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <FilterButton active={specialFilter === "all"} label="All Bookings" onClick={() => setSpecialFilter("all")} />
                <FilterButton active={specialFilter === "queue"} label="Slaughter Queue" onClick={() => setSpecialFilter("queue")} />
                <FilterButton active={specialFilter === "manual"} label="Manual Entries" onClick={() => setSpecialFilter("manual")} />
                <FilterButton active={specialFilter === "withNotes"} label="With Notes" onClick={() => setSpecialFilter("withNotes")} />
                <FilterButton active={specialFilter === "outstanding"} label="Outstanding Report" onClick={() => setSpecialFilter("outstanding")} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualForm((prev) => !prev)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#c6a268] px-5 text-sm font-semibold text-[#161015] transition hover:brightness-105"
                >
                  {showManualForm ? "Hide Manual Booking" : "Add Manual Booking"}
                </button>

                <button
                  type="button"
                  onClick={handleBulkPaymentReminders}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Bulk Payment Reminder Blast
                </button>

                <button
                  type="button"
                  onClick={() => exportOrdersToCSV(filteredOrders)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={() => openPrintWindow(filteredOrders)}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Print Booking List
                </button>
              </div>

              {showManualForm ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Add Booking Manually</h3>
                  <p className="mt-1 text-sm text-white/55">
                    For customers who message directly instead of using the app.
                  </p>

                  <form onSubmit={submitManualBooking} className="mt-5 grid gap-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Full name
                        </label>
                        <input
                          value={manualForm.fullName}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, fullName: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Phone number
                        </label>
                        <input
                          value={manualForm.phone}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Email
                        </label>
                        <input
                          value={manualForm.email}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>
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
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Cut preferences
                        </label>
                        <textarea
                          rows={4}
                          value={manualForm.cutPreferences}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, cutPreferences: e.target.value }))}
                          placeholder={CUT_PREFERENCE_OPTIONS.join(", ")}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Notes
                        </label>
                        <textarea
                          rows={4}
                          value={manualForm.notes}
                          onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setManualForm((prev) => ({ ...prev, addServices: !prev.addServices }))
                        }
                        className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                          manualForm.addServices
                            ? "bg-[#c6a268] text-[#161015]"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        Services {manualForm.addServices ? "Added" : "Off"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setManualForm((prev) => ({ ...prev, delivery: !prev.delivery }))
                        }
                        className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                          manualForm.delivery
                            ? "bg-[#c6a268] text-[#161015]"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        Delivery {manualForm.delivery ? "Added" : "Off"}
                      </button>

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
                  <h3 className="text-lg font-semibold text-white">Admin Settings</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Booking cutoff control, bank details, and yearly sheep prices.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <label className="mb-2 block text-sm font-medium text-white/82">
                        Bookings open
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({ ...prev, bookingsOpen: !prev.bookingsOpen }))
                        }
                        className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                          settings.bookingsOpen
                            ? "bg-[#c6a268] text-[#161015]"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        {settings.bookingsOpen ? "Bookings Open" : "Bookings Closed"}
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <label className="mb-2 block text-sm font-medium text-white/82">
                        Booking cutoff date
                      </label>
                      <input
                        type="date"
                        value={settings.bookingCutoffDate}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, bookingCutoffDate: e.target.value }))
                        }
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Account name</label>
                      <input
                        value={settings.accountName}
                        onChange={(e) => setSettings((prev) => ({ ...prev, accountName: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Bank name</label>
                      <input
                        value={settings.bankName}
                        onChange={(e) => setSettings((prev) => ({ ...prev, bankName: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Account number</label>
                      <input
                        value={settings.accountNumber}
                        onChange={(e) => setSettings((prev) => ({ ...prev, accountNumber: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Account type</label>
                      <input
                        value={settings.accountType}
                        onChange={(e) => setSettings((prev) => ({ ...prev, accountType: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Branch code</label>
                      <input
                        value={settings.branchCode}
                        onChange={(e) => setSettings((prev) => ({ ...prev, branchCode: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/82">Reference hint</label>
                      <input
                        value={settings.referenceHint}
                        onChange={(e) => setSettings((prev) => ({ ...prev, referenceHint: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-white/82">
                      Payment reminder intro
                    </label>
                    <textarea
                      rows={4}
                      value={settings.reminderMessageIntro}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, reminderMessageIntro: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>

                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-4">
                      <p className="font-medium text-white">Yearly sheep prices</p>
                      <p className="text-sm text-white/55">
                        Change prices here instead of touching code next year.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {settings.weightOptions.map((option, index) => (
                        <div key={option.label} className="grid gap-3 md:grid-cols-[1fr_180px]">
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
                          />
                          <input
                            type="number"
                            min={0}
                            value={option.price}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                weightOptions: prev.weightOptions.map((item, i) =>
                                  i === index
                                    ? { ...item, price: Number(e.target.value || 0) }
                                    : item
                                ),
                              }))
                            }
                            className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
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

              <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10">
                <div className="max-h-[980px] overflow-auto">
                  {loadingOrders ? (
                    <div className="p-6 text-sm text-white/60">Loading bookings...</div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="p-6 text-sm text-white/60">
                      No bookings found for the current filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className={`p-5 transition ${
                            selectedOrder?.id === order.id ? "bg-white/[0.06]" : "bg-transparent"
                          }`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-semibold text-white">
                                  {order.fullName || "Unnamed booking"}
                                </div>
                                <PaymentBadge value={order.paymentStatus} />
                                <WorkflowBadge order={order} />
                                {order.manualEntry ? (
                                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                                    Manual
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-2 text-sm text-white/55">
                                {orderReference(order.id)} • {order.phone || "No phone"} • {sheepSummary(order)}
                              </div>

                              <div className="mt-2 text-sm font-medium text-[#d8b67e]">
                                {formatZAR(order.totalPrice || 0)}
                              </div>
                            </button>

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
                                onClick={() =>
                                  openWhatsAppForOrder(order, buildPaymentReminderMessage(order, settings))
                                }
                                className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                              >
                                Payment Reminder
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
                            <textarea
                              rows={3}
                              defaultValue={order.notes || ""}
                              placeholder="Notes for this customer..."
                              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
                              onBlur={(e) => {
                                const nextValue = e.target.value.trim();
                                if ((order.notes || "").trim() !== nextValue) {
                                  saveQuickNotes(order, nextValue);
                                }
                              }}
                            />
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                                Queue Number
                              </div>
                              <input
                                type="number"
                                min={1}
                                defaultValue={order.queueNumber ?? ""}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  const value = raw === "" ? null : Number(raw);
                                  if (value === null || (Number.isInteger(value) && value > 0)) {
                                    updateField(order.id, { queueNumber: value });
                                  } else {
                                    alert("Queue number must be a whole number.");
                                  }
                                }}
                                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="space-y-5 xl:sticky xl:top-6">
              <SectionCard
                title="Outstanding Payments Report"
                sub="Quick follow-up list of only unpaid customers."
              >
                <div className="space-y-3">
                  {unpaidOrders.slice(0, 8).map((order) => (
                    <div
                      key={order.id}
                      className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">{order.fullName}</div>
                          <div className="mt-1 text-sm text-white/55">{order.phone}</div>
                        </div>
                        <div className="text-sm font-semibold text-[#d8b67e]">
                          {formatZAR(order.totalPrice || 0)}
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
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}

                  {unpaidOrders.length === 0 ? (
                    <div className="text-sm text-white/55">No unpaid customers right now.</div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard
                title="Selected Booking"
                sub={
                  selectedOrder
                    ? `${selectedOrder.fullName || "Booking"} • ${orderReference(selectedOrder.id)}`
                    : "Choose any booking from the list to edit it."
                }
              >
                {!selectedOrder || !editForm ? (
                  <div className="text-sm text-white/55">
                    No booking selected yet.
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <DetailRow label="Reference" value={orderReference(selectedOrder.id)} strong />
                      <DetailRow label="Created" value={formatDate(selectedOrder.createdAt)} />
                      <DetailRow label="Current Booking" value={sheepSummary(selectedOrder)} />
                      <DetailRow label="Current Total" value={formatZAR(selectedOrder.totalPrice || 0)} />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">Full name</label>
                        <input
                          value={editForm.fullName}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, fullName: e.target.value } : prev)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">Phone</label>
                        <input
                          value={editForm.phone}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">Email</label>
                        <input
                          value={editForm.email}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">Edit sheep selections</p>
                            <p className="text-sm text-white/55">Correct kg and quantities directly here.</p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setEditForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      weightRows: [...prev.weightRows, { id: slugId(), label: "", quantity: "1" }],
                                    }
                                  : prev
                              )
                            }
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
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          weightRows: prev.weightRows.map((item) =>
                                            item.id === row.id ? { ...item, label: e.target.value } : item
                                          ),
                                        }
                                      : prev
                                  )
                                }
                                className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                              >
                                <option value="" className="text-black">
                                  Select size
                                </option>
                                {settings.weightOptions.map((option) => (
                                  <option key={option.label} value={option.label} className="text-black">
                                    {option.label} — {formatZAR(option.price)}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="number"
                                min={1}
                                value={row.quantity}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          weightRows: prev.weightRows.map((item) =>
                                            item.id === row.id ? { ...item, quantity: e.target.value } : item
                                          ),
                                        }
                                      : prev
                                  )
                                }
                                className="h-12 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          weightRows:
                                            prev.weightRows.length === 1
                                              ? prev.weightRows
                                              : prev.weightRows.filter((item) => item.id !== row.id),
                                        }
                                      : prev
                                  )
                                }
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
                          Cut preferences
                        </label>
                        <textarea
                          rows={3}
                          value={editForm.cutPreferences}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, cutPreferences: e.target.value } : prev)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Notes
                        </label>
                        <textarea
                          rows={3}
                          value={editForm.notes}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/82">
                          Queue number
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editForm.queueNumber}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, queueNumber: e.target.value } : prev)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => prev ? { ...prev, addServices: !prev.addServices } : prev)}
                          className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                            editForm.addServices
                              ? "bg-[#c6a268] text-[#161015]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          Services {editForm.addServices ? "Added" : "Off"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => prev ? { ...prev, delivery: !prev.delivery } : prev)}
                          className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                            editForm.delivery
                              ? "bg-[#c6a268] text-[#161015]"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          Delivery {editForm.delivery ? "Added" : "Off"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    paymentStatus: prev.paymentStatus === "paid" ? "pending" : "paid",
                                  }
                                : prev
                            )
                          }
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
                          onClick={() =>
                            setEditForm((prev) =>
                              prev ? { ...prev, slaughtered: !prev.slaughtered } : prev
                            )
                          }
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
                          onClick={() =>
                            setEditForm((prev) =>
                              prev ? { ...prev, delivered: !prev.delivered } : prev
                            )
                          }
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
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm((prev) =>
                                prev ? { ...prev, cancelled: !prev.cancelled } : prev
                              )
                            }
                            className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition ${
                              editForm.cancelled
                                ? "bg-rose-300 text-[#161015]"
                                : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                            }`}
                          >
                            {editForm.cancelled ? "Booking Cancelled" : "Cancel Booking"}
                          </button>
                        </div>

                        {editForm.cancelled ? (
                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-white/90">
                              Cancellation reason
                            </label>
                            <textarea
                              rows={3}
                              value={editForm.cancelReason}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, cancelReason: e.target.value } : prev
                                )
                              }
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
      </section>
    </main>
  );
}