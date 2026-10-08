import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Mail } from "lucide-react";
import { signIn } from "../../shared/auth-client.js";
import { PasswordInput } from "../../shared/PasswordInput.js";
import { Spinner } from "../../shared/Spinner.js";
import { AuthShell } from "./AuthShell.js";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn.email({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Could not sign in. Check your email and password.");
      return;
    }
    navigate("/");
  }

  return (
    <AuthShell>
      <div className="animate-in">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                id="email"
                className="input pl-10"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error && (
            <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <Spinner /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          New to Brightfolio?{" "}
          <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
