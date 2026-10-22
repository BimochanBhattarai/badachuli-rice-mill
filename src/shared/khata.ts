/**
 * Shared receipt totals / khata block.
 *
 * The ESC/POS renderer (src/main/ipc/print.ts) and the on-screen renderer
 * (src/renderer/components/PrintReceipt.tsx) are two separate ~80-line
 * implementations in two processes. This module is the single source of truth for
 * WHAT the money block says, so the two can only differ in markup, never in content.
 *
 * Callers format the numbers themselves (each has its own Nepali-numeral formatter)
 * and only map over the rows returned here.
 */

export interface KhataRow {
  /** Nepali label, ready to print. */
  label: string
  /** Absolute amount to format. Never negative. */
  value: number
  /** `negate` prints a leading minus (discounts). */
  style: 'normal' | 'negate' | 'total' | 'grand'
  /** Append the credit marker — the customer is in credit, not in debt. */
  credit?: boolean
}

export interface KhataBillShape {
  customer_id: number | null
  grand_total: number
  discount_amount: number
  paid_amount: number
  khata_prev_balance: number | null
  khata_new_balance: number | null
}

const EPS = 0.005

/**
 * Build the money rows for a receipt.
 *
 * For a customer bill this is the khata form the owner asked for — previous balance,
 * cash paid, new balance — where previous/new come from the bill's own frozen ledger
 * rows, so a reprint shows the original figures rather than today's.
 *
 * For a walk-in bill (no customer) there is no balance to show at all.
 */
export function buildKhataRows(bill: KhataBillShape): KhataRow[] {
  const rows: KhataRow[] = []

  if (bill.discount_amount > EPS) {
    rows.push({ label: 'छूट', value: bill.discount_amount, style: 'negate' })
  }

  rows.push({ label: 'जम्मा', value: bill.grand_total, style: 'total' })

  const hasKhata = bill.customer_id != null && bill.khata_new_balance != null

  if (!hasKhata) {
    // Walk-in: cash only, no balance.
    rows.push({ label: 'तिरेको', value: bill.paid_amount, style: 'normal' })
    return rows
  }

  const prev = bill.khata_prev_balance ?? 0
  const next = bill.khata_new_balance as number

  rows.push({
    label: 'अघिल्लो बाँकी',
    value: Math.abs(prev),
    style: 'normal',
    credit: prev < -EPS,
  })

  if (bill.paid_amount > EPS) {
    rows.push({ label: 'तिरेको', value: bill.paid_amount, style: 'normal' })
  }

  rows.push({
    label: 'नयाँ बाँकी',
    value: Math.abs(next),
    style: 'grand',
    credit: next < -EPS,
  })

  return rows
}

/** Footer line. Keyed on the running balance, not on a per-bill due. */
export function khataFooter(bill: KhataBillShape): string {
  const hasKhata = bill.customer_id != null && bill.khata_new_balance != null
  if (hasKhata && (bill.khata_new_balance as number) > EPS) {
    return 'धन्यवाद — माथि उल्लेखित रकम बाँकी छ'
  }
  return 'धन्यवाद!'
}

/** Marker appended to a credit amount. */
export const CREDIT_SUFFIX = ' क्रेडिट'
