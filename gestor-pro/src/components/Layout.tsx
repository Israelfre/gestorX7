import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, DollarSign, Calendar, Package, FileText,
  AlertTriangle, Menu, ClipboardList, Headphones, UserCog, BarChart2,
  ShoppingCart, MoreHorizontal, X, Settings, LogOut, Landmark,
} from "lucide-react";
import { useGetAlerts } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const primaryNav = [
  { href: "/",          label: "Início",    icon: LayoutDashboard },
  { href: "/resumo",    label: "Resumo",    icon: ClipboardList },
  { href: "/vendas",    label: "Vendas",    icon: ShoppingCart },
  { href: "/financeiro",label: "Financeiro",icon: DollarSign },
  { href: "/estoque",   label: "Estoque",   icon: Package },
];

const secondaryNav = [
  { href: "/caixa",      label: "Caixa",      icon: Landmark },
  { href: "/clientes",   label: "Clientes",   icon: Users },
  { href: "/agenda",     label: "Agenda",     icon: Calendar },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/equipe",     label: "Equipe",     icon: UserCog },
  { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
  { href: "/suporte",    label: "Suporte",    icon: Headphones },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const allNav = [...primaryNav, ...secondaryNav];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: alerts = [] } = useGetAlerts();
  const { user, logout } = useAuth();

  const totalAlerts = alerts.length;

  const getAlertCount = (href: string) => {
    if (href === "/") return 0;
    if (href === "/clientes") return alerts.filter((a) => a.type === "debtor").length;
    if (href === "/agenda") return alerts.filter((a) => a.type === "overdue_task").length;
    if (href === "/estoque") return alerts.filter((a) => a.type === "low_stock").length;
    return 0;
  };

  // Close overlays on route change
  useEffect(() => { setMobileOpen(false); setMoreOpen(false); }, [location]);

  // Prevent body scroll when overlays open
  useEffect(() => {
    document.body.style.overflow = (mobileOpen || moreOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, moreOpen]);

  const currentPage = allNav.find((n) =>
    n.href === "/" ? location === "/" : location.startsWith(n.href)
  );
  const isSecondaryActive = secondaryNav.some((n) =>
    n.href === "/" ? location === "/" : location.startsWith(n.href)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5 border-b border-sidebar-border flex flex-col items-center gap-1">
        <img src="/gestorx7-logo-new.png" alt="GestorX7" className="w-full max-w-[160px] h-auto object-contain drop-shadow-[0_0_16px_rgba(201,162,39,0.55)]" />
        <p className="text-[10px] text-sidebar-foreground/35 tracking-wide text-center">
          Organize sua empresa sem complicação
        </p>
      </div>

      {totalAlerts > 0 && (
        <div className="mx-3 mt-3 px-3 py-2 bg-primary/20 border border-primary/30 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium">
              {totalAlerts} alerta{totalAlerts !== 1 ? "s" : ""} ativo{totalAlerts !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {allNav.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          const count = getAlertCount(href);
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer active:scale-[0.98]",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}>
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </div>
                {count > 0 && (
                  <span className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none",
                    isActive ? "bg-black/20 text-sidebar-primary-foreground" : "bg-primary text-white"
                  )}>
                    {count}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">{user.email}</p>
            </div>
            <button onClick={logout} className="p-1 text-sidebar-foreground/40 hover:text-red-400 transition-colors" title="Sair">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-sidebar-foreground/25 px-2">GestorX7 v1.0</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      <div className={cn(
        "md:hidden fixed inset-0 z-50 transition-all duration-300",
        mobileOpen ? "pointer-events-auto" : "pointer-events-none"
      )}>
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-72 transition-transform duration-300 ease-out shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <SidebarContent />
        </div>
      </div>

      {/* "Mais" bottom sheet */}
      <div className={cn(
        "md:hidden fixed inset-0 z-50 transition-all duration-300",
        moreOpen ? "pointer-events-auto" : "pointer-events-none"
      )}>
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            moreOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMoreOpen(false)}
        />
        <div className={cn(
          "absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out pb-safe",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b">
            <span className="font-semibold text-sm">Mais módulos</span>
            <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-0 px-2 py-3 pb-6">
            {secondaryNav.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/" ? location === "/" : location.startsWith(href);
              const count = getAlertCount(href);
              return (
                <Link key={href} href={href}>
                  <div className={cn(
                    "flex flex-col items-center justify-center py-4 px-2 rounded-xl gap-2 active:bg-muted transition-colors relative",
                    isActive ? "bg-primary/10" : ""
                  )}>
                    <div className="relative">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        isActive ? "bg-primary" : "bg-muted"
                      )}>
                        <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-foreground")} />
                      </div>
                      {count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-medium text-center leading-tight",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>{label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-white rounded-lg active:bg-white/10 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src="/gestorx7-logo-new.png" alt="GestorX7" className="h-7 w-auto object-contain shrink-0 drop-shadow-[0_0_10px_rgba(201,162,39,0.65)]" />
            {currentPage && (
              <span className="text-white/70 text-sm font-medium truncate">
                · {currentPage.label}
              </span>
            )}
          </div>
          {totalAlerts > 0 && (
            <div className="flex items-center gap-1 bg-primary/20 border border-primary/30 rounded-full px-2.5 py-1 shrink-0">
              <AlertTriangle className="w-3 h-3 text-primary" />
              <span className="text-xs text-primary font-bold">{totalAlerts}</span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="pb-20 md:pb-0">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar — 5 primary + Mais */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border">
          <div className="flex items-stretch h-16">
            {primaryNav.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/" ? location === "/" : location.startsWith(href);
              const count = getAlertCount(href);
              return (
                <Link key={href} href={href} className="flex-1">
                  <div className={cn(
                    "flex flex-col items-center justify-center h-full gap-1 transition-all duration-150 relative active:scale-95",
                    isActive ? "text-[#C9A227]" : "text-sidebar-foreground/45"
                  )}>
                    {isActive && (
                      <div className="absolute top-0 left-3 right-3 h-0.5 bg-[#C9A227] rounded-full" />
                    )}
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium leading-none",
                      isActive ? "text-[#C9A227]" : "text-sidebar-foreground/40"
                    )}>{label}</span>
                  </div>
                </Link>
              );
            })}

            {/* Mais button */}
            <button
              className="flex-1 flex flex-col items-center justify-center h-full gap-1 transition-all duration-150 active:scale-95 relative"
              onClick={() => setMoreOpen(true)}
            >
              {isSecondaryActive && (
                <div className="absolute top-0 left-3 right-3 h-0.5 bg-[#C9A227] rounded-full" />
              )}
              <div className="relative">
                <MoreHorizontal className={cn("w-5 h-5", isSecondaryActive ? "text-[#C9A227]" : "text-sidebar-foreground/45")} />
                {secondaryNav.some((n) => getAlertCount(n.href) > 0) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {secondaryNav.reduce((s, n) => s + getAlertCount(n.href), 0) > 9
                      ? "9+"
                      : secondaryNav.reduce((s, n) => s + getAlertCount(n.href), 0)}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isSecondaryActive ? "text-[#C9A227]" : "text-sidebar-foreground/40"
              )}>Mais</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
