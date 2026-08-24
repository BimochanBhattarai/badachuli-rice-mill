# 06 — Nepal-Specific Compliance Requirements

## 1. Overview

This document covers the Nepal-specific legal, calendar, and operational requirements that the system must meet. These are Phase 1 requirements, not optional add-ons — shipping a system that doesn't handle BS dates correctly or prints a non-IRD-compliant bill is a launch blocker.

---

## 2. Bikram Sambat (BS) Calendar

### 2.1 Why BS

Bikram Sambat is the official and commercially standard calendar in Nepal. Business transactions, government records, fiscal year boundaries, and court filings all use BS. Customers expect their bills to show BS dates. Reporting periods (monthly, annual) align to BS months.

### 2.2 Storage vs. Display

| Concern | Decision |
|---|---|
| **Storage** | All timestamps stored as ISO 8601 strings in AD (Gregorian): `"2024-08-28T10:30:00"` |
| **Display** | All customer-facing dates shown in BS: `"2081-05-12"` |
| **Conversion** | Done at display time by the `bs-calendar` utility; never in SQL |

This keeps the database portable and compatible with standard SQL date functions, while presenting a fully Nepali experience to the operator.

### 2.3 Implementation

```typescript
// src/utils/bs-calendar.ts

import { NepaliDate } from 'bikram-sambat';  // npm: bikram-sambat

export function adToBS(adDate: string): string {
  const nd = new NepaliDate(new Date(adDate));
  return nd.format('YYYY-MM-DD');  // e.g., "2081-05-12"
}

export function bsToAD(bsDate: string): string {
  const [y, m, d] = bsDate.split('-').map(Number);
  const nd = new NepaliDate(y, m - 1, d);
  return nd.toJsDate().toISOString().split('T')[0];
}

export function todayBS(): string {
  return new NepaliDate(new Date()).format('YYYY-MM-DD');
}
```

### 2.4 BS Date Picker in UI

The billing and reporting date pickers use a BS-aware date picker component. Options:
- Build a custom React BS date picker using `bikram-sambat`
- Use `react-nepali-datepicker` (npm) if it meets the UX standard

Every date picker in the app shows a BS calendar but stores the underlying value in AD.

### 2.5 BS in Bills

Every printed and on-screen bill shows both dates:
```
Date: 2081-05-12  (2024-08-28)
```

The BS date is the primary; AD is shown in parentheses as a secondary reference.

---

## 3. IRD-Compliant Bill Format

### 3.1 Minimum Required Content (Nepal IRD)

**Badachuli Rice Mill is PAN-registered.** The PAN number must be printed on all bills. Nepal's Inland Revenue Department mandates the following on any sales invoice:

| Required Element | Where in the System |
|---|---|
| Supplier/seller name | `settings.mill_name` |
| Supplier address | `settings.mill_address` |
| PAN number (for VAT-registered businesses) | `settings.pan_number` |
| Sequential, unbroken bill number | `bills.bill_no` (format: PREFIX-YEAR-SEQUENCE) |
| Bill date | `bills.bill_date_bs` (primary) + `bills.bill_date_ad` |
| Description of goods/services | `bill_lines` (item name, variant) |
| Quantity and unit | `bill_lines.qty`, `bill_lines.unit_id` |
| Rate per unit | `bill_lines.rate_snapshot` |
| Line total | `bill_lines.line_total` |
| Grand total | `bills.grand_total` |
| VAT amount (if VAT-registered) | `bills.vat_amount` |

**Important:** The exact IRD requirements for bills below the VAT threshold vs. above may differ. The mill's accountant should confirm the applicable rules before go-live. The system is designed to be configurable to meet whatever format is required.

### 3.2 Bill Number Integrity

IRD requires sequential, unbroken bill numbering. The system enforces this:
- Bill numbers are generated inside the DB transaction that creates the bill.
- A sequence table or `MAX(bill_number) + 1` within a transaction guarantees no gaps from concurrent writes.
- Cancelled bills retain their number — they appear in cancellation reports.
- The sequence resets at the start of each Nepali fiscal year.

### 3.3 Bill Number Format

```
BRM-2081-00142
 │    │     │
 │    │     └── 5-digit zero-padded sequence (resets each fiscal year)
 │    └──────── Nepali fiscal year start (e.g., 2081 for FY 2081/82)
 └───────────── Configurable prefix (default: mill abbreviation)
```

---

## 4. VAT Handling

### 4.1 Current Status

The mill's VAT registration status is **pending confirmation** with the accountant. The system is designed to work correctly in both modes:

| Mode | Behavior |
|---|---|
| VAT Disabled (`vat_enabled = 0`) | Bills show no VAT line; grand total = subtotal − discount |
| VAT Enabled (`vat_enabled = 1`) | VAT computed on taxable lines; separate VAT line on bill |

### 4.2 Configurable VAT Rate

```
Settings → Tax Configuration:
  VAT Enabled:  [ ] Yes  [✓] No
  VAT Rate:     13%  (Nepal standard; confirm with accountant)
```

### 4.3 Per-Item VAT Flags

Not all items may be VAT-applicable. Agricultural raw materials are commonly VAT-exempt in Nepal while processed goods may be taxable. The system supports per-item VAT flags:

```
Item Settings → VAT Treatment:
  [✓] Taxable (standard rate)
  [ ] Exempt (no VAT)
  [ ] Zero-rated
```

### 4.4 VAT Calculation

```
taxable_amount  = SUM(line_total WHERE is_taxable = 1)
vat_amount      = ROUND(taxable_amount × (vat_rate / 100), 2)
grand_total     = subtotal - discount_amount + vat_amount
```

On the bill print, the VAT section appears only if `vat_enabled = 1` and `vat_amount > 0`.

---

## 5. Nepal Fiscal Year

### 5.1 Year Boundaries

Nepal's fiscal year runs from **Shrawan 1** (approximately July 16) to **Ashadh End** (approximately July 15 of the following year).

Example:
- FY 2081/82: Shrawan 1, 2081 → Ashadh 31, 2082 (approx. July 16, 2024 → July 15, 2025)

### 5.2 Bill Number Reset

The bill sequence number resets to `0001` at the start of each new fiscal year. The year component in the bill number updates to the new fiscal year.

```typescript
function getCurrentFiscalYear(bsDate: string): number {
  const [year, month] = bsDate.split('-').map(Number);
  // Nepali month 4 = Shrawan = fiscal year start
  return month >= 4 ? year : year - 1;
}
```

### 5.3 Annual Report Period

The Financial Summary and other annual reports default to the current Nepali fiscal year as their date range, not the Gregorian calendar year. The operator can change to any custom date range as needed.

---

## 6. Currency Formatting

All monetary values use Nepali Rupees (NRs / NPR):

```typescript
// src/utils/currency.ts

export function formatNRS(amount: number): string {
  // Nepal uses the Indian numbering system: 1,00,000 (lakh)
  return new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Output: "रू 1,00,000.00" or "NRs 1,00,000.00" depending on locale
}
```

For thermal print output, use the abbreviated form: `NRs 1,00,000.00`

---

## 7. Pre-Launch Compliance Checklist

**Confirmed:**
- [x] Badachuli Rice Mill is **PAN-registered** with Nepal IRD. The PAN number must be entered in Settings before the first live bill is printed.

**Still to verify with the mill's accountant before go-live:**
- [ ] Is the mill also **VAT-registered** (separate from PAN)? VAT registration is required only above the IRD turnover threshold. Obtain the VAT number if applicable.
- [ ] Confirm the applicable bill content requirements under current IRD guidelines for PAN-registered (non-VAT) vs. VAT-registered businesses.
- [ ] Confirm whether rice milling services are VAT-taxable or exempt under the current schedule.
- [ ] Confirm whether processed rice products (Chamal, Bhus, etc.) are VAT-taxable.
- [ ] Confirm the standard processing charge per kg (for the processing price list).
- [ ] Confirm the fiscal year start date for bill number reset configuration.
- [ ] Verify the `1 Bora = 50 kg` conversion is correct for this mill's measurements.
