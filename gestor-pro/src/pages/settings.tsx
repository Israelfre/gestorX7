import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Save, CheckCircle2, ImagePlus, Trash2, Upload, User, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Nome da empresa obrigatório"),
  personType: z.enum(["PF", "PJ"]).default("PJ"),
  cnpj: z.string().default(""),
  cpf: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  city: z.string().default(""),
});
type SettingsForm = z.infer<typeof schema>;

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoLoading, setLogoLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", personType: "PJ", cnpj: "", cpf: "", phone: "", email: "", address: "", city: "" },
  });

  const personType = form.watch("personType");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        form.reset({
          name: data.name ?? "",
          personType: (data.personType as "PF" | "PJ") ?? "PJ",
          cnpj: data.cnpj ?? "",
          cpf: data.cpf ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
        });
        setLogoUrl(data.logoUrl ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveLogo = async (url: string) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form.getValues(), logoUrl: url }),
    });
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Use uma imagem de até 10MB.", variant: "destructive" });
      return;
    }
    setLogoLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoUrl(dataUrl);
      await saveLogo(dataUrl).catch(() => {});
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setLogoLoading(false);
      toast({ title: "Logo salva!", description: "A logo da empresa foi atualizada." });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeLogo = async () => {
    setLogoUrl("");
    await saveLogo("").catch(() => {});
    qc.invalidateQueries({ queryKey: ["company-settings"] });
    toast({ title: "Logo removida" });
  };

  const onSubmit = async (values: SettingsForm) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, logoUrl }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Configurações salvas!", description: "Os dados da empresa foram atualizados." });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Configurações da Empresa</h1>
          <p className="text-sm text-muted-foreground">Esses dados e logo aparecerão nos orçamentos, recibos e relatórios</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Logo ── */}
          <div className="bg-card border rounded-xl p-4 md:p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Logo da empresa</p>
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <div className="relative shrink-0">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-24 h-24 object-contain border rounded-xl bg-muted/30 p-1"
                  />
                  {logoLoading && (
                    <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 bg-muted/20">
                  <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/50">Sem logo</span>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  A logo aparecerá no cabeçalho dos orçamentos, recibos e relatórios impressos.
                </p>
                <p className="text-xs text-muted-foreground/70">PNG, JPG ou SVG — máximo 10MB. Fundo transparente recomendado.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="flex items-center gap-1.5 px-3 py-1.5 border text-destructive text-sm font-medium rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          {/* ── Form ── */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="bg-card border rounded-xl p-4 md:p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados da empresa</p>

                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da empresa *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Minha Empresa Ltda" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Tipo de pessoa ── */}
                <FormField control={form.control} name="personType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de pessoa</FormLabel>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => field.onChange("PJ")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${field.value === "PJ" ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-primary/40"}`}
                      >
                        <Briefcase className="w-4 h-4" />
                        Pessoa Jurídica (PJ)
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("PF")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${field.value === "PF" ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-primary/40"}`}
                      >
                        <User className="w-4 h-4" />
                        Pessoa Física (PF)
                      </button>
                    </div>
                  </FormItem>
                )} />

                {/* ── CNPJ ou CPF conforme tipo ── */}
                {personType === "PJ" ? (
                  <FormField control={form.control} name="cnpj" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0001-00"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <FormField control={form.control} name="cpf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCpf(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <div className="bg-card border rounded-xl p-4 md:p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato e endereço</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input placeholder="contato@empresa.com.br" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua Exemplo, 123 - Bairro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade / Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="São Paulo - SP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Button type="submit" className="w-full gap-2" disabled={form.formState.isSubmitting}>
                {saved ? (
                  <><CheckCircle2 className="w-4 h-4" />Salvo!</>
                ) : form.formState.isSubmitting ? "Salvando..." : (
                  <><Save className="w-4 h-4" />Salvar configurações</>
                )}
              </Button>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
