import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

const PlaceholderPage = () => {
  const location = useLocation();
  const pageName = location.pathname.slice(1).replace(/-/g, " ") || "Page";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Construction className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold capitalize text-foreground">{pageName}</h2>
        <p className="mt-2 text-sm text-muted-foreground">This module is coming soon</p>
      </div>
    </div>
  );
};

export default PlaceholderPage;
