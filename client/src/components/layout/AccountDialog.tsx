import { useState, type FormEvent } from "react";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlays";
import { useAccountStore } from "@/store/useAccountStore";

export function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { available, ready, user, register, login, logout, error: statusError } = useAccountStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "register") await register(email, password);
      else await login(email, password);
      setPassword("");
      onOpenChange(false);
      toast.success(mode === "register" ? "Account created" : "Signed in", { description: "Your pantry and preferences will sync to this account." });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const signOut = async () => {
    setPending(true);
    setError(null);
    try {
      await logout();
      onOpenChange(false);
      toast.success("Signed out");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Your Pantry Chef account" description="Keep your pantry and cooking preferences in sync across devices.">
      {!ready ? (
        <p className="text-sm text-muted">Checking account availability…</p>
      ) : !available ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">
          <p>Accounts and syncing need MongoDB storage. Add a <code>MONGODB_URI</code> connection string to the project’s <code>.env</code> file and restart the server.</p>
          <p>Your pantry and preferences will remain in this browser until you sign in after MongoDB is connected.</p>
        </div>
      ) : user ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-saffron-500/15 text-saffron-600"><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="truncate font-medium">{user.email}</div>
              <div className="text-xs text-muted">Pantry and preferences sync automatically</div>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-tomato-600">{error}</p>}
          <Button variant="outline" onClick={signOut} loading={pending}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {statusError && <p role="alert" className="rounded-xl bg-tomato-500/10 p-3 text-sm text-tomato-600">{statusError}</p>}
          <div className="flex rounded-xl bg-surface-2 p-1">
            {(["login", "register"] as const).map((value) => (
              <button key={value} type="button" onClick={() => { setMode(value); setError(null); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${mode === value ? "bg-surface shadow-sm" : "text-muted"}`}>
                {value === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            Email
            <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-saffron-500" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Password
            <input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-saffron-500" />
            {mode === "register" && <span className="block text-xs font-normal text-muted">Use at least 12 characters.</span>}
          </label>
          {error && <p role="alert" className="text-sm text-tomato-600">{error}</p>}
          <Button type="submit" className="w-full" loading={pending}>{mode === "register" ? "Create account and sync" : "Sign in and sync"}</Button>
        </form>
      )}
    </Modal>
  );
}
