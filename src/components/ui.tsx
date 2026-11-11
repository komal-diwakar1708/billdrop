import Link from "next/link";
import type { DisplayStatus } from "@/lib/invoices";

const STATUS_STYLES: Record<DisplayStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  viewed: "bg-violet-50 text-violet-700 ring-violet-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  void: "bg-slate-100 text-slate-400 ring-slate-200 line-through",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function ClaudeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
      <span aria-hidden>✳</span> via Claude
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">B</span>
      BillDrop
    </Link>
  );
}
