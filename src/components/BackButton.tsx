import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/");
        }
      }}
      className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      title="Go back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
};

export default BackButton;
