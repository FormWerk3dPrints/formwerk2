'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Boxes,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Package,
  ScrollText,
  Users,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/categorias', label: 'Categorias', icon: FolderOpen },
  { href: '/admin/produtos', label: 'Produtos', icon: Package },
  { href: '/admin/kits', label: 'Kits', icon: Boxes },
  { href: '/admin/paineis', label: 'Painéis', icon: LayoutGrid },
  { href: '/admin/emissao', label: 'Emissão', icon: FileText },
  { href: '/admin/contas', label: 'Contas', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/logs', label: 'Log', icon: ScrollText },
];

/**
 * Barra de navegação do admin.
 *
 * Fica colada logo abaixo do cabeçalho do site, que é fixo e tem 78px; com
 * `top-0` ela deslizava por baixo dele e sumia ao rolar. Quando os links não
 * cabem, a barra rola na horizontal: antes, no celular, o `overflow-x: hidden`
 * do body simplesmente cortava os últimos links e o botão Sair.
 */
export function AdminNav({
  email,
  onLogout,
}: {
  email: string | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Ao trocar de página, traz o link ativo para a parte visível da barra.
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="sticky top-[78px] z-40 border-b bg-white">
      <div className="container mx-auto flex h-14 items-center gap-2 sm:px-6 md:px-8">
        <nav
          ref={navRef}
          aria-label="Admin"
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-3 sm:px-0"
        >
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-black text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-l pr-1 pl-1 sm:border-l-0 sm:px-0">
          {email && <span className="hidden text-xs text-gray-400 xl:inline">{email}</span>}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-500 transition-colors hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}
