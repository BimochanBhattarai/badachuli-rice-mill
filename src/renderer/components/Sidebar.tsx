import { type ElementType } from 'react'
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, PackagePlus,
  Truck, Cpu, BarChart3, Package, Tag, Boxes, Ruler,
  Settings, LogOut, User, Cog, BookOpen,
} from 'lucide-react'
import type { AuthUser } from '@shared/types'
import { useLanguage, type Lang } from '../i18n'

export type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers' | 'ledger'
  | 'stockin' | 'suppliers' | 'mill-processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

interface Props {
  page: NavPage
  setPage: (p: NavPage) => void
  currentUser: AuthUser
  onLogout: () => void
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
    labelKey: 'section.system',
    items: [
      { id: 'reports',  labelKey: 'nav.reports',  icon: BarChart3 },
      { id: 'settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ page, setPage, currentUser, onLogout }: Props) {
  const { t, lang, setLang } = useLanguage()

  function toggleLang() {
    setLang(lang === 'en' ? 'ne' : 'en' as Lang)
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-name">Badachuli</span>
        <span className="sidebar-brand-sub">Rice Mill</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.labelKey || '__top__'}>
            {section.labelKey && (
              <div className="sidebar-section-label">{t(section.labelKey)}</div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = page === item.id
              return (
                <button
                  key={item.id}
                  className={`sidebar-btn${isActive ? ' sidebar-btn-active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  <Icon className="sidebar-icon" />
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Language toggle */}
        <button className="sidebar-lang-toggle" onClick={toggleLang} title={t('common.language')}>
          <Cog size={12} />
          {lang === 'en' ? 'EN → नेपाली' : 'NE → English'}
        </button>

        <div className="sidebar-user">
          <User size={14} className="text-orange-500" />
          <div>
            <div className="sidebar-user-name">{currentUser.username}</div>
            <div className="sidebar-user-role">{currentUser.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={13} />
          {t('common.lock_session')}
        </button>
      </div>
    </aside>
  )
}
