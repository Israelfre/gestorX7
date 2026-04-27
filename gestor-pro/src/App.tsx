import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Financial from "@/pages/financial";
import Agenda from "@/pages/agenda";
import Inventory from "@/pages/inventory";
import Quotes from "@/pages/quotes";
import ResumoDiario from "@/pages/resumo-diario";
import Suporte from "@/pages/suporte";
import Equipe from "@/pages/equipe";
import Relatorios from "@/pages/relatorios";
import Vendas from "@/pages/vendas";
import Settings from "@/pages/settings";
import Caixa from "@/pages/caixa";
import PrintPreview from "@/pages/print-preview";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminPanel from "@/pages/admin";
import Assinatura from "@/pages/assinatura";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  // /login sempre exibe o formulário, independente de sessão ativa
  if (location === "/login") {
    return <Login />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/gestorx7-logo-new.png" alt="GestorX7" className="w-16 h-16 object-contain opacity-80 animate-pulse" />
          <p className="text-sm text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  if (user.role === "admin") {
    return (
      <Switch>
        <Route path="/admin" component={AdminPanel} />
        <Route>
          <Redirect to="/admin" />
        </Route>
      </Switch>
    );
  }

  if (user.planExpired) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/assinatura" component={Assinatura} />
          <Route>
            <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
              <div className="max-w-sm text-center bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl">
                <img src="/gestorx7-logo-new.png" alt="GestorX7" className="w-16 h-16 object-contain mx-auto mb-4 opacity-60 drop-shadow-[0_0_12px_rgba(201,162,39,0.5)]" />
                <h2 className="text-lg font-bold text-white mb-2">Acesso Expirado</h2>
                <p className="text-sm text-gray-400 mb-5">
                  Seu plano venceu. Renove sua assinatura para continuar usando o GestorX7.
                </p>
                <a
                  href="/assinatura"
                  className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#b8911f] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all w-full justify-center mb-3"
                >
                  Renovar Assinatura
                </a>
                <a
                  href="https://wa.me/5500000000000"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs transition-colors"
                >
                  Falar com suporte
                </a>
              </div>
            </div>
          </Route>
        </Switch>
      </WouterRouter>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clientes" component={Clients} />
        <Route path="/clientes/:id" component={ClientDetail} />
        <Route path="/financeiro" component={Financial} />
        <Route path="/agenda" component={Agenda} />
        <Route path="/estoque" component={Inventory} />
        <Route path="/orcamentos" component={Quotes} />
        <Route path="/resumo" component={ResumoDiario} />
        <Route path="/suporte" component={Suporte} />
        <Route path="/equipe" component={Equipe} />
        <Route path="/relatorios" component={Relatorios} />
        <Route path="/vendas" component={Vendas} />
        <Route path="/caixa" component={Caixa} />
        <Route path="/configuracoes" component={Settings} />
        <Route path="/preview-orcamento" component={PrintPreview} />
        <Route path="/assinatura" component={Assinatura} />
        <Route path="/login"><Redirect to="/" /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
