import { Navigate, useLocation } from "react-router-dom";
import BrandLoader from "../ui/BrandLoader";
import { useAuth } from "../../lib/authContext";

export default function AdminRoute({ children }) {
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <BrandLoader label="Checking admin access" />;
  }

  if (!user || !user.emailVerified) {
    return (
      <Navigate
        to="/control-room/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}
