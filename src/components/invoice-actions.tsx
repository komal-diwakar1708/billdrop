"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeStatus, removeInvoice } from "@/app/actions/invoices";
import type { InvoiceStatus } from "@/db/schema";
import { CopyButton } from "./client-utils";

export function InvoiceActions({
  invoiceId,
  status,
  publicUrl,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  publicUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(next: InvoiceStatus) {
    setError(null);
    startTransition(async () => {
      const result = await changeStatus(invoiceId, next);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "draft" && (
        <button className="btn-primary" disabled={pending} onClick={() => run("sent")}>
          Publish &amp; get link
        </button>
      )}
      {status === "sent" && (
        <>
          <CopyButton text={publicUrl} label="Copy client link" />
          <button className="btn-primary" disabled={pending} onClick={() => run("paid")}>
            Mark as paid
          </button>
        </>
      )}
      {status !== "draft" && (
        <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-secondary">
          View client page ↗
        </a>
      )}
      {(status === "paid" || status === "void" || status === "sent") && (
        <button className="btn-ghost" disabled={pending} onClick={() => run("draft")}>
          Back to draft
        </button>
      )}
      {status === "sent" && (
        <button className="btn-danger" disabled={pending} onClick={() => run("void")}>
          Void
        </button>
      )}
      {status === "draft" && (
        <button
          className="btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this draft invoice?")) {
              startTransition(() => removeInvoice(invoiceId));
            }
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}
