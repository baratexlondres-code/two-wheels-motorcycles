import {
  Wrench, Bike, ShoppingCart, Package, FileText,
  BarChart3, Settings, LayoutDashboard, Users, LogOut, Shield, MessageSquare, Power,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useRole } from "@/contexts/RoleContext";
import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { isElectron } from "@/App";

const allMainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, ownerOnly: false },
  { title: "Repairs", url: "/repairs", icon: Wrench, ownerOnly: false },
  { title: "Motorcycle Sales", url: "/sales", icon: Bike, ownerOnly: true },
  { title: "Accessories", url: "/accessories", icon: ShoppingCart, ownerOnly: false },
  { title: "Stock Control", url: "/stock", icon: Package, ownerOnly: false },
  { title: "Customers", url: "/customers", icon: Users, ownerOnly: false },
  { title: "Invoices", url: "/invoices", icon: FileText, ownerOnly: true },
  { title: "Reports", url: "/reports", icon: BarChart3, ownerOnly: true },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, ownerOnly: true },
];

const systemItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  onLock: () => void;
  onAdminLogin: () => void;
  isOwner: boolean;
}

export function AppSidebar({ onLock, onAdminLogin, isOwner }: AppSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const mainItems = allMainItems.filter((item) => !item.ownerOnly || isOwner);

  const handleCloseApp = () => {
    if ((window as any).electronAPI?.closeWindow) {
      (window as any).electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <img src={logo} alt="Logo" className="h-10 w-auto flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold tracking-wider text-foreground truncate">
              TWO WHEELS
            </h2>
            <p className="text-[10px] text-muted-foreground">Management System</p>
          </div>
        )}
      </div>

      <SidebarContent className="mt-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">Main Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/15 text-primary border-glow"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">System</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-primary/15 text-primary"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-1">
        {/* Close App — only on Electron */}
        {isElectron && (
          <button
            onClick={handleCloseApp}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Power className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Close App</span>}
          </button>
        )}
        {isOwner ? (
          <button
            onClick={() => { if (isMobile) setOpenMobile(false); onLock(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Exit Admin</span>}
          </button>
        ) : (
          <button
            onClick={() => { if (isMobile) setOpenMobile(false); onAdminLogin(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/10"
          >
            <Shield className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Admin Access</span>}
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
