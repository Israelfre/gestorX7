import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Check, Zap, Crown, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export default function Assinatura() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();

  const success = new URLSearchParams(window.location.search).get("success");
  const canceled = new URLSearchParams(window.location.search).get("canceled");

  useEffect(() => {
    fetch("/api/stripe/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.data ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout(priceId: string) {
    setCheckingOut(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Erro", description: data.error ?? "Erro ao iniciar checkout", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
    } finally {
      setCheckingOut(null);
    }
  }

  async function handlePortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Erro", description: data.error ?? "Erro ao abrir portal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
    } finally {
      setOpeningPortal(false);
    }
  }

  const allPrices = plans.flatMap((p) =>
    p.prices.map((pr) => ({ ...pr, plan: p }))
  ).sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0));

  const monthlyPrice = allPrices.find((p) => p.recurring?.interval === "month");
  const yearlyPrice = allPrices.find((p) => p.recurring?.interval === "year");

  const features = [
    "Dashboard completo",
    "Gestão de clientes ilimitada",
    "Controle financeiro",
    "Controle de estoque",
    "Agenda e compromissos",
    "Orçamentos e vendas",
    "Relatórios avançados",
    "Gestão de equipe",
    "Caixa e fluxo de caixa",
    "Suporte prioritário",
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Zap className="w-3.5 h-3.5" />
            Planos GestorX7
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Escolha seu plano
          </h1>
          <p className="text-muted-foreground text-sm">
            Acesso completo a todos os módulos do sistema
          </p>
        </div>

        {/* Success / Canceled banners */}
        {success && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
            <p className="text-primary font-semibold">Pagamento realizado com sucesso!</p>
            <p className="text-sm text-muted-foreground mt-1">Seu plano foi ativado. Recarregue a página para atualizar seu acesso.</p>
            <Button size="sm" className="mt-3" onClick={() => window.location.href = "/"}>
              Ir para o sistema
            </Button>
          </div>
        )}
        {canceled && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
            <p className="text-destructive font-semibold">Pagamento cancelado</p>
            <p className="text-sm text-muted-foreground mt-1">Nenhuma cobrança foi feita. Escolha um plano abaixo para continuar.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : allPrices.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhum plano disponível no momento.</p>
            <p className="text-xs mt-1">Entre em contato com o suporte.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Mensal */}
            {monthlyPrice && (
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Plano Mensal</span>
                </div>
                <div className="mt-3 mb-4">
                  <span className="text-3xl font-bold text-foreground">
                    {formatPrice(monthlyPrice.unit_amount, monthlyPrice.currency)}
                  </span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handleCheckout(monthlyPrice.id)}
                  disabled={checkingOut === monthlyPrice.id}
                >
                  {checkingOut === monthlyPrice.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Assinar Mensal
                </Button>
              </div>
            )}

            {/* Anual */}
            {yearlyPrice && (
              <div className="bg-card border-2 border-[#C9A227] rounded-2xl p-6 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#C9A227] text-white text-xs font-bold px-3 py-1 rounded-full">
                    MELHOR VALOR
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-4 h-4 text-[#C9A227]" />
                  <span className="text-sm font-semibold text-foreground">Plano Anual</span>
                </div>
                {monthlyPrice && (
                  <p className="text-xs text-primary mt-0.5">
                    Economia de {formatPrice(monthlyPrice.unit_amount * 12 - yearlyPrice.unit_amount, yearlyPrice.currency)}/ano
                  </p>
                )}
                <div className="mt-3 mb-4">
                  <span className="text-3xl font-bold text-foreground">
                    {formatPrice(yearlyPrice.unit_amount / 12, yearlyPrice.currency)}
                  </span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    cobrado como {formatPrice(yearlyPrice.unit_amount, yearlyPrice.currency)}/ano
                  </p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-[#C9A227] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-[#C9A227] hover:bg-[#b8911f] text-white"
                  onClick={() => handleCheckout(yearlyPrice.id)}
                  disabled={checkingOut === yearlyPrice.id}
                >
                  {checkingOut === yearlyPrice.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Assinar Anual
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Manage subscription */}
        {user?.plan === "monthly" || user?.plan === "yearly" ? (
          <div className="text-center">
            <Button variant="outline" onClick={handlePortal} disabled={openingPortal}>
              {openingPortal ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Gerenciar minha assinatura
            </Button>
          </div>
        ) : null}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Pagamento seguro via Stripe · Cancele a qualquer momento
        </p>
      </div>
    </div>
  );
}
