import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  BarChart3,
  ShieldAlert,
  Activity,
  LifeBuoy,
  Flag,
  Megaphone,
  TrendingUp,
  KeyRound,
  Database
} from 'lucide-react'

export const MODULES = [
  { id: 'command-center', name: 'Overview', icon: LayoutDashboard },
  { id: 'users', name: 'Users', icon: Users },
  { id: 'workspaces', name: 'Workspaces', icon: Briefcase },
  { id: 'billing', name: 'Billing', icon: CreditCard },
  { id: 'analytics', name: 'Analytics', icon: BarChart3 },
  { id: 'database', name: 'Database', icon: Database },
  { id: 'security', name: 'Security & Logs', icon: ShieldAlert },
  { id: 'health', name: 'System Health', icon: Activity },
  { id: 'support', name: 'Support', icon: LifeBuoy },
  { id: 'flags', name: 'Feature Flags', icon: Flag },
  { id: 'announcements', name: 'Announcements', icon: Megaphone },
  { id: 'growth', name: 'Growth', icon: TrendingUp },
  { id: 'rbac', name: 'Admins & Audit', icon: KeyRound }
]
