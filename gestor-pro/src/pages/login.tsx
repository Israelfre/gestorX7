import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // Redireciona para o painel correto após login
      const me = await fetch(
        import.meta.env.BASE_URL.replace(/\/$/, "") + "/api/auth/me",
        { credentials: "include", cache: "no-store" }
      ).then((r) => r.json());
      if (me?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/gestorx7-logo-new.png"
            alt="GestorX7"
            className="w-32 h-32 object-contain mb-2 drop-shadow-[0_0_20px_rgba(201,162,39,0.6)]"
          />
          <p className="text-sm text-gray-400 mt-1">Organize sua empresa sem complicação</p>
        </div>

        {/* Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-1">Entrar no sistema</h2>
          <p className="text-sm text-gray-400 mb-5">Acesse com seu e-mail e senha</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1AAF54] hover:bg-[#17a04c] disabled:opacity-60 text-white font-semibold text-sm rounded-xl py-2.5 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          GestorX7 v1.0 · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
