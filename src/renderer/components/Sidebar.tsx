import { type ElementType } from 'react'
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, PackagePlus,
  Truck, Cpu, BarChart3, Package, Tag, Boxes, Ruler,
  Settings, LogOut, User, Cog, BookOpen, ChevronLeft, ChevronRight, Wallet,
} from 'lucide-react'
import type { AuthUser } from '@shared/types'
import { useLanguage, type Lang } from '../i18n'

export type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers' | 'ledger'
  | 'stockin' | 'suppliers' | 'mill-processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'
  | 'customer-report'
  | 'expenses'

interface Props {
  page: NavPage
  setPage: (p: NavPage) => void
  currentUser: AuthUser
  onLogout: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

interface NavItem { id: NavPage; labelKey: string; icon: ElementType }
interface NavSection { labelKey: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    labelKey: '',
    items: [{ id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'section.sales',
    items: [
      { id: 'billing',   labelKey: 'nav.new_bill',   icon: ReceiptText },
      { id: 'bills',     labelKey: 'nav.bills',       icon: ClipboardList },
      { id: 'customers', labelKey: 'nav.customers',   icon: Users },
      { id: 'ledger',    labelKey: 'nav.ledger',      icon: BookOpen },
    ],
  },
  {
    labelKey: 'section.inventory',
    items: [
      { id: 'stockin',         labelKey: 'nav.stock_in',        icon: PackagePlus },
      { id: 'stock',           labelKey: 'nav.stock',           icon: Boxes },
      { id: 'suppliers',       labelKey: 'nav.suppliers',       icon: Truck },
      { id: 'mill-processing', labelKey: 'nav.mill_processing', icon: Cpu },
    ],
  },
  {
    labelKey: 'section.catalog',
    items: [
      { id: 'items',  labelKey: 'nav.items',  icon: Package },
      { id: 'prices', labelKey: 'nav.prices', icon: Tag },
      { id: 'units',  labelKey: 'nav.units',  icon: Ruler },
    ],
  },
  {
    labelKey: 'section.finance',
    items: [
      { id: 'expenses', labelKey: 'nav.expenses', icon: Wallet },
    ],
  },
  {
    labelKey: 'section.system',
    items: [
      { id: 'reports',  labelKey: 'nav.reports',  icon: BarChart3 },
      { id: 'settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ page, setPage, currentUser, onLogout, collapsed, onToggleCollapse }: Props) {
  const { t, lang, setLang } = useLanguage()

  function toggleLang() {
    setLang(lang === 'en' ? 'ne' : 'en' as Lang)
  }

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      {/* Brand + collapse toggle */}
      <div className="sidebar-brand">
        {!collapsed && (
          <>
            <span className="sidebar-brand-name">Badachuli</span>
            <span className="sidebar-brand-sub">Rice Mill</span>
          </>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.labelKey || '__top__'}>
            {section.labelKey && !collapsed && (
              <div className="sidebar-section-label">{t(section.labelKey)}</div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              // The customer item report is a sub-page of the ledger; keep Ledger lit.
              const isActive = page === item.id || (page === 'customer-report' && item.id === 'ledger')
              return (
                <button
                  key={item.id}
                  className={`sidebar-btn${isActive ? ' sidebar-btn-active' : ''}${collapsed ? ' sidebar-btn--icon-only' : ''}`}
                  onClick={() => setPage(item.id)}
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  <Icon className="sidebar-icon" />
                  {!collapsed && t(item.labelKey)}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && (
          <button className="sidebar-lang-toggle" onClick={toggleLang} title={t('common.language')}>
            <Cog size={12} />
            {lang === 'en' ? 'EN → नेपाली' : 'NE → English'}
          </button>
        )}

        {collapsed ? (
          <button
            className="sidebar-btn sidebar-btn--icon-only"
            onClick={toggleLang}
            title={lang === 'en' ? 'Switch to नेपाली' : 'Switch to English'}
          >
            <Cog size={15} />
          </button>
        ) : (
          <div className="sidebar-user">
            <User size={14} className="text-orange-500" />
            <div>
              <div className="sidebar-user-name">{currentUser.username}</div>
              <div className="sidebar-user-role">{currentUser.role}</div>
            </div>
          </div>
        )}

        <button
          className={`sidebar-logout${collapsed ? ' sidebar-btn--icon-only' : ''}`}
          onClick={onLogout}
          title={collapsed ? t('common.lock_session') : undefined}
        >
          <LogOut size={13} />
          {!collapsed && t('common.lock_session')}
        </button>
      </div>
    </aside>
  )
}
