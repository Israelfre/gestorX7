import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Edit2, Trash2, CheckCircle, XCircle, Clock, AlertTriangle,
  Eye, EyeOff, LogOut, Copy, KeyRound, Phone,
} from "lucide-react";
import { useAuth, getAuthToken } from "@/contexts/AuthContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function authFetch(input: string, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { "X-Auth-Token": token } : {}),
  };
  return fetch(input, { ...init, headers, credentials: "include" });
}

type AdminUser = {
  id: number;
  tenantId: number;
  name: string;
  email: string;
  phone: string | null;
  passwordPlain: string | null;
  role: string;
  plan: string;
  planExpiresAt: string | null;
  isActive: boolean;
  daysLeft: number | null;
  status: "ativo" | "inativo" | "gratuito" | "expirado" | "vencendo";
  createdAt: string;
};

const planLabels: Record<string, string> = { free: "Gratuito", trial: "Trial", monthly: "Mensal", semiannual: "Semestral", yearly: "Anual" };
const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  trial: "bg-blue-100 text-blue-700",
  monthly: "bg-purple-100 text-purple-700",
  semiannual: "bg-orange-100 text-orange-700",
  yearly: "bg-green-100 text-green-700",
};
const statusColors: Record<string, string> = {
  ativo: "text-green-600 bg-green-50",
  gratuito: "text-gray-600 bg-gray-100",
  vencendo: "text-orange-600 bg-orange-50",
  expirado: "text-red-600 bg-red-50",
  inativo: "text-gray-400 bg-gray-100",
};
const statusLabels: Record<string, string> = {
  ativo: "Ativo", gratuito: "Gratuito", vencendo: "Vencendo", expirado: "Expirado", inativo: "Inativo",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[status] ?? ""}`}>
      {status === "ativo" && <CheckCircle className="w-3 h-3" />}
      {status === "expirado" && <XCircle className="w-3 h-3" />}
      {status === "vencendo" && <AlertTriangle className="w-3 h-3" />}
      {status === "inativo" && <XCircle className="w-3 h-3" />}
      {statusLabels[status] ?? status}
    </span>
  );
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  plan: string;
  planExpiresAt: string;
  isActive: boolean;
};

const emptyForm: FormState = { name: "", email: "", phone: "", password: "", plan: "trial", planExpiresAt: "", isActive: true };

export default function AdminPanel() {
  const { user: me, logout } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetShowPwd, setResetShowPwd] = useState(false);

  function toggleReveal(id: number) {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function copyPassword(id: number, pwd: string) {
    navigator.clipboard.writeText(pwd).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await authFetch(`${API}/admin/users`);
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await authFetch(`${API}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, planExpiresAt: data.planExpiresAt || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setShowForm(false); setForm(emptyForm); setFormError(null); },
    onError: (e: any) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FormState> }) => {
      const res = await authFetch(`${API}/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, planExpiresAt: data.planExpiresAt || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditingId(null); setShowForm(false); setForm(emptyForm); setFormError(null); },
    onError: (e: any) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`${API}/admin/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeleteConfirm(null); },
  });

  const resetPwdMut = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await authFetch(`${API}/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setResetId(null);
      setResetPwd("");
      setResetShowPwd(false);
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(u: AdminUser) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? "", password: "", plan: u.plan, planExpiresAt: u.planExpiresAt ? u.planExpiresAt.split("T")[0] : "", isActive: u.isActive });
    setFormError(null);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) updateMut.mutate({ id: editingId, data: form });
    else createMut.mutate(form);
  }

  const clientUsers = users.filter((u) => u.role !== "admin");
  const stats = {
    total: clientUsers.length,
    ativos: clientUsers.filter((u) => u.status === "ativo").length,
    vencendo: clientUsers.filter((u) => u.status === "vencendo").length,
    expirados: clientUsers.filter((u) => u.status === "expirado").length,
    gratuitos: clientUsers.filter((u) => u.status === "gratuito").length,
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Top bar */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/gestorx7-logo-new.png" alt="GestorX7" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-sm font-bold text-white">GestorX7 — Admin</p>
            <p className="text-xs text-gray-400">Painel de Controle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">{me?.name}</span>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 rounded-lg transition-colors">
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-white" },
            { label: "Ativos", value: stats.ativos, color: "text-green-400" },
            { label: "Vencendo", value: stats.vencendo, color: "text-orange-400" },
            { label: "Expirados", value: stats.expirados, color: "text-red-400" },
            { label: "Gratuitos", value: stats.gratuitos, color: "text-gray-400" },
          ].map((s) => (
            <div key={s.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1AAF54]" />
            <h1 className="text-lg font-bold">Clientes do Sistema</h1>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-[#1AAF54] hover:bg-[#17a04c] text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>

        {/* Create/Edit form */}
        {showForm && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-4">{editingId ? "Editar Cliente" : "Novo Cliente"}</h2>
            {formError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-400">{formError}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Nome</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Nome da empresa / pessoa" className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">E-mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="acesso@email.com" className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Telefone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">{editingId ? "Nova Senha (deixar em branco para manter)" : "Senha"}</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} placeholder="••••••••" className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 pr-9 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => {
                    const plan = e.target.value;
                    setForm({ ...form, plan, planExpiresAt: plan === "free" ? "" : form.planExpiresAt });
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#1AAF54] transition-colors"
                >
                  <option value="free">Gratuito</option>
                  <option value="trial">Trial (7 dias)</option>
                  <option value="monthly">Mensal</option>
                  <option value="semiannual">Semestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              {form.plan !== "free" && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Validade do Plano</label>
                  <input type="date" value={form.planExpiresAt} onChange={(e) => setForm({ ...form, planExpiresAt: e.target.value })} className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#1AAF54] transition-colors" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Status</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${form.isActive ? "bg-[#1AAF54]" : "bg-gray-600"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm text-gray-300">{form.isActive ? "Ativo" : "Inativo"}</span>
                </div>
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormError(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#30363d] rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm font-semibold bg-[#1AAF54] hover:bg-[#17a04c] disabled:opacity-60 text-white rounded-xl transition-all">
                  {createMut.isPending || updateMut.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users list */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : clientUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum cliente cadastrado ainda.</p>
              <p className="text-xs text-gray-500 mt-1">Clique em "Novo Cliente" para começar.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#30363d]">
              {clientUsers.map((u) => (
                <div key={u.id} className="px-4 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#1AAF54]/10 border border-[#1AAF54]/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#1AAF54]">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <StatusBadge status={u.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                    {u.phone && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        {u.phone}
                      </p>
                    )}

                    {/* Password row */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <KeyRound className="w-3 h-3 text-gray-500 shrink-0" />
                      {u.passwordPlain ? (
                        <>
                          <span className={`text-xs font-mono ${revealedPasswords.has(u.id) ? "text-[#1AAF54]" : "text-gray-600 select-none"}`}>
                            {revealedPasswords.has(u.id) ? u.passwordPlain : "••••••••"}
                          </span>
                          <button
                            onClick={() => toggleReveal(u.id)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title={revealedPasswords.has(u.id) ? "Ocultar senha" : "Ver senha"}
                          >
                            {revealedPasswords.has(u.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          {revealedPasswords.has(u.id) && (
                            <button
                              onClick={() => copyPassword(u.id, u.passwordPlain!)}
                              className="text-gray-500 hover:text-[#1AAF54] transition-colors"
                              title="Copiar senha"
                            >
                              {copiedId === u.id
                                ? <CheckCircle className="w-3 h-3 text-[#1AAF54]" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-600 italic">sem senha salva</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${planColors[u.plan] ?? ""}`}>{planLabels[u.plan] ?? u.plan}</span>
                      {u.planExpiresAt && (
                        <span className={`text-xs flex items-center gap-1 ${u.daysLeft !== null && u.daysLeft <= 7 ? "text-orange-400" : "text-gray-500"}`}>
                          <Clock className="w-3 h-3" />
                          {u.daysLeft !== null && u.daysLeft > 0 ? `vence em ${u.daysLeft}d` : u.daysLeft === 0 ? "vence hoje" : "expirado"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetPwd(""); setResetShowPwd(false); setDeleteConfirm(null); }}
                      className="p-1.5 text-gray-400 hover:text-[#1AAF54] hover:bg-[#1AAF54]/10 rounded-lg transition-colors"
                      title="Redefinir senha"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#30363d] rounded-lg transition-colors" title="Editar cliente">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {deleteConfirm === u.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteMut.mutate(u.id)} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg">Confirmar</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-white border border-[#30363d] rounded-lg">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  </div>{/* end main row */}

                  {/* Inline reset password panel */}
                  {resetId === u.id && (
                    <div className="ml-13 flex items-center gap-2 bg-[#0d1117] border border-[#1AAF54]/30 rounded-xl px-3 py-2.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#1AAF54] shrink-0" />
                      <span className="text-xs text-gray-400 shrink-0">Nova senha:</span>
                      <div className="relative flex-1">
                        <input
                          type={resetShowPwd ? "text" : "password"}
                          value={resetPwd}
                          onChange={(e) => setResetPwd(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && resetPwd.trim()) resetPwdMut.mutate({ id: u.id, password: resetPwd.trim() });
                            if (e.key === "Escape") { setResetId(null); setResetPwd(""); }
                          }}
                          placeholder="Digite a nova senha"
                          autoFocus
                          className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 pr-8 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#1AAF54] transition-colors font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setResetShowPwd(!resetShowPwd)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {resetShowPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                      <button
                        onClick={() => { if (resetPwd.trim()) resetPwdMut.mutate({ id: u.id, password: resetPwd.trim() }); }}
                        disabled={!resetPwd.trim() || resetPwdMut.isPending}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#1AAF54] hover:bg-[#17a04c] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all shrink-0"
                      >
                        {resetPwdMut.isPending ? "..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => { setResetId(null); setResetPwd(""); }}
                        className="p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
