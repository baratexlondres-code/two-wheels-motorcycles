import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "owner" | "staff";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isOwner: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: "staff",
  setRole: () => {},
  isOwner: false,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("staff");

  return (
    <RoleContext.Provider value={{ role, setRole, isOwner: role === "owner" }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
