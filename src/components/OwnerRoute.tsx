import React from "react";
import { useRole } from "@/contexts/RoleContext";
import { Navigate } from "react-router-dom";

interface OwnerRouteProps {
  children: React.ReactNode;
}

const OwnerRoute = ({ children }: OwnerRouteProps) => {
  const { isOwner } = useRole();
  if (!isOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default OwnerRoute;
