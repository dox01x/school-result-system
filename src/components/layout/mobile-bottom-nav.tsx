"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, GraduationCap, CalendarCheck, Wallet, Menu } from "lucide-react";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { isNavItemVisible } from "@/lib/rbac";
import { useMemo } from "react";

export function MobileBottomNav({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const { role, loading } = useUserRole();

  const isRoleLoaded = !loading && !!role;

  const showFinance = useMemo(() => {
    if (!isRoleLoaded) return true;
    return isNavItemVisible(role, "/dashboard/finance");
  }, [role, isRoleLoaded]);

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutGrid,
      href: "/dashboard",
      exact: true,
      active: pathname === "/dashboard",
    },
    {
      label: "Students",
      icon: GraduationCap,
      href: "/dashboard/students",
      active: pathname?.startsWith("/dashboard/students"),
    },
    {
      label: "Attendance",
      icon: CalendarCheck,
      href: "/dashboard/attendance",
      active: pathname?.startsWith("/dashboard/attendance"),
    },
    ...(showFinance
      ? [
          {
            label: "Finance",
            icon: Wallet,
            href: "/dashboard/finance",
            active: pathname?.startsWith("/dashboard/finance"),
          },
        ]
      : [
          {
            label: "Marks",
            icon: GraduationCap,
            href: "/dashboard/marks",
            active: pathname?.startsWith("/dashboard/marks"),
          },
        ]),
  ];

  const handleOpenMenu = () => {
    if (onOpenMenu) {
      onOpenMenu();
    } else {
      window.dispatchEvent(new CustomEvent("open-mobile-sidebar"));
    }
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-15 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors relative",
                item.active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {item.active && (
                <span className="absolute top-1 w-6 h-1 bg-primary rounded-full" />
              )}
              <Icon
                size={20}
                strokeWidth={item.active ? 2.2 : 1.7}
                className={cn(
                  "mb-0.5 transition-transform",
                  item.active ? "scale-105 text-primary" : ""
                )}
              />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleOpenMenu}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground active:scale-95 transition-colors"
          aria-label="Open all navigation modules"
        >
          <Menu size={20} strokeWidth={1.7} className="mb-0.5" />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
