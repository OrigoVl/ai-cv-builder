import { Outlet, Link, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "../shared/auth-client.js";
import { Logo } from "../shared/Logo.js";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function AppLayout() {
  const { data } = useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo size={26} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initials(data?.user?.name, data?.user?.email)}
              </span>
              <span className="text-sm text-gray-500">{data?.user?.email}</span>
            </div>
            <button className="btn-ghost btn-sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
