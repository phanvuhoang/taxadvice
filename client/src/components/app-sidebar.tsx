import { Link, useLocation } from "wouter";
import {
  Search, MessageSquareText, FileText, BarChart3,
  ScrollText, FolderOpen, BookOpen, Settings, LogOut,
  Shield, Moon, Sun, ChevronDown
} from "lucide-react";
import { getUser, clearAuth, isAdmin } from "@/lib/auth";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Trang chủ", icon: Search, group: "main" },
  { path: "/quick-qa", label: "Tra cứu nhanh", icon: Search, group: "features" },
  { path: "/scenario", label: "Tình huống thuế", icon: MessageSquareText, group: "features" },
  { path: "/article", label: "Bài phân tích", icon: FileText, group: "features" },
  { path: "/report", label: "Báo cáo chuyên sâu", icon: BarChart3, group: "features" },
  { path: "/tax-advice", label: "Thư tư vấn", icon: ScrollText, group: "features" },
  { path: "/outputs", label: "Kết quả đã lưu", icon: FolderOpen, group: "data" },
  { path: "/documents", label: "Văn bản thuế", icon: BookOpen, group: "data" },
];

const adminItems = [
  { path: "/admin", label: "Quản trị", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();
  const user = getUser();
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(dark);
    if (dark) document.documentElement.classList.add("dark");
  }, []);

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = () => {
    clearAuth();
    window.location.hash = "#/login";
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col z-50 transition-all duration-200",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <span className="text-sidebar-primary-foreground font-bold text-sm">TA</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-semibold tracking-tight truncate">TaxAdvice</h1>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">Tư vấn Thuế VN</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {/* Features */}
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-2 mb-1 mt-2">
            Chức năng
          </p>
        )}
        {navItems.filter(i => i.group === "features").map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              data-testid={`nav-${item.path.replace("/", "") || "home"}`}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors mb-0.5",
                location === item.path
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </div>
          </Link>
        ))}

        {/* Data */}
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-2 mb-1 mt-4">
            Dữ liệu
          </p>
        )}
        {navItems.filter(i => i.group === "data").map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors mb-0.5",
                location === item.path
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </div>
          </Link>
        ))}

        {/* Admin */}
        {isAdmin() && (
          <>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-2 mb-1 mt-4">
                Quản trị
              </p>
            )}
            {adminItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors mb-0.5",
                    location === item.path
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={toggleDark}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 w-full transition-colors"
          data-testid="toggle-dark-mode"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>{isDark ? "Chế độ sáng" : "Chế độ tối"}</span>}
        </button>
        <div className="flex items-center gap-2.5 px-2.5 py-2 text-sm text-sidebar-foreground/70">
          <div className="w-6 h-6 rounded-full bg-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-medium text-sidebar-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} className="p-1 hover:text-destructive transition-colors" data-testid="btn-logout">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
