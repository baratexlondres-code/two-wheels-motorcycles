import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAutoLock } from "@/hooks/useAutoLock";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import LockScreen from "@/components/LockScreen";
import OwnerRoute from "@/components/OwnerRoute";
import AccessGate from "@/components/AccessGate";
import { MainLayout } from "@/components/MainLayout";
import Dashboard from "@/pages/Dashboard";
import ReportsPage from "@/pages/ReportsPage";
import MotorcycleSalesPage from "@/pages/MotorcycleSalesPage";
import RepairsPage from "@/pages/RepairsPage";
import AccessoriesPage from "@/pages/AccessoriesPage";
import StockPage from "@/pages/StockPage";
import CustomersPage from "@/pages/CustomersPage";
import InvoicesPage from "@/pages/InvoicesPage";
import SettingsPage from "@/pages/SettingsPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { UserRole } from "@/contexts/RoleContext";

const queryClient = new QueryClient();

// Detect if running inside Electron (file:// protocol or preload API)
export const isElectron = typeof window !== "undefined" &&
  (window.location.protocol === "file:" ||
   navigator.userAgent.toLowerCase().includes("electron") ||
   !!(window as any).electronAPI);

// Detect if running inside Capacitor (Android/iOS native app)
export const isCapacitor = typeof window !== "undefined" &&
  !!(window as any).Capacitor;

// The live web app URL for "Open in Browser" button on mobile
export const WEB_APP_URL = "https://twowheelsmotorcycles.lovable.app";

const AppContent = () => {
  const { unlock, role, lockToStaff, isLocked, setIsLocked } = useAutoLock();
  const { setRole } = useRole();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  // In Electron or Capacitor, skip the access gate entirely
  const [hasAccess, setHasAccess] = useState(() =>
    isElectron || isCapacitor || sessionStorage.getItem("tw_access") === "granted"
  );

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  const handleAdminLogin = () => {
    setShowAdminLogin(true);
    setIsLocked(true);
  };

  const handleUnlock = (loginRole: UserRole) => {
    unlock(loginRole);
    setShowAdminLogin(false);
  };

  const handleLock = () => {
    lockToStaff();
    setShowAdminLogin(false);
  };

  if (!hasAccess) {
    return <AccessGate onUnlock={() => setHasAccess(true)} />;
  }

  return (
    <>
      <AnimatePresence>
        {showAdminLogin && isLocked && (
          <LockScreen onUnlock={handleUnlock} isAutoLock={false} onCancel={() => { setShowAdminLogin(false); setIsLocked(false); }} />
        )}
      </AnimatePresence>

      <HashRouter>
        <MainLayout onLock={handleLock} onAdminLogin={handleAdminLogin} isOwner={role === "owner"}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/repairs" element={<RepairsPage />} />
            <Route path="/sales" element={<OwnerRoute><MotorcycleSalesPage /></OwnerRoute>} />
            <Route path="/accessories" element={<AccessoriesPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/invoices" element={<OwnerRoute><InvoicesPage /></OwnerRoute>} />
            <Route path="/reports" element={<OwnerRoute><ReportsPage /></OwnerRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/whatsapp" element={<OwnerRoute><WhatsAppPage /></OwnerRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </HashRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RoleProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <AppContent />
      </TooltipProvider>
    </RoleProvider>
  </QueryClientProvider>
);

export default App;
