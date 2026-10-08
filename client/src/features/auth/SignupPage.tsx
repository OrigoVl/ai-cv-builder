import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Mail, User } from "lucide-react";
import { signUp } from "../../shared/auth-client.js";
import { PasswordInput } from "../../shared/PasswordInput.js";
import { Spinner } from "../../shared/Spinner.js";
import { AuthShell } from "./AuthShell.js";

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signUp.email({ email, password, name: name || email });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Could not create your account.");
      return;
    }
    navigate("/");
  }

  return (
    <AuthShell>
      <div className="animate-in">
        <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Free, and it takes about a minute.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                id="name"
                className="input pl-10"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

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
            minLength={8}
            autoComplete="new-password"
            helpText="At least 8 characters."
          />

          {error && (
            <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? <Spinner /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
