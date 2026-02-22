import { useState, useEffect, useCallback, useRef } from "react";
import { UserRole } from "@/contexts/RoleContext";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export function useAutoLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [role, setRole] = useState<UserRole>("staff");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lockTimeoutRef = useRef(DEFAULT_LOCK_TIMEOUT);

  // Load auto-lock timeout from settings
  useEffect(() => {
    supabase.from("workshop_settings").select("value").eq("key", "auto_lock_minutes").single()
      .then(({ data }) => {
        if (data?.value) {
          const mins = parseInt(data.value);
          if (mins > 0) lockTimeoutRef.current = mins * 60 * 1000;
        }
      });
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only auto-lock if owner is logged in
    if (role === "owner") {
      timerRef.current = setTimeout(() => {
        setIsLocked(false);
        setRole("staff");
      }, lockTimeoutRef.current);
    }
  }, [role]);

  const unlock = useCallback((loginRole: UserRole) => {
    setRole(loginRole);
    setIsLocked(false);
    if (loginRole === "owner") resetTimer();
  }, [resetTimer]);

  const lockToStaff = useCallback(() => {
    setRole("staff");
    setIsLocked(false);
  }, []);

  useEffect(() => {
    if (isLocked) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLocked, resetTimer]);

  // Warn before closing
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to close Two Wheels Motorcycles?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { isLocked, isFirstLogin, unlock, role, lockToStaff, setIsLocked };
}
