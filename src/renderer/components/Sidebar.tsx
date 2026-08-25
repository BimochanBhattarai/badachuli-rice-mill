import { type ElementType } from 'react'
import {
  LayoutDashboard, ReceiptText, ClipboardList, Users, PackagePlus,
  Truck, Cpu, BarChart3, Package, Tag, Boxes, Ruler,
  Settings, LogOut, User,
} from 'lucide-react'
import type { AuthUser } from '@shared/types'

type NavPage =
  | 'dashboard' | 'billing' | 'bills' | 'customers'
  | 'stockin' | 'suppliers' | 'processing'
  | 'reports' | 'items' | 'prices' | 'stock' | 'units' | 'settings'

interface Props {
  page: NavPage
  setPage: (p: NavPage) => void
  currentUser: AuthUser
  onLogout: () => void
}

interface NavItem {
  id: NavPage
  label: string
  icon: ElementType
}

interface NavSection {
  label: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    label: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Sales',
    items: [
      { id: 'billing',   label: 'New Bill',   icon: ReceiptText },
      { id: 'bills',     label: 'Bills',       icon: ClipboardList },
      { id: 'customers', label: 'Customers',   icon: Users },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { id: 'stockin',    label: 'Stock-In',    icon: PackagePlus },
      { id: 'stock',      label: 'Stock',        icon: Boxes },
      { id: 'suppliers',  label: 'Suppliers',    icon: Truck },
      { id: 'processing', label: 'Processing',   icon: Cpu },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { id: 'items',  label: 'Items',  icon: Package },
      { id: 'prices', label: 'Prices', icon: Tag },
      { id: 'units',  label: 'Units',  icon: Ruler },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'reports',  label: 'Reports',  icon: BarChart3 },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function Sidebar({ page, setPage, currentUser, onLogout }: Props) {
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
          <div key={section.label || '__top__'}>
            {section.label && (
              <div className="sidebar-section-label">{section.label}</div>
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
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <User size={14} className="text-orange-500" />
          <div>
            <div className="sidebar-user-name">{currentUser.username}</div>
            <div className="sidebar-user-role">{currentUser.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={13} />
          Lock Session
        </button>
      </div>
    </aside>
  )
}
