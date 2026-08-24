# Module — Thermal Printing

## 1. Purpose

The Printing module generates and sends ESC/POS-formatted byte streams to an 80mm thermal receipt printer connected via USB. It is responsible for the bill layout, print pipeline sequencing, reprint marking, and graceful handling of printer errors. The system's ability to save a bill must never depend on the printer being online.

---

## 2. Hardware Target

| Property | Specification |
|---|---|
| Printer width | **80mm** (primary); 58mm as fallback (configurable in Settings) |
| Protocol | **ESC/POS** (Epson Standard Code for POS Printers) |
| Connection | USB (primary); USB-to-Serial or network as secondary |
| Vendor | Any ESC/POS-compatible printer (Xprinter, Epson, TVS, Citizen, etc.) |
| OS | Windows 10/11 (target deployment); macOS (development) |

The system generates raw ESC/POS bytes — it does not use a Windows print driver or GDI printing. This ensures portability across printer brands.

---

## 3. Print Pipeline

```
Bill Confirmed
    │
    ▼
Bill + Lines saved to DB  ──── (this step CANNOT fail due to print issues)
    │
    ▼
Generate ESC/POS byte buffer from bill data
    │
    ▼
On-screen bill preview (formatted for 80mm width)
    │
    ▼
"Print" button → Send bytes to printer port
    │
    ├── Success → Toast: "Printed successfully"
    └── Failure → Toast: "Bill saved. Printer error: [reason]"
                          Operator can retry print later via "Reprint"
```

**Critical:** `bills.created_at` and all inventory movements are committed **before** any print attempt. Printer failure is a non-fatal I/O error — it never triggers a rollback.

---

## 4. 80mm Bill Layout

```
════════════════════════════════════════
        BADACHULI RICE MILL
        Kohalpur, Banke, Nepal
        PAN: XXXXXXXXXX  Ph: XXXXXXXXXX
════════════════════════════════════════
Bill No:  BRM-2081-00142
Date:     2081-05-12  (2024-08-28)
Customer: Ram Bahadur Thapa
Cashier:  Owner
────────────────────────────────────────
Item         Qty    Unit   Rate    Total
────────────────────────────────────────
Chamal       50     kg     72.00   3600.00
Mansuli
Bhus         20     kg     15.00    300.00
────────────────────────────────────────
                      Subtotal:  3900.00
                      Discount:    00.00
                   Taxable Amt:  3900.00
                   VAT (13%):    507.00  ← only if VAT enabled
                   Grand Total:  4407.00
────────────────────────────────────────
Payment:
  Cash Received:             4500.00
  Change:                      93.00
  Due Amount:                   0.00
════════════════════════════════════════
   Thank you for your business!
   Badachuli Rice Mill
════════════════════════════════════════
```

For non-VAT bills, the VAT line is omitted and Subtotal = Grand Total.

---

## 5. ESC/POS Command Structure

The bill is constructed as a sequence of ESC/POS commands:

```typescript
import { Printer, types } from 'escpos-js';  // or node-thermal-printer

function buildBillBuffer(bill: BillData, settings: Settings): Buffer {
  const p = new Printer(types.EPSON);

  // Header
  p.align('CT')
   .style('B')
   .size(1, 1)
   .text(settings.mill_name)
   .size(0, 0)
   .style('NORMAL')
   .text(settings.mill_address)
   .text(`PAN: ${settings.pan_number}  Ph: ${settings.phone}`)
   .drawLine()

  // Bill metadata
  p.align('LT')
   .text(`Bill No: ${bill.bill_no}`)
   .text(`Date: ${bill.bill_date_bs}  (${bill.bill_date_ad})`)
   .text(`Customer: ${bill.customer_name ?? 'Walk-in'}`)
   .text(`Cashier: ${bill.operator_name}`)
   .drawLine()

  // Column headers
  p.tableCustom([
    { text: 'Item',  width: 0.40, align: 'LEFT' },
    { text: 'Qty',   width: 0.15, align: 'RIGHT' },
    { text: 'Unit',  width: 0.10, align: 'LEFT' },
    { text: 'Rate',  width: 0.15, align: 'RIGHT' },
    { text: 'Total', width: 0.20, align: 'RIGHT' },
  ]);
  p.drawLine();

  // Line items
  for (const line of bill.lines) {
    p.tableCustom([
      { text: `${line.item_name}\n${line.variant_name}`, width: 0.40, align: 'LEFT' },
      { text: String(line.qty),        width: 0.15, align: 'RIGHT' },
      { text: line.unit_symbol,        width: 0.10, align: 'LEFT' },
      { text: formatNRS(line.rate),    width: 0.15, align: 'RIGHT' },
      { text: formatNRS(line.total),   width: 0.20, align: 'RIGHT' },
    ]);
  }

  // Totals
  p.drawLine();
  // ... subtotal, discount, VAT, grand total rows

  // Payment summary
  // ...

  // Footer
  p.align('CT')
   .text('Thank you for your business!')
   .text(settings.mill_name)
   .cut();

  return p.getBuffer();
}
```

---

## 6. Reprint

A reprint is **byte-for-byte identical** to the original bill but includes a "DUPLICATE COPY" header:

```
════════════════════════════════════════
           *** DUPLICATE COPY ***
════════════════════════════════════════
        BADACHULI RICE MILL
        ...
```

When a reprint is issued:
1. `bills.is_reprinted` is set to `1` (if it wasn't already)
2. An `audit_log` row is written with `action = 'BILL_REPRINTED'`
3. The same buffer generation function is called with an `{ isDuplicate: true }` flag that prepends the duplicate header

The `rate_snapshot` on each `bill_line` ensures totals match the original exactly regardless of current pricing.

---

## 7. Printer Configuration (Settings)

| Setting | Options | Default |
|---|---|---|
| Printer width | 58mm / 80mm | 80mm |
| Printer port | Auto-detect / manual COM/USB path | Auto |
| Character encoding | UTF-8 / CP1252 | CP1252 (Windows-safe for Nepali numerals) |
| Cut mode | Full cut / Partial cut / No cut | Full cut |
| Cash drawer | Enabled / Disabled | Disabled |
| Bill footer text | Configurable (max 2 lines) | "Thank you for your business!" |

A "Test Print" button sends a minimal test page to verify the printer connection.

---

## 8. Windows Printer Port Handling

Since the app deploys on Windows, printer port access uses Node.js's `serialport` package (for COM/USB serial) or direct raw socket for network printers.

```typescript
// infrastructure/printer.ts

import { SerialPort } from 'serialport';
import net from 'net';

async function sendToPrinter(buffer: Buffer, config: PrinterConfig): Promise<void> {
  if (config.connection === 'serial') {
    const port = new SerialPort({ path: config.port, baudRate: 9600 });
    await new Promise<void>((resolve, reject) => {
      port.write(buffer, err => err ? reject(err) : resolve());
      port.drain();
    });
    port.close();
  } else if (config.connection === 'network') {
    const client = net.createConnection({ host: config.host, port: config.port });
    await new Promise<void>((resolve, reject) => {
      client.write(buffer, err => err ? reject(err) : resolve());
      client.end();
    });
  }
}
```

**Mac development note:** During development on macOS, use a virtual serial port or a network ESC/POS printer simulator (e.g., PrintNode or a local ESC/POS emulator) to test print output. The production binary targets Windows USB/serial.

---

## 9. Error Handling

| Error | System Response |
|---|---|
| Printer offline / not connected | Bill saves; toast warning shown; "Reprint" available from bill history |
| Paper out | Same as offline — save succeeds, print error surfaced |
| Port in use by another process | Error message with port name; user advised to check printer cable/power |
| Encoding error (special character) | Fallback: replace unsupported characters with closest ASCII equivalent |
| Print timeout | Configurable timeout (default 5s); fails gracefully |

No print error ever rolls back the saved bill.

---

## 10. Development Tooling

- **escpos-js** — JavaScript ESC/POS library for generating byte buffers (preferred; pure JS, no native deps)
- **node-thermal-printer** — Alternative with more printer presets; evaluate for character encoding support
- **Receipt-printer-encoder** — Another option with good 80mm layout utilities
- **PrintNode or QVSP** — Network-based ESC/POS simulators for macOS dev testing
