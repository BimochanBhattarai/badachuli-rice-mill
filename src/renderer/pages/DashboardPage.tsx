import { useEffect, useState, type ElementType } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Wallet, AlertCircle, Package,
  ReceiptText, PackagePlus, Cpu, BarChart3,
  RefreshCw, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DashboardData } from '@shared/types/api'

type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers'
  | 'stockin' | 'suppliers' | 'processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

interface Props {
  onNavigate: (page: NavPage) => void
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return DAY_LABELS[d.getDay()]
}

function fmt(n: number) {
  if (n >= 100000) return `Rs. ${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `Rs. ${(n / 1000).toFixed(1)}K`
  return `Rs. ${n.toLocaleString('en-NP', { minimumFractionDigits: 0 })}`
}

function fmtFull(n: number) {
  return `Rs. ${n.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
}

function todayLabel() {
  return new Date().toLocaleDateString('en-NP', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function DashboardPage({ onNavigate }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await window.api.dashboard.getData()
      if (res.ok && res.data) setData(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-stone-500">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        Could not load dashboard. Please refresh.
      </div>
    )
  }

  const { today: t, weekly_sales } = data
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
          <h1 className="text-xl font-bold text-stone-800">Dashboard</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-stone-500 text-sm">
            <Calendar size={13} />
            <span>{todayLabel()}</span>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── Today's stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={fmtFull(t.total_billed)}
          sub={`${t.bill_count} bill${t.bill_count !== 1 ? 's' : ''} today`}
          icon={TrendingUp}
          iconColor="text-orange-500"
          iconBg="bg-orange-100"
          accent
        />
        <StatCard
          label="Collected Today"
          value={fmtFull(t.total_collected)}
          sub="cash + bank + digital"
          icon={Wallet}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          label="Total Outstanding"
          value={fmtFull(data.total_outstanding)}
          sub={hasOutstanding ? 'pending udharo' : 'all clear'}
          icon={AlertCircle}
          iconColor={hasOutstanding ? 'text-red-500' : 'text-stone-400'}
          iconBg={hasOutstanding ? 'bg-red-100' : 'bg-stone-100'}
        />
        <StatCard
          label="Items in Stock"
          value={String(data.stock_item_count)}
          sub="distinct items"
          icon={Package}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
      </div>

      {/* ── Charts row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 7-day sales bar chart */}
        <Card className="lg:col-span-2 border-orange-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-stone-700">
                7-Day Sales Trend
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-medium text-orange-700 bg-orange-100">
                {fmt(weekTotal)} this week
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {weekTotal === 0 ? (
              <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
                No sales in the last 7 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
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
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #fdba74',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#1c1917',
                    }}
                    formatter={(v) => [`Rs. ${Number(v).toLocaleString('en-NP')}`, 'Sales']}
                    labelStyle={{ color: '#a16207', fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Today summary card */}
        <Card className="border-orange-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Today at a Glance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            <SummaryRow label="Billed" value={fmtFull(t.total_billed)} />
            <SummaryRow label="Collected" value={fmtFull(t.total_collected)} color="text-green-600" />
            {t.new_udharo > 0 && (
              <SummaryRow label="New Udharo" value={fmtFull(t.new_udharo)} color="text-red-500" />
            )}
            <div className="border-t border-orange-100 my-1" />
            <SummaryRow label="Bills today" value={String(t.bill_count)} />
            <SummaryRow label="Batches today" value={String(data.processing_batches_today)} />
            {data.total_outstanding > 0 && (
              <>
                <div className="border-t border-orange-100 my-1" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Total outstanding</span>
                  <span className="font-bold text-red-500">{fmtFull(data.total_outstanding)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick actions ─────────────────────────────────────── */}
      <Card className="border-orange-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-stone-700">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction
              label="New Bill"
              icon={ReceiptText}
              color="bg-orange-500"
              onClick={() => onNavigate('billing')}
            />
            <QuickAction
              label="Stock-In"
              icon={PackagePlus}
              color="bg-amber-500"
              onClick={() => onNavigate('stockin')}
            />
            <QuickAction
              label="Processing"
              icon={Cpu}
              color="bg-yellow-500"
              onClick={() => onNavigate('processing')}
            />
            <QuickAction
              label="Reports"
              icon={BarChart3}
              color="bg-stone-500"
              onClick={() => onNavigate('reports')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg, accent,
}: {
  label: string
  value: string
  sub: string
  icon: ElementType
  iconColor: string
  iconBg: string
  accent?: boolean
}) {
  return (
    <Card className={`border-orange-100 ${accent ? 'bg-gradient-to-br from-orange-50 to-amber-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-bold text-stone-800 leading-tight truncate">{value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${iconBg} flex-shrink-0 ml-2`}>
            <Icon size={18} className={iconColor} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value, color = 'text-stone-800' }: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-stone-500">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function QuickAction({ label, icon: Icon, color, onClick }: {
  label: string
  icon: ElementType
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-orange-100 hover:border-orange-300 hover:bg-orange-50 transition-all group cursor-pointer"
    >
      <div className={`p-2.5 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
        <Icon size={18} className="text-white" />
      </div>
      <span className="text-xs font-medium text-stone-600 group-hover:text-orange-700">{label}</span>
    </button>
  )
}
