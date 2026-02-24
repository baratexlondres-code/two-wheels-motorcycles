import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface MainLayoutProps {
  children: React.ReactNode;
  onLock: () => void;
  onAdminLogin: () => void;
  isOwner: boolean;
}

export function MainLayout({ children, onLock, onAdminLogin, isOwner }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar onLock={onLock} onAdminLogin={onAdminLogin} isOwner={isOwner} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
