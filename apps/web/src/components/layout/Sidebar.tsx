import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Shirt,
  BookImage,
  UserCircle,
  Sparkles,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/wardrobe', icon: Shirt, labelKey: 'nav.wardrobe' },
  { to: '/outfits', icon: BookImage, labelKey: 'nav.outfits' },
  { to: '/avatars', icon: UserCircle, labelKey: 'nav.avatars' },
  { to: '/recommendations', icon: Sparkles, labelKey: 'nav.recommendations' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold tracking-tight">OOTD</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
