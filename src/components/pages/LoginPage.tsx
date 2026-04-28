import { useState } from 'react';
import { ShieldCheck, Lock, User } from 'lucide-react';

type LoginPageProps = {
  onLogin: () => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'admin') {
      setError('');
      onLogin();
      return;
    }
    setError('Invalid credentials. Use admin / admin');
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.28),transparent_35%),radial-gradient(circle_at_80%_25%,rgba(168,85,247,0.24),transparent_36%),radial-gradient(circle_at_50%_85%,rgba(244,63,94,0.18),transparent_40%),linear-gradient(120deg,#020617_0%,#0f172a_45%,#030712_100%)]" />
      <div className="absolute -top-28 -left-16 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -right-14 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" />
      <div className="absolute inset-0 opacity-[0.18] bg-[linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] bg-[size:34px_34px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-slate-600/70 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Latency Zero</h1>
            <p className="text-xs text-slate-400">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Username</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 bg-slate-950/60">
              <User className="w-4 h-4 text-slate-500" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="Enter Username"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 bg-slate-950/60">
              <Lock className="w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="Enter Password"
              />
            </div>
          </label>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors py-2 text-sm font-semibold"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
