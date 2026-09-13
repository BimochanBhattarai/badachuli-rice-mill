import { useEffect, useState, type ElementType } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Wallet, AlertCircle, Package,
  ReceiptText, PackagePlus, Cpu, BarChart3,
  RefreshCw, Calendar,
} from 'lucide-react'
import type { DashboardData, BusinessRow } from '@shared/types/api'
import { useLanguage } from '../i18n'

type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers'
  | 'stockin' | 'suppliers' | 'mill-processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

interface Props {
  onNavigate: (page: NavPage) => void
}

const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_NE = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि']

export default function DashboardPage({ onNavigate }: Props) {
  const { t, lang, fmtAmt, fmtDate } = useLanguage()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [businessFilter, setBusinessFilter] = useState<number | null>(null)

  const DAY_LABELS = lang === 'ne' ? DAY_LABELS_NE : DAY_LABELS_EN

  function formatShortDate(dateStr: string) {
    const d = new Date(dateStr)
    return DAY_LABELS[d.getDay()]
  }

  function todayLabel() {
    if (lang === 'ne') return fmtDate(new Date().toISOString())
    return new Date().toLocaleDateString('en-NP', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  async function load(bizId?: number | null) {
    setLoading(true)
    try {
      const id = bizId ?? businessFilter ?? undefined
      const res = await window.api.dashboard.getData(id)
      if (res.ok && res.data) setData(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.api.businesses.getAll().then(r => { if (r.ok && r.data) setBusinesses(r.data) })
  }, [])

  useEffect(() => { load() }, [businessFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-stone-500">{t('dashboard.loading')}</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        {t('dashboard.error')}
      </div>
    )
  }

  const { today: todayData, weekly_sales } = data
  const chartData = weekly_sales.map(d => ({
    day: formatShortDate(d.date),
    total: d.total,
    date: d.date,
  }))

  const weekTotal = weekly_sales.reduce((sum, d) => sum + d.total, 0)
  const hasOutstanding = data.total_outstanding > 0

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">{t('dashboard.title')}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-stone-500 text-sm">
            <Calendar size={13} />
            <span>{todayLabel()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {businesses.length > 0 && (
            <div className="biz-filter-tabs" style={{ marginBottom: 0 }}>
              <button
                className={`biz-filter-tab${businessFilter === null ? ' biz-filter-tab-active' : ''}`}
                onClick={() => setBusinessFilter(null)}
              >{t('common.all')}</button>
              {businesses.map(b => (
                <button
                  key={b.id}
                  className={`biz-filter-tab${businessFilter === b.id ? ' biz-filter-tab-active' : ''}`}
                  onClick={() => setBusinessFilter(b.id)}
                >{b.name}</button>
              ))}
            </div>
          )}
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors"
          >
            <RefreshCw size={14} />
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {/* ── Today's stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.today_sales')}
          value={fmtAmt(todayData.total_billed)}
          sub={`${todayData.bill_count} ${t('dashboard.bills_today')}`}
          icon={TrendingUp}
          style="orange"
        />
        <StatCard
          label={t('dashboard.collected_today')}
          value={fmtAmt(todayData.total_collected)}
          sub={t('dashboard.cash_bank_digital')}
          icon={Wallet}
          style="green"
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={fmtAmt(data.total_outstanding)}
          sub={hasOutstanding ? t('dashboard.pending_udharo') : t('dashboard.all_clear')}
          icon={AlertCircle}
          style={hasOutstanding ? 'red' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.stock_items')}
          value={String(data.stock_item_count)}
          sub={t('dashboard.distinct_items')}
          icon={Package}
          style="amber"
        />
      </div>

      {/* ── Charts row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-800">{t('dashboard.7day_trend')}</h3>
              <p className="text-xs text-stone-400 mt-0.5">{t('dashboard.last_7_revenue')}</p>
            </div>
            <div className="px-3 py-1 bg-orange-50 rounded-full border border-orange-200">
              <span className="text-xs font-bold text-orange-600">{fmtAmt(weekTotal)} {t('dashboard.this_week')}</span>
            </div>
          </div>
          <div className="px-5 pb-5">
            {weekTotal === 0 ? (
              <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
                {t('dashboard.no_sales_7d')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f2ede8" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#a8a29e', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                  />
                  <Tooltip
                    cursor={{ fill: '#f2ede8' }}
                    contentStyle={{
                      background: '#1c1917',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#fff',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    }}
                    formatter={(v) => [fmtAmt(Number(v)), t('reports.sales')]}
                    labelStyle={{ color: '#f97316', fontWeight: 700, marginBottom: 2 }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#f97316"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Today summary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col gap-0">
          <h3 className="text-sm font-bold text-stone-800 mb-4">{t('dashboard.today_glance')}</h3>
          <GlanceRow label={t('dashboard.billed')} value={fmtAmt(todayData.total_billed)} />
          <GlanceRow label={t('dashboard.collected')} value={fmtAmt(todayData.total_collected)} color="text-green-600" />
          {todayData.new_udharo > 0 && (
            <GlanceRow label={t('dashboard.new_udharo')} value={fmtAmt(todayData.new_udharo)} color="text-red-500" />
          )}
          <div className="border-t border-stone-100 my-3" />
          <GlanceRow label={t('dashboard.bills_today')} value={String(todayData.bill_count)} small />
          <GlanceRow label={t('dashboard.batches_today')} value={String(data.processing_batches_today)} small />
          {data.total_outstanding > 0 && (
            <>
              <div className="border-t border-stone-100 my-3" />
              <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <span className="text-xs font-semibold text-red-600">{t('dashboard.total_outstanding_label')}</span>
                <span className="text-sm font-extrabold text-red-600">{fmtAmt(data.total_outstanding)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-stone-800 mb-4">{t('dashboard.quick_actions')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction label={t('nav.new_bill')}      icon={ReceiptText} color="bg-orange-500" hover="hover:shadow-orange-200" onClick={() => onNavigate('billing')} />
          <QuickAction label={t('nav.stock_in')}      icon={PackagePlus} color="bg-amber-500"  hover="hover:shadow-amber-200"  onClick={() => onNavigate('stockin')} />
          <QuickAction label={t('nav.mill_processing')} icon={Cpu}       color="bg-yellow-500" hover="hover:shadow-yellow-200" onClick={() => onNavigate('mill-processing')} />
          <QuickAction label={t('nav.reports')}       icon={BarChart3}   color="bg-stone-700"  hover="hover:shadow-stone-200"  onClick={() => onNavigate('reports')} />
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

const STAT_STYLES = {
  orange:  { bg: 'bg-gradient-to-br from-orange-500 to-orange-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-orange-100', label: 'text-orange-100', shadow: 'shadow-orange-200' },
  green:   { bg: 'bg-white',                                         icon: 'bg-green-100',  text: 'text-stone-800', sub: 'text-stone-400', label: 'text-stone-500',  shadow: '' },
  red:     { bg: 'bg-white',                                         icon: 'bg-red-100',    text: 'text-stone-800', sub: 'text-stone-400', label: 'text-stone-500',  shadow: '' },
  amber:   { bg: 'bg-white',                                         icon: 'bg-amber-100',  text: 'text-stone-800', sub: 'text-stone-400', label: 'text-stone-500',  shadow: '' },
  neutral: { bg: 'bg-white',                                         icon: 'bg-stone-100',  text: 'text-stone-800', sub: 'text-stone-400', label: 'text-stone-500',  shadow: '' },
}

const STAT_ICON_COLORS = {
  orange: 'text-white',
  green:  'text-green-600',
  red:    'text-red-500',
  amber:  'text-amber-600',
  neutral:'text-stone-400',
}

function StatCard({
  label, value, sub, icon: Icon, style,
}: {
  label: string
  value: string
  sub: string
  icon: ElementType
  style: keyof typeof STAT_STYLES
}) {
  const s = STAT_STYLES[style]
  return (
    <div className={`rounded-2xl p-5 ${s.bg} border border-stone-200 shadow-sm ${s.shadow} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-700 uppercase tracking-widest ${s.label}`}>{label}</span>
        <div className={`p-2 rounded-xl ${s.icon}`}>
          <Icon size={16} className={STAT_ICON_COLORS[style]} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-extrabold leading-tight ${s.text}`}>{value}</p>
        <p className={`text-xs mt-0.5 ${s.sub}`}>{sub}</p>
      </div>
    </div>
  )
}

function GlanceRow({ label, value, color = 'text-stone-800', small = false }: {
  label: string
  value: string
  color?: string
  small?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-stone-500 ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
      <span className={`font-bold ${small ? 'text-xs' : 'text-sm'} ${color}`}>{value}</span>
    </div>
  )
}

function QuickAction({ label, icon: Icon, color, hover, onClick }: {
  label: string
  icon: ElementType
  color: string
  hover: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-stone-300 hover:shadow-md ${hover} transition-all group cursor-pointer`}
    >
      <div className={`p-2.5 rounded-xl ${color} shadow-sm group-hover:scale-105 transition-transform`}>
        <Icon size={17} className="text-white" />
      </div>
      <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-800">{label}</span>
    </button>
  )
}
