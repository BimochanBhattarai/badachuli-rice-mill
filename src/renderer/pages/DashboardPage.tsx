import { useEffect, useState } from 'react'
import type { DashboardData } from '../../shared/types/api'

export default function DashboardPage() {
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

  function fmt(n: number) {
    return n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
  }

  function today() {
    return new Date().toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  if (loading) return <div className="splash"><p>Loading…</p></div>
  if (!data) return <div className="placeholder-page"><p>Could not load dashboard</p></div>

  const { today: t } = data

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <span className="text-muted">{today()}</span>
        <button className="btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      {/* ── Today cards ──────────────────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          label="Today's Sales"
          value={`Rs. ${fmt(t.total_billed)}`}
          sub={`${t.bill_count} bill${t.bill_count !== 1 ? 's' : ''}`}
          accent="green"
        />
        <StatCard
          label="Collected Today"
          value={`Rs. ${fmt(t.total_collected)}`}
          sub="cash + bank + digital"
          accent="blue"
        />
        <StatCard
          label="New Udharo Today"
          value={`Rs. ${fmt(t.new_udharo)}`}
          sub="credit sales today"
          accent={t.new_udharo > 0 ? 'red' : 'neutral'}
        />
        <StatCard
          label="Total Outstanding"
          value={`Rs. ${fmt(data.total_outstanding)}`}
          sub="all pending udharo"
          accent={data.total_outstanding > 0 ? 'red' : 'neutral'}
        />
        <StatCard
          label="Items in Stock"
          value={String(data.stock_item_count)}
          sub="distinct items"
          accent="neutral"
        />
        <StatCard
          label="Batches Today"
          value={String(data.processing_batches_today)}
          sub="processing runs"
          accent="neutral"
        />
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub: string
  accent: 'green' | 'blue' | 'red' | 'neutral'
}) {
  const colors = {
    green:   { border: '#166534', bg: '#052e16', val: '#86efac' },
    blue:    { border: '#1e3a5f', bg: '#0c1a2e', val: '#93c5fd' },
    red:     { border: '#7f1d1d', bg: '#2d0a0a', val: '#fca5a5' },
    neutral: { border: '#1f2937', bg: '#111827', val: '#f9fafb' },
  }
  const c = colors[accent]
  return (
    <div className="stat-card" style={{ borderColor: c.border, background: c.bg }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: c.val }}>{value}</span>
      <span className="stat-sub">{sub}</span>
    </div>
  )
}
