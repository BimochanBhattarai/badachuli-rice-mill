import { createContext, useContext, useState, useEffect, type ReactNode, createElement } from 'react'

// ─── Nepali numeral conversion ─────────────────────────────────────────────
const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export function toNepaliNum(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => NE_DIGITS[parseInt(d)])
}

// ─── BS month names ────────────────────────────────────────────────────────
const BS_MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत',
]

// Days in each month for BS years 2070–2095
// Source: Government of Nepal calendar data
const BS_YEAR_DATA: Record<number, number[]> = {
  2070: [31,32,31,32,31,30,30,29,30,29,30,30],
  2071: [31,31,32,31,31,31,30,29,30,29,30,30],
  2072: [31,32,31,32,31,30,30,30,29,30,29,31],
  2073: [30,32,31,32,31,30,30,30,29,30,30,30],
  2074: [31,31,32,31,31,30,30,30,29,30,30,30],
  2075: [31,31,32,31,31,30,30,30,29,30,30,30],
  2076: [31,32,31,32,31,30,30,30,29,30,29,31],
  2077: [30,32,31,32,31,30,30,30,29,30,30,30],
  2078: [31,31,32,31,31,30,30,30,29,30,30,30],
  2079: [31,31,32,31,31,30,30,30,29,30,30,30],
  2080: [31,32,31,32,31,30,30,30,29,30,29,31],
  2081: [31,31,32,32,31,30,30,29,30,29,30,30],
  2082: [31,32,31,32,31,30,30,30,29,30,29,31],
  2083: [31,31,32,31,31,30,30,30,29,30,30,30],
  2084: [31,31,32,31,31,30,30,30,29,30,30,30],
  2085: [31,32,31,32,31,30,30,30,29,30,29,31],
  2086: [30,32,31,32,31,30,30,30,29,30,30,30],
  2087: [31,31,32,31,31,30,30,30,29,30,30,30],
  2088: [31,31,32,31,31,30,30,30,29,30,30,30],
  2089: [31,32,31,32,31,30,30,30,29,30,29,31],
  2090: [30,32,31,32,31,30,30,30,29,30,30,30],
  2091: [31,31,32,31,31,30,30,30,29,30,30,30],
  2092: [31,31,32,32,31,30,30,29,30,29,30,30],
  2093: [31,32,31,32,31,30,30,30,29,30,29,31],
  2094: [30,32,31,32,31,30,30,30,29,30,30,30],
  2095: [31,31,32,31,31,30,30,30,29,30,30,30],
}

// Reference: Baisakh 1, 2070 BS = April 14, 2013 AD
const REF_BS = { year: 2070, month: 1, day: 1 }
const REF_AD = new Date(2013, 3, 14) // April 14, 2013

function adToBS(adDate: Date): { year: number; month: number; day: number } {
  const msPerDay = 86400000
  const diffDays = Math.floor((adDate.getTime() - REF_AD.getTime()) / msPerDay)

  let bsYear = REF_BS.year
  let bsMonth = REF_BS.month
  let bsDay = REF_BS.day

  let remaining = diffDays
  while (remaining > 0) {
    const monthData = BS_YEAR_DATA[bsYear]
    if (!monthData) break
    const daysInMonth = monthData[bsMonth - 1]
    if (bsDay + remaining <= daysInMonth) {
      bsDay += remaining
      remaining = 0
    } else {
      remaining -= daysInMonth - bsDay + 1
      bsDay = 1
      bsMonth++
      if (bsMonth > 12) {
        bsMonth = 1
        bsYear++
      }
    }
  }
  return { year: bsYear, month: bsMonth, day: bsDay }
}

export function formatDateBS(dateStr: string): string {
  const ad = new Date(dateStr)
  if (isNaN(ad.getTime())) return dateStr
  const bs = adToBS(ad)
  const day = toNepaliNum(String(bs.day).padStart(2, '0'))
  const month = BS_MONTHS[bs.month - 1]
  const year = toNepaliNum(bs.year)
  return `${day} ${month} ${year}`
}

export function formatAmountNe(n: number): string {
  const parts = Math.abs(n).toFixed(2).split('.')
  const whole = parseInt(parts[0]).toLocaleString('en-NP')
  return (n < 0 ? '- ' : '') + 'रु. ' + toNepaliNum(whole) + '.' + toNepaliNum(parts[1])
}

// ─── Translations ──────────────────────────────────────────────────────────
type LangKey = string
type Translations = Record<LangKey, string>

const en: Translations = {
  // Sidebar sections
  'section.sales': 'Sales',
  'section.inventory': 'Inventory',
  'section.catalog': 'Catalog',
  'section.system': 'System',
  // Sidebar nav
  'nav.dashboard': 'Dashboard',
  'nav.new_bill': 'New Bill',
  'nav.bills': 'Bills',
  'nav.customers': 'Customers',
  'nav.stock_in': 'Stock In',
  'nav.stock': 'Stock',
  'nav.suppliers': 'Suppliers',
  'nav.mill_processing': 'Mill Processing',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.items': 'Items',
  'nav.prices': 'Prices',
  'nav.units': 'Units',
  'nav.ledger': 'Ledger',
  // Common
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.loading': 'Loading…',
  'common.search': 'Search…',
  'common.all': 'All',
  'common.notes': 'Notes',
  'common.optional': 'optional',
  'common.date': 'Date',
  'common.amount': 'Amount',
  'common.name': 'Name',
  'common.phone': 'Phone',
  'common.address': 'Address',
  'common.status': 'Status',
  'common.actions': 'Actions',
  'common.no_data': 'No data found',
  'common.deactivate': 'Deactivate',
  'common.add': 'Add',
  'common.confirm': 'Confirm',
  'common.lock_session': 'Lock Session',
  'common.language': 'Language',
  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.today_bills': "Today's Bills",
  'dashboard.total_billed': 'Total Billed',
  'dashboard.collected': 'Collected',
  'dashboard.new_udharo': 'New Udharo',
  'dashboard.outstanding': 'Total Outstanding',
  'dashboard.stock_items': 'Stock Items',
  'dashboard.processing_today': 'Processing Batches Today',
  'dashboard.weekly_sales': 'Weekly Sales (Last 7 Days)',
  // Bills
  'bill.new': 'New Bill',
  'bill.type_sale': 'Sale',
  'bill.type_processing': 'Customer Processing',
  'bill.number': 'Bill No.',
  'bill.customer': 'Customer',
  'bill.item': 'Item',
  'bill.variant': 'Variant',
  'bill.qty': 'Qty',
  'bill.rate': 'Rate',
  'bill.total': 'Total',
  'bill.subtotal': 'Subtotal',
  'bill.discount': 'Discount',
  'bill.grand_total': 'Grand Total',
  'bill.paid': 'Paid',
  'bill.due': 'Due (Udharo)',
  'bill.payment_method': 'Payment Method',
  'bill.cash': 'Cash',
  'bill.bank': 'Bank Transfer',
  'bill.digital': 'Digital (eSewa/IME)',
  'bill.credit': 'Credit (Udharo)',
  'bill.confirm': 'Confirm & Save',
  'bill.business': 'Business',
  'bill.which_business': 'Which business is issuing this bill?',
  'bill.type': 'Type',
  'bill.status': 'Status',
  'bill.collect_payment': 'Collect Payment',
  'bill.cancel': 'Cancel Bill',
  'bill.print': 'Print',
  'bill.printing': 'Printing…',
  'bill.all_businesses': 'All',
  // Customers
  'customer.title': 'Customers',
  'customer.statement': 'Statement',
  'customer.outstanding': 'Outstanding',
  'customer.last_bill': 'Last Bill',
  'customer.add': 'Add Customer',
  'customer.total_billed': 'Total Billed',
  'customer.total_paid': 'Total Paid',
  // Settings
  'settings.title': 'Settings',
  'settings.business': 'Business',
  'settings.language': 'Language & Region',
  'settings.change_pin': 'Change PIN',
  'settings.current_pin': 'Current PIN',
  'settings.new_pin': 'New PIN',
  'settings.confirm_pin': 'Confirm New PIN',
  'settings.vat': 'VAT / Tax Settings',
  // Reports
  'reports.title': 'Reports',
  'reports.sales': 'Sales Report',
  'reports.items': 'Item Sales',
  'reports.ledger': 'Customer Ledger',
  'reports.from': 'From',
  'reports.to': 'To',
  'reports.run': 'Run Report',
  // Mill Processing
  'mill.title': 'Mill Processing',
  'mill.subtitle': 'Process your own inventory — no bill generated',
  'mill.input_section': 'Input',
  'mill.input_item': 'Input Item',
  'mill.input_qty': 'Quantity',
  'mill.input_variant': 'Variant',
  'mill.input_unit': 'Unit',
  'mill.outputs_section': 'Outputs',
  'mill.add_output': '+ Add Output Item',
  'mill.yield_pct': 'Yield %',
  'mill.expected': 'Expected',
  'mill.actual_qty': 'Actual Qty',
  'mill.run_batch': 'Run Processing Batch',
  'mill.running': 'Processing…',
  'mill.recent': 'Recent Batches',
  'mill.no_batches': 'No batches recorded yet',
  'mill.batch_done': 'Batch recorded — inventory updated',
  'mill.search_input': 'Search item to process…',
  'mill.search_output': 'Search output item…',
  'mill.output_item': 'Output Item',
  // Stock In
  'stockin.title': 'Stock In',
  'stockin.new': 'New Purchase',
  // Stock
  'stock.title': 'Stock',
  // Suppliers
  'supplier.title': 'Suppliers',
  // Items
  'items.title': 'Items',
  // Prices
  'prices.title': 'Prices',
  // Units
  'units.title': 'Units',
  'units.add': '+ Add Unit',
  'units.new': 'New Unit',
  'units.edit': 'Edit Unit',
  'units.abbr': 'Abbreviation',
  'units.base_factor': 'Base Factor',
  'units.default_label': 'Default',
  'units.set_default': 'Set default',
  'units.none': 'No units defined',
  // Suppliers
  'supplier.add': '+ Add Supplier',
  'supplier.new': 'New Supplier',
  'supplier.edit': 'Edit Supplier',
  'supplier.none': 'No suppliers',
  // Prices
  'prices.sell_tab': 'Sell Prices',
  'prices.processing_tab': 'Processing Charges',
  'prices.sell_label': 'Sell Price',
  'prices.processing_label': 'Processing Charge',
  'prices.since': 'Since',
  'prices.not_set': 'Not set',
  'prices.update': 'Update',
  'prices.set_price': 'Set Price',
  'prices.effective_from': 'Effective from',
  // Stock
  'stock.add': '+ Opening Stock',
  'stock.form_title': 'Enter Opening Stock',
  'stock.buy_price': 'Buy Price (Rs.)',
  'stock.record': 'Record Stock',
  'stock.balance': 'Balance',
  'stock.category': 'Category',
  'stock.none': 'No stock recorded yet — add opening stock to get started',
  'stock.item': 'Item',
  'stock.qty': 'Quantity',
  'stock.unit': 'Unit',
  'stock.variant': 'Variant',
  // Settings
  'settings.business_mgmt': 'Business Management',
  'settings.business_note': 'Each business has its own name, PAN, and bill number sequence. Inventory, prices, and customers are shared across both.',
  'settings.vat_enable': 'Enable VAT on bills',
  'settings.vat_rate': 'VAT rate (%)',
  'settings.vat_hint': 'Nepal standard rate is 13%',
  'settings.pin_changed': 'PIN changed successfully',
  'settings.pin_min': 'New PIN must be at least 4 digits',
  'settings.pin_mismatch': 'PINs do not match',
  'settings.saved': 'Saved',
  'biz.name': 'Business name *',
  'biz.pan': 'PAN / VAT number',
  'biz.prefix': 'Bill prefix *',
  'biz.prefix_hint': 'Bills',
  // Reports
  'reports.bills_count': 'Bills',
  'reports.total_billed': 'Total Billed',
  'reports.collected_label': 'Collected',
  'reports.outstanding_label': 'Outstanding',
  'reports.today': 'Today',
  'reports.this_week': 'This week',
  'reports.this_month': 'This month',
  'reports.last_month': 'Last month',
  'reports.bill_num': 'Bill #',
  'reports.walk_in': 'Walk-in',
  'reports.no_bills': 'No bills in this period',
  'reports.total_qty': 'Total Qty',
  'reports.revenue': 'Revenue',
  'reports.no_sales': 'No sales in this period',
  'reports.no_customers': 'No customers',
  'reports.items_sold': 'Items Sold',
  'reports.customer_ledger': 'Customer Ledger',
  // Bills
  'bill.no_bills': 'No bills yet',
  'bill.line_items': 'Line Items',
  'bill.payment_history': 'Payment History',
  'bill.no_payments': 'No payments recorded',
  'bill.collect': 'Collect',
  'bill.amend': 'Amend',
  'bill.amend_title': 'Amend Bill',
  'bill.amend_reason_label': 'Reason for amendment *',
  'bill.amend_note': 'This bill will be cancelled and a new one will be pre-filled with its items. Both bills are kept for audit. Provide the reason below.',
  'bill.cancel_reissue': 'Cancel & Re-issue',
  'bill.sale_badge': 'Sale',
  'bill.processing_badge': 'Processing',
  'bill.walk_in': 'Walk-in',
  'bill.go_back': 'Go Back',
  'bill.method': 'Method',
  'bill.collecting': 'Collect payment',
  'bill.last_bills': 'Last {n} bills',
  // Customers
  'customer.none': 'No customers',
  'customer.combined': 'Combined',
  'customer.new': 'New Customer',
  'customer.edit': 'Edit Customer',
  'customer.date_time': 'Date & Time',
  'customer.bill_num': 'Bill #',
  'customer.debit': 'Debit',
  'customer.credit': 'Credit',
  'customer.description': 'Description',
  'customer.no_transactions': 'No transactions found',
  'customer.loading_statement': 'Loading statement…',
  'customer.outstanding_label': 'Outstanding',
  'customer.search': 'Search name or phone…',
  // Dashboard
  'dashboard.refresh': 'Refresh',
  'dashboard.today_sales': "Today's Sales",
  'dashboard.collected_today': 'Collected Today',
  'dashboard.cash_bank_digital': 'cash · bank · digital',
  'dashboard.all_clear': 'all clear',
  'dashboard.pending_udharo': 'pending udharo',
  'dashboard.distinct_items': 'distinct items',
  'dashboard.7day_trend': '7-Day Sales Trend',
  'dashboard.last_7_revenue': 'Last 7 days revenue',
  'dashboard.this_week': 'this week',
  'dashboard.no_sales_7d': 'No sales in the last 7 days',
  'dashboard.today_glance': 'Today at a Glance',
  'dashboard.billed': 'Billed',
  'dashboard.bills_today': 'Bills today',
  'dashboard.batches_today': 'Batches today',
  'dashboard.quick_actions': 'Quick Actions',
  'dashboard.total_outstanding_label': 'Total outstanding',
  'dashboard.loading': 'Loading dashboard…',
  'dashboard.error': 'Could not load dashboard. Please refresh.',
  // Items
  'items.add': '+ Add Item',
  'items.new': 'New Item',
  'items.edit': 'Edit Item',
  'items.none': 'No items found',
  'items.category': 'Category',
  'items.purpose': 'Purpose',
  'items.default_unit': 'Default Unit',
  'items.buyable': 'Buyable',
  'items.sellable': 'Sellable',
  'items.processable': 'Processable',
  'items.has_variants': 'Multiple variants',
  'items.variants': 'Variants',
  'items.add_variant': '+ Add Variant',
  'items.deactivate': 'Deactivate',
  // Stock In
  'stockin.supplier': 'Supplier',
  'stockin.supplier_optional': 'Supplier (optional)',
  'stockin.items': 'Items',
  'stockin.add_item': '+ Add Item',
  'stockin.notes': 'Notes',
  'stockin.save': 'Save Purchase',
  'stockin.saving': 'Saving…',
  'stockin.success': 'Purchase recorded',
  'stockin.history': 'Purchase History',
  'stockin.no_history': 'No purchases yet',
  'stockin.rate': 'Rate (Rs.)',
  'stockin.total': 'Total (Rs.)',
  // Common additions
  'common.update': 'Update',
  'common.create': 'Create',
  'common.back': 'Back',
  'common.type': 'Type',
  'common.business': 'Business',
  'common.bill': 'Bill',
  // New Bill page
  'bill.new_transaction': 'New Transaction',
  'bill.what_to_do': 'What would you like to do?',
  'bill.sale_sub': 'Sell items to a customer',
  'bill.processing_sub': 'Process grain and charge fee',
  'bill.credit_btn': 'Credit (Udharo)',
  'bill.pay_now_btn': 'Pay Now',
  'bill.pay_mode_section': 'Payment Mode',
  'bill.credit_required': '* required for credit',
  'bill.customer_processing_label': 'Customer (whose grain is being processed)',
  'bill.search_customer': 'Search by name or phone…',
  'bill.processing_items_label': 'Processed items (rate auto-filled from processing price)',
  'bill.items_label': 'Items',
  'bill.search_item': 'Search item…',
  'bill.no_items_yet': 'No items added yet',
  'bill.credit_note': 'Full amount goes to credit account (Udharo)',
  'bill.partial_label': 'Collect partial payment now? (optional)',
  'bill.summary_title': 'Summary',
  'bill.collected_now': 'Collected now',
  'bill.credit_balance': 'Credit (Due)',
  'bill.review_save_btn': 'Review & Save →',
  'bill.need_customer_credit': 'Select a customer for credit',
  'bill.confirm_title': 'Confirm',
  'bill.confirm_save_print': 'Confirm & Print',
  'bill.saving_label': 'Saving…',
  'bill.go_back_btn': 'Go Back',
  'bill.full_on_credit': 'Full amount on credit',
  'bill.cash_method': 'Cash',
  'bill.bank_method': 'Bank',
  'bill.digital_method': 'PhonePe / eSewa',
  'bill.outstanding_note': 'Outstanding',
  'bill.payment_section': 'Payment',
  'bill.paid_full_note': 'Full amount {amount} will be recorded as received',
  'bill.partial_collected_note': '{paid} collected now · {due} going to credit',
  'bill.going_to_credit': 'Going to credit',
}

const ne: Translations = {
  // Sidebar sections
  'section.sales': 'बिक्री',
  'section.inventory': 'भण्डार',
  'section.catalog': 'सूची',
  'section.system': 'प्रणाली',
  // Sidebar nav
  'nav.dashboard': 'ड्यासबोर्ड',
  'nav.new_bill': 'नयाँ बिल',
  'nav.bills': 'बिलहरू',
  'nav.customers': 'ग्राहकहरू',
  'nav.stock_in': 'स्टक भित्र्याउनु',
  'nav.stock': 'स्टक',
  'nav.suppliers': 'आपूर्तिकर्ता',
  'nav.mill_processing': 'मिल प्रशोधन',
  'nav.reports': 'प्रतिवेदन',
  'nav.settings': 'सेटिङ',
  'nav.items': 'वस्तुहरू',
  'nav.prices': 'मूल्यहरू',
  'nav.units': 'इकाइहरू',
  'nav.ledger': 'खाता बही',
  // Common
  'common.save': 'सुरक्षित गर्नुहोस्',
  'common.saving': 'सुरक्षित हुँदैछ…',
  'common.cancel': 'रद्द गर्नुहोस्',
  'common.close': 'बन्द गर्नुहोस्',
  'common.delete': 'मेट्नुहोस्',
  'common.edit': 'सम्पादन',
  'common.loading': 'लोड हुँदैछ…',
  'common.search': 'खोज्नुहोस्…',
  'common.all': 'सबै',
  'common.notes': 'टिप्पणी',
  'common.optional': 'ऐच्छिक',
  'common.date': 'मिति',
  'common.amount': 'रकम',
  'common.name': 'नाम',
  'common.phone': 'फोन',
  'common.address': 'ठेगाना',
  'common.status': 'स्थिति',
  'common.actions': 'कार्यहरू',
  'common.no_data': 'डेटा फेला परेन',
  'common.deactivate': 'निष्क्रिय गर्नुहोस्',
  'common.add': 'थप्नुहोस्',
  'common.confirm': 'पुष्टि गर्नुहोस्',
  'common.lock_session': 'सत्र बन्द',
  'common.language': 'भाषा',
  // Dashboard
  'dashboard.title': 'ड्यासबोर्ड',
  'dashboard.today_bills': 'आजका बिलहरू',
  'dashboard.total_billed': 'जम्मा बिल रकम',
  'dashboard.collected': 'असुल',
  'dashboard.new_udharo': 'नयाँ उधारो',
  'dashboard.outstanding': 'कुल बाँकी',
  'dashboard.stock_items': 'स्टक वस्तुहरू',
  'dashboard.processing_today': 'आजका ब्याचहरू',
  'dashboard.weekly_sales': 'साप्ताहिक बिक्री (७ दिन)',
  // Bills
  'bill.new': 'नयाँ बिल',
  'bill.type_sale': 'बिक्री',
  'bill.type_processing': 'ग्राहक प्रशोधन',
  'bill.number': 'बिल नं.',
  'bill.customer': 'ग्राहक',
  'bill.item': 'वस्तु',
  'bill.variant': 'प्रकार',
  'bill.qty': 'परिमाण',
  'bill.rate': 'दर',
  'bill.total': 'जम्मा',
  'bill.subtotal': 'उप-जम्मा',
  'bill.discount': 'छूट',
  'bill.grand_total': 'ग्राण्ड जम्मा',
  'bill.paid': 'तिरेको',
  'bill.due': 'बाँकी (उधारो)',
  'bill.payment_method': 'भुक्तानी विधि',
  'bill.cash': 'नगद',
  'bill.bank': 'बैंक ट्रान्सफर',
  'bill.digital': 'डिजिटल (eSewa/IME)',
  'bill.credit': 'उधारो',
  'bill.confirm': 'पुष्टि गर्नुहोस् र सुरक्षित',
  'bill.business': 'व्यवसाय',
  'bill.which_business': 'कुन व्यवसायबाट बिल जारी गर्ने?',
  'bill.type': 'प्रकार',
  'bill.status': 'स्थिति',
  'bill.collect_payment': 'भुक्तानी संकलन',
  'bill.cancel': 'बिल रद्द',
  'bill.print': 'प्रिन्ट',
  'bill.printing': 'प्रिन्ट हुँदैछ…',
  'bill.all_businesses': 'सबै',
  // Customers
  'customer.title': 'ग्राहकहरू',
  'customer.statement': 'विवरण',
  'customer.outstanding': 'बाँकी',
  'customer.last_bill': 'अन्तिम बिल',
  'customer.add': 'ग्राहक थप्नुहोस्',
  'customer.total_billed': 'जम्मा बिल',
  'customer.total_paid': 'जम्मा तिरेको',
  // Settings
  'settings.title': 'सेटिङ',
  'settings.business': 'व्यवसाय',
  'settings.language': 'भाषा र क्षेत्र',
  'settings.change_pin': 'पिन परिवर्तन',
  'settings.current_pin': 'हालको पिन',
  'settings.new_pin': 'नयाँ पिन',
  'settings.confirm_pin': 'नयाँ पिन पुष्टि',
  'settings.vat': 'VAT / कर सेटिङ',
  // Reports
  'reports.title': 'प्रतिवेदन',
  'reports.sales': 'बिक्री प्रतिवेदन',
  'reports.items': 'वस्तु बिक्री',
  'reports.ledger': 'ग्राहक खाता',
  'reports.from': 'देखि',
  'reports.to': 'सम्म',
  'reports.run': 'प्रतिवेदन चलाउनुहोस्',
  // Mill Processing
  'mill.title': 'मिल प्रशोधन',
  'mill.subtitle': 'आफ्नो स्टक प्रशोधन गर्नुहोस् — बिल बन्दैन',
  'mill.input_section': 'इनपुट',
  'mill.input_item': 'इनपुट वस्तु',
  'mill.input_qty': 'परिमाण',
  'mill.input_variant': 'प्रकार',
  'mill.input_unit': 'इकाइ',
  'mill.outputs_section': 'आउटपुटहरू',
  'mill.add_output': '+ आउटपुट थप्नुहोस्',
  'mill.yield_pct': 'उत्पादन %',
  'mill.expected': 'अपेक्षित',
  'mill.actual_qty': 'वास्तविक परिमाण',
  'mill.run_batch': 'ब्याच चलाउनुहोस्',
  'mill.running': 'प्रशोधन हुँदैछ…',
  'mill.recent': 'हालका ब्याचहरू',
  'mill.no_batches': 'अहिलेसम्म कुनै ब्याच छैन',
  'mill.batch_done': 'ब्याच रेकर्ड भयो — स्टक अपडेट भयो',
  'mill.search_input': 'प्रशोधन गर्ने वस्तु खोज्नुहोस्…',
  'mill.search_output': 'आउटपुट वस्तु खोज्नुहोस्…',
  'mill.output_item': 'आउटपुट वस्तु',
  // Stock In
  'stockin.title': 'स्टक भित्र्याउनु',
  'stockin.new': 'नयाँ खरिद',
  // Stock
  'stock.title': 'स्टक',
  // Suppliers
  'supplier.title': 'आपूर्तिकर्ता',
  // Items
  'items.title': 'वस्तुहरू',
  // Prices
  'prices.title': 'मूल्यहरू',
  // Units
  'units.title': 'इकाइहरू',
  'units.add': '+ इकाइ थप्नुहोस्',
  'units.new': 'नयाँ इकाइ',
  'units.edit': 'इकाइ सम्पादन',
  'units.abbr': 'संक्षेप',
  'units.base_factor': 'आधार गुणक',
  'units.default_label': 'पूर्वनिर्धारित',
  'units.set_default': 'पूर्वनिर्धारित बनाउनुहोस्',
  'units.none': 'कुनै इकाइ परिभाषित छैन',
  // Suppliers
  'supplier.add': '+ आपूर्तिकर्ता थप्नुहोस्',
  'supplier.new': 'नयाँ आपूर्तिकर्ता',
  'supplier.edit': 'आपूर्तिकर्ता सम्पादन',
  'supplier.none': 'कोही आपूर्तिकर्ता छैन',
  // Prices
  'prices.sell_tab': 'बिक्री मूल्य',
  'prices.processing_tab': 'प्रशोधन शुल्क',
  'prices.sell_label': 'बिक्री मूल्य',
  'prices.processing_label': 'प्रशोधन शुल्क',
  'prices.since': 'देखि',
  'prices.not_set': 'सेट गरिएको छैन',
  'prices.update': 'अपडेट',
  'prices.set_price': 'मूल्य सेट गर्नुहोस्',
  'prices.effective_from': 'मिति देखि',
  // Stock
  'stock.add': '+ प्रारम्भिक स्टक',
  'stock.form_title': 'प्रारम्भिक स्टक प्रविष्ट',
  'stock.buy_price': 'खरिद मूल्य (रु.)',
  'stock.record': 'स्टक रेकर्ड',
  'stock.balance': 'ब्यालेन्स',
  'stock.category': 'श्रेणी',
  'stock.none': 'अहिलेसम्म कुनै स्टक रेकर्ड छैन — प्रारम्भिक स्टक थप्नुहोस्',
  'stock.item': 'वस्तु',
  'stock.qty': 'परिमाण',
  'stock.unit': 'इकाइ',
  'stock.variant': 'प्रकार',
  // Settings
  'settings.business_mgmt': 'व्यवसाय व्यवस्थापन',
  'settings.business_note': 'प्रत्येक व्यवसायको आफ्नै नाम, PAN र बिल नम्बर क्रम छ। भण्डार, मूल्य र ग्राहकहरू साझा छन्।',
  'settings.vat_enable': 'बिलमा VAT सक्षम गर्नुहोस्',
  'settings.vat_rate': 'VAT दर (%)',
  'settings.vat_hint': 'नेपालको मानक दर १३% हो',
  'settings.pin_changed': 'पिन सफलतापूर्वक परिवर्तन भयो',
  'settings.pin_min': 'नयाँ पिन कम्तीमा ४ अंकको हुनुपर्छ',
  'settings.pin_mismatch': 'पिन मेल खाएन',
  'settings.saved': 'सुरक्षित भयो',
  'biz.name': 'व्यवसायको नाम *',
  'biz.pan': 'PAN / VAT नम्बर',
  'biz.prefix': 'बिल उपसर्ग *',
  'biz.prefix_hint': 'बिल',
  // Reports
  'reports.bills_count': 'बिलहरू',
  'reports.total_billed': 'जम्मा बिल',
  'reports.collected_label': 'असुल',
  'reports.outstanding_label': 'बाँकी',
  'reports.today': 'आज',
  'reports.this_week': 'यो हप्ता',
  'reports.this_month': 'यो महिना',
  'reports.last_month': 'गत महिना',
  'reports.bill_num': 'बिल नं.',
  'reports.walk_in': 'वाक-इन',
  'reports.no_bills': 'यस अवधिमा कुनै बिल छैन',
  'reports.total_qty': 'जम्मा परिमाण',
  'reports.revenue': 'राजस्व',
  'reports.no_sales': 'यस अवधिमा कुनै बिक्री छैन',
  'reports.no_customers': 'कोही ग्राहक छैन',
  'reports.items_sold': 'बेचेका वस्तुहरू',
  'reports.customer_ledger': 'ग्राहक खाता',
  // Bills
  'bill.no_bills': 'अहिलेसम्म कुनै बिल छैन',
  'bill.line_items': 'लाइन वस्तुहरू',
  'bill.payment_history': 'भुक्तानी इतिहास',
  'bill.no_payments': 'कुनै भुक्तानी रेकर्ड छैन',
  'bill.collect': 'असुल',
  'bill.amend': 'सुधार',
  'bill.amend_title': 'बिल सुधार',
  'bill.amend_reason_label': 'संशोधनको कारण *',
  'bill.amend_note': 'यो बिल रद्द हुनेछ र नयाँ बिलमा यसका वस्तुहरू पूर्वभरण हुनेछन्। दुवै बिल अडिटका लागि राखिन्छन्। कारण तल उल्लेख गर्नुहोस्।',
  'bill.cancel_reissue': 'रद्द र पुनः जारी',
  'bill.sale_badge': 'बिक्री',
  'bill.processing_badge': 'प्रशोधन',
  'bill.walk_in': 'वाक-इन',
  'bill.go_back': 'फिर्ता जानुहोस्',
  'bill.method': 'विधि',
  'bill.collecting': 'भुक्तानी असुल',
  'bill.last_bills': 'पछिल्ला {n} बिलहरू',
  // Customers
  'customer.none': 'कोही ग्राहक छैन',
  'customer.combined': 'संयुक्त',
  'customer.new': 'नयाँ ग्राहक',
  'customer.edit': 'ग्राहक सम्पादन',
  'customer.date_time': 'मिति र समय',
  'customer.bill_num': 'बिल नं.',
  'customer.debit': 'डेबिट',
  'customer.credit': 'क्रेडिट',
  'customer.description': 'विवरण',
  'customer.no_transactions': 'कुनै लेनदेन फेला परेन',
  'customer.loading_statement': 'विवरण लोड हुँदैछ…',
  'customer.outstanding_label': 'बाँकी',
  'customer.search': 'नाम वा फोन खोज्नुहोस्…',
  // Dashboard
  'dashboard.refresh': 'रिफ्रेस',
  'dashboard.today_sales': 'आजको बिक्री',
  'dashboard.collected_today': 'आज असुल',
  'dashboard.cash_bank_digital': 'नगद · बैंक · डिजिटल',
  'dashboard.all_clear': 'सब ठीक',
  'dashboard.pending_udharo': 'बाँकी उधारो',
  'dashboard.distinct_items': 'फरक वस्तुहरू',
  'dashboard.7day_trend': '७-दिन बिक्री ट्रेन्ड',
  'dashboard.last_7_revenue': 'पछिल्लो ७ दिनको राजस्व',
  'dashboard.this_week': 'यो हप्ता',
  'dashboard.no_sales_7d': 'पछिल्लो ७ दिनमा कोई बिक्री छैन',
  'dashboard.today_glance': 'आजको सारांश',
  'dashboard.billed': 'बिल गरिएको',
  'dashboard.bills_today': 'आजका बिलहरू',
  'dashboard.batches_today': 'आजका ब्याचहरू',
  'dashboard.quick_actions': 'द्रुत कार्यहरू',
  'dashboard.total_outstanding_label': 'कुल बाँकी',
  'dashboard.loading': 'ड्यासबोर्ड लोड हुँदैछ…',
  'dashboard.error': 'ड्यासबोर्ड लोड गर्न सकिएन। कृपया रिफ्रेस गर्नुहोस्।',
  // Items
  'items.add': '+ वस्तु थप्नुहोस्',
  'items.new': 'नयाँ वस्तु',
  'items.edit': 'वस्तु सम्पादन',
  'items.none': 'कुनै वस्तु फेला परेन',
  'items.category': 'श्रेणी',
  'items.purpose': 'उद्देश्य',
  'items.default_unit': 'पूर्वनिर्धारित इकाइ',
  'items.buyable': 'खरिद योग्य',
  'items.sellable': 'बिक्री योग्य',
  'items.processable': 'प्रशोधन योग्य',
  'items.has_variants': 'धेरै प्रकार',
  'items.variants': 'प्रकारहरू',
  'items.add_variant': '+ प्रकार थप्नुहोस्',
  'items.deactivate': 'निष्क्रिय',
  // Stock In
  'stockin.supplier': 'आपूर्तिकर्ता',
  'stockin.supplier_optional': 'आपूर्तिकर्ता (ऐच्छिक)',
  'stockin.items': 'वस्तुहरू',
  'stockin.add_item': '+ वस्तु थप्नुहोस्',
  'stockin.notes': 'टिप्पणी',
  'stockin.save': 'खरिद सुरक्षित',
  'stockin.saving': 'सुरक्षित हुँदैछ…',
  'stockin.success': 'खरिद रेकर्ड भयो',
  'stockin.history': 'खरिद इतिहास',
  'stockin.no_history': 'अहिलेसम्म कुनै खरिद छैन',
  'stockin.rate': 'दर (रु.)',
  'stockin.total': 'जम्मा (रु.)',
  // Common additions
  'common.update': 'अपडेट',
  'common.create': 'बनाउनुहोस्',
  'common.back': 'फिर्ता',
  'common.type': 'प्रकार',
  'common.business': 'व्यवसाय',
  'common.bill': 'बिल',
  // New Bill page
  'bill.new_transaction': 'नयाँ कारोबार',
  'bill.what_to_do': 'के गर्न चाहनुहुन्छ?',
  'bill.sale_sub': 'ग्राहकलाई सामान बेच्नुस्',
  'bill.processing_sub': 'ग्राहकको अन्न पिस्नुस् र शुल्क लिनुस्',
  'bill.credit_btn': 'उधारो (क्रेडिट)',
  'bill.pay_now_btn': 'अहिले तिर्नुस्',
  'bill.pay_mode_section': 'भुक्तानी विधि',
  'bill.credit_required': '* उधारोको लागि आवश्यक',
  'bill.customer_processing_label': 'ग्राहक (जसको अन्न प्रशोधन हुँदैछ)',
  'bill.search_customer': 'नाम वा फोनले खोज्नुस्…',
  'bill.processing_items_label': 'प्रशोधित वस्तुहरू (दर प्रशोधन मूल्यबाट स्वतः भरिन्छ)',
  'bill.items_label': 'वस्तुहरू',
  'bill.search_item': 'वस्तु खोज्नुस्…',
  'bill.no_items_yet': 'अहिलेसम्म कुनै वस्तु थपिएको छैन',
  'bill.credit_note': 'पूरै रकम उधारोमा (क्रेडिट खातामा) जान्छ',
  'bill.partial_label': 'अहिले आंशिक रकम संकलन गर्नुस्? (ऐच्छिक)',
  'bill.summary_title': 'सारांश',
  'bill.collected_now': 'अहिले संकलन',
  'bill.credit_balance': 'उधारो (बाँकी)',
  'bill.review_save_btn': 'समीक्षा गर्नुस् र सुरक्षित गर्नुस् →',
  'bill.need_customer_credit': 'उधारोको लागि ग्राहक छान्नुस्',
  'bill.confirm_title': 'पुष्टि गर्नुस्',
  'bill.confirm_save_print': 'पुष्टि गर्नुस् र छाप्नुस्',
  'bill.saving_label': 'सुरक्षित गर्दैछ…',
  'bill.go_back_btn': 'फिर्ता जानुस्',
  'bill.full_on_credit': 'पूरै रकम उधारोमा',
  'bill.cash_method': 'नगद',
  'bill.bank_method': 'बैंक',
  'bill.digital_method': 'फोनपे / ई-सेवा',
  'bill.outstanding_note': 'बाँकी',
  'bill.payment_section': 'भुक्तानी',
  'bill.paid_full_note': 'पूरै रकम {amount} प्राप्त भयो भनी दर्ता हुनेछ',
  'bill.partial_collected_note': '{paid} अहिले संकलन · {due} उधारोमा बाँकी',
  'bill.going_to_credit': 'उधारोमा जाने',
}

// ─── Context ───────────────────────────────────────────────────────────────
export type Lang = 'en' | 'ne'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, fallback?: string) => string
  fmtDate: (dateStr: string) => string
  fmtAmt: (n: number) => string
  fmtNum: (n: number | string) => string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k, f) => f ?? k,
  fmtDate: s => s,
  fmtAmt: n => `Rs. ${n.toFixed(2)}`,
  fmtNum: n => String(n),
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    window.api.settings.get('ui_language').then(v => {
      if (v === 'ne') setLangState('ne')
    }).catch(() => {})
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    window.api.settings.set('ui_language', l).catch(() => {})
  }

  function t(key: string, fallback?: string): string {
    const dict = lang === 'ne' ? ne : en
    return dict[key] ?? fallback ?? key
  }

  function fmtDate(dateStr: string): string {
    if (lang === 'ne') return formatDateBS(dateStr)
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  function fmtAmt(n: number): string {
    if (lang === 'ne') return formatAmountNe(n)
    return 'Rs. ' + n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
  }

  function fmtNum(n: number | string): string {
    if (lang === 'ne') return toNepaliNum(n)
    return String(n)
  }

  return createElement(LanguageContext.Provider, { value: { lang, setLang, t, fmtDate, fmtAmt, fmtNum } }, children)
}

export function useLanguage(): LangCtx {
  return useContext(LanguageContext)
}
