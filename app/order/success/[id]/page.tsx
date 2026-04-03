import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type OrderData = {
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
};

function formatZAR(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
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

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: OrderData | null = null;
  let error = "";

  try {
    const snap = await getDoc(doc(db, "orders", id));

    if (!snap.exists()) {
      error = "We could not find this booking.";
    } else {
      order = snap.data() as OrderData;
    }
  } catch (err) {
    console.error("Error loading order:", err);
    error = "Something went wrong while loading the booking.";
  }

  const orderReference = `NQ-${id.slice(0, 8).toUpperCase()}`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09070b] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#09070b]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#120c12_0%,#0c090d_38%,#070509_100%)]" />
        <div className="absolute right-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-[#c6a268]/[0.10] blur-3xl" />
        <div className="absolute left-[-10rem] top-[10rem] h-[30rem] w-[30rem] rounded-full bg-[##4f422f]/[0.26] blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[-12rem] h-[40rem] w-[40rem] rounded-full bg-[#7a5a45]/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,162,104,0.05),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(74,42,59,0.18),transparent_32%)]" />
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

      <section className="mx-auto max-w-6xl overflow-x-hidden px-5 pb-16 pt-2 sm:px-8 lg:px-10 lg:pb-24 lg:pt-4">
        {error ? (
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
                className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#4f422f]"
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
                <div className="flex justify-center lg:justify-start">
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
    Booking received Successfully
  </div>
</div>

<h1 className="mt-5 text-center text-[2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[2.5rem] lg:text-left lg:text-[2.7rem]">                </h1>

<p className="mx-auto mt-4 max-w-2xl text-center text-[0.98rem] leading-7 text-emerald-50/80 sm:text-[1.03rem] sm:leading-8 lg:mx-0 lg:text-left">                  Thank you. Your qurbani booking has been submitted and recorded successfully.
                  Please keep your booking reference for future queries.
                </p>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                  <p className="text-sm text-white/50">Booking reference</p>
                  <p className="mt-2 break-all text-[1.2rem] font-semibold tracking-[0.08em] text-[#d8b67e] sm:text-[1.4rem]">
  {orderReference}
</p>
                </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-5">
                  <p className="text-sm font-medium text-white/82">What happens next?</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    If any further clarification is needed, the team will contact you using
                    the details provided in your booking.
                  </p>
                </div>

                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start lg:items-start">
                  <Link
                    href="/order"
                    className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-full bg-[#c6a268] px-6 text-[14px] font-semibold text-[#4f422f]"
                  >
                    Place Another Order
                  </Link>

                  <Link
                    href="/"
                    className="inline-flex h-[40px] min-w-[156px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white"
                  >
                    Back Home
                  </Link>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5">
              <div className="space-y-5 xl:sticky xl:top-6">
                <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#171018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                    Booking summary
                  </p>
                  <h2 className="mt-3 text-center text-[1.6rem] font-semibold text-white lg:text-left">
                    Review your details
                  </h2>

                  <div className="mt-6">
                    <SummaryRow label="Full name" value={order?.fullName || "—"} />
                    <SummaryRow label="Phone" value={order?.phone || "—"} />
                    <SummaryRow label="Email" value={order?.email || "—"} />
                    <SummaryRow label="Quantity" value={order?.quantity ? String(order.quantity) : "—"} />
                    <SummaryRow label="Weight range" value={order?.preferredWeight || "—"} />
                    <SummaryRow
                      label="Slicing preferences"
                      value={order?.cutPreferences?.length ? order.cutPreferences.join(", ") : "—"}
                    />
                    <SummaryRow
                      label="Service package"
                      value={order?.addServices ? "Included" : "Not added"}
                    />
                    <SummaryRow
                      label="Delivery"
                      value={order?.delivery ? "Included" : "Not added"}
                    />
                    <SummaryRow
                      label="Total due"
                      value={order?.totalPrice ? formatZAR(order.totalPrice) : "—"}
                      strong
                    />
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#d8b67e] text-center lg:text-left">
                    Confirmation kept safe
                  </p>
                  <div className="mt-4 grid gap-3">
                    <InfoCard>Your booking remains available on this confirmation page</InfoCard>
                    <InfoCard>Your booking reference can be used for any follow-up queries</InfoCard>
                    <InfoCard>Your submitted pricing and preferences remain visible here</InfoCard>
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