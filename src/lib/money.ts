export type Totals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type TotalsLine = { quantity: number | string; unitPriceCents: number };

export function lineAmountCents(line: TotalsLine): number {
  return Math.round(Number(line.quantity) * line.unitPriceCents);
}

export function computeTotals(
  lines: TotalsLine[],
  taxRatePercent: number | string,
  discountCents = 0,
): Totals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineAmountCents(l), 0);
  const discount = Math.min(Math.max(discountCents, 0), subtotalCents);
  const taxable = subtotalCents - discount;
  const taxCents = Math.round((taxable * Number(taxRatePercent)) / 100);
  return {
    subtotalCents,
    discountCents: discount,
    taxCents,
    totalCents: taxable + taxCents,
  };
}

export function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
