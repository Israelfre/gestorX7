import { Headphones, Mail, MessageCircle, Clock } from "lucide-react";

export default function Suporte() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Headphones className="w-5 h-5 text-primary" />
          Suporte Técnico
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Precisa de ajuda? Entre em contato com a equipe GestorX7.
        </p>
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        {/* Header banner */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-5 text-center">
          <img
            src="/gestorx7-logo-new.png"
            alt="GestorX7"
            className="h-20 w-auto object-contain mx-auto mb-2 drop-shadow-[0_0_14px_rgba(201,162,39,0.6)]"
          />
          <h2 className="text-lg font-bold text-primary">GestorX7 — Suporte</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Nossa equipe está pronta para ajudar você a aproveitar ao máximo o sistema.
          </p>
        </div>

        {/* Contact options */}
        <div className="divide-y">
          {/* WhatsApp */}
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="w-11 h-11 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">WhatsApp</p>
              <p className="text-base font-bold">+55 (88) 99961-0970</p>
              <p className="text-xs text-muted-foreground">Resposta rápida via chat</p>
            </div>
            <a
              href="https://wa.me/5588999610970?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20com%20o%20GestorX7"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-lg hover:bg-[#1ebe59] transition-colors"
            >
              Abrir
            </a>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">E-mail</p>
              <p className="text-base font-bold">suporte@gestorx7.com.br</p>
              <p className="text-xs text-muted-foreground">Resposta em até 24 horas úteis</p>
            </div>
            <a
              href="mailto:suporte@gestorx7.com.br"
              className="shrink-0 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Enviar
            </a>
          </div>
        </div>

        {/* Hours footer */}
        <div className="px-6 py-4 bg-muted/30 border-t flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Atendimento: <strong className="text-foreground">Segunda a Sexta, 08h–18h</strong> · Sábado, 08h–12h
          </p>
        </div>
      </div>
    </div>
  );
}
