import { Navigate, Route, Routes } from "react-router";
import { useSession } from "../shared/auth-client.js";
import { AppLayout } from "./AppLayout.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { SignupPage } from "../features/auth/SignupPage.js";
import { CvListPage } from "../features/cvs/CvListPage.js";
import { NewCvPage } from "../features/cvs/NewCvPage.js";
import { CvDetailPage } from "../features/cvs/CvDetailPage.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!data?.session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<CvListPage />} />
        <Route path="/new" element={<NewCvPage />} />
        <Route path="/cvs/:id" element={<CvDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
