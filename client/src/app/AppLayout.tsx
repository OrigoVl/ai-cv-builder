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
      {/* Visible only when focused (e.g. the first Tab press) — lets keyboard users skip the
          header nav instead of tabbing through it on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:shadow-popover"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo size={26} />
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
              title="Account settings"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initials(data?.user?.name, data?.user?.email)}
              </span>
              <span className="hidden text-sm text-gray-500 sm:inline">{data?.user?.email}</span>
            </Link>
            <button className="btn-ghost btn-icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
