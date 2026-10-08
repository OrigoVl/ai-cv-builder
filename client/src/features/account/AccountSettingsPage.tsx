import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, KeyRound, Trash2, User } from "lucide-react";
import { authClient, signOut, useSession } from "../../shared/auth-client.js";
import { PasswordInput } from "../../shared/PasswordInput.js";
import { Spinner } from "../../shared/Spinner.js";

function ProfileSection() {
  const { data } = useSession();
  const [name, setName] = useState(data?.user?.name ?? "");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const { error: updateError } = await authClient.updateUser({ name });
    setLoading(false);
    if (updateError) {
      setError(updateError.message ?? "Could not update your profile.");
      return;
    }
    setSaved(true);
  }

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <User className="h-4 w-4 text-brand-500" />
        Profile
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="account-name">
            Name
          </label>
          <input id="account-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <span className="label">Email</span>
          <p className="text-sm text-gray-500">{data?.user?.email}</p>
        </div>
        {error && <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Save changes"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (changeError) {
      setError(changeError.message ?? "Could not change your password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
  }

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <KeyRound className="h-4 w-4 text-brand-500" />
        Password
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          minLength={8}
          helpText="At least 8 characters. Signs you out of your other sessions."
        />
        {error && <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
        <div className="flex items-center gap-3">
          <button className="btn-primary" type="submit" disabled={loading || !currentPassword || !newPassword}>
            {loading ? <Spinner /> : "Change password"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Changed
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function DangerZoneSection() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: deleteError } = await authClient.deleteUser({ password });
    setLoading(false);
    if (deleteError) {
      setError(deleteError.message ?? "Could not delete your account. Check your password.");
      return;
    }
    await signOut();
    navigate("/login");
  }

  return (
    <section className="card border-red-100">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <Trash2 className="h-4 w-4" />
        Danger zone
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Permanently delete your account and every CV in it. This cannot be undone.
      </p>

      {!confirming ? (
        <button className="btn-danger mt-4" onClick={() => setConfirming(true)}>
          Delete account
        </button>
      ) : (
        <form onSubmit={handleDelete} className="mt-4 space-y-3 rounded-xl bg-red-50/60 p-4">
          <PasswordInput
            label="Confirm your password to delete your account"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && <p className="error-text">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-danger" disabled={loading || !password}>
              {loading ? <Spinner /> : "Permanently delete"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function AccountSettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to your CVs
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Account settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your profile, password, and account.</p>
      </div>
      <ProfileSection />
      <PasswordSection />
      <DangerZoneSection />
    </div>
  );
}
