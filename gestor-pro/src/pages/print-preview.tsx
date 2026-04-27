export default function PrintPreview() {
  const company = {
    name: "Empresa Exemplo Ltda",
    cnpj: "12.345.678/0001-90",
    phone: "(11) 98765-4321",
    email: "contato@empresa.com.br",
    address: "Rua das Flores, 100 - Centro",
    city: "São Paulo - SP",
  };
  const quote = {
    id: "0001",
    clientName: "João da Silva",
    description: "Instalação elétrica completa — 3 cômodos com quadro de distribuição, tomadas, interruptores e luminárias.",
    amount: 4800,
    issued: new Date(),
    valid: new Date(Date.now() + 30 * 86400000),
  };
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
  const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Pré-visualização do Orçamento</h2>
            <p className="text-xs text-gray-500 mt-0.5">Modelo com dados de exemplo — preencha em Configurações</p>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Exemplo</span>
        </div>

        {/* Quote body */}
        <div className="p-8" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1AAF54", paddingBottom: "16px", marginBottom: "24px" }}>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#1AAF54", letterSpacing: "-0.5px" }}>{company.name}</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>CNPJ: {company.cnpj}</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "1px" }}>{company.phone} · {company.email}</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "1px" }}>{company.address} — {company.city}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#111" }}>ORÇAMENTO</div>
              <div style={{ fontSize: "13px", color: "#1AAF54", fontWeight: "600" }}>Nº {quote.id}</div>
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: "flex", gap: "24px", marginBottom: "24px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Emitido em</div>
              <div style={{ fontSize: "14px", fontWeight: "600" }}>{fmt(quote.issued)}</div>
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Válido até</div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#e67e00" }}>{fmt(quote.valid)}</div>
            </div>
            <div style={{ flex: 2, minWidth: "160px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Cliente</div>
              <div style={{ fontSize: "14px", fontWeight: "600" }}>{quote.clientName}</div>
            </div>
          </div>

          {/* Description */}
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "8px", padding: "16px 20px", marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Descrição do Serviço / Produto</div>
            <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#222" }}>{quote.description}</div>
          </div>

          {/* Amount */}
          <div style={{ background: "#1AAF54", borderRadius: "10px", padding: "20px 24px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Valor Total</div>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>{fmtCurrency(quote.amount)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#fff", fontWeight: "600" }}>
              Aguardando aprovação
            </div>
          </div>

          {/* Terms */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "120px", border: "1px solid #e9ecef", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Validade</div>
              <div style={{ fontSize: "13px", fontWeight: "600" }}>30 dias</div>
            </div>
            <div style={{ flex: 1, minWidth: "120px", border: "1px solid #e9ecef", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Status</div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#e67e00" }}>Pendente</div>
            </div>
            <div style={{ flex: 2, minWidth: "180px", border: "1px solid #e9ecef", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Condições de pagamento</div>
              <div style={{ fontSize: "13px", fontWeight: "600" }}>A combinar</div>
            </div>
          </div>

          {/* Signature */}
          <div style={{ display: "flex", gap: "32px", marginBottom: "32px" }}>
            <div style={{ flex: 1, borderTop: "1px solid #ddd", paddingTop: "8px" }}>
              <div style={{ fontSize: "11px", color: "#888" }}>Assinatura do Cliente</div>
            </div>
            <div style={{ flex: 1, borderTop: "1px solid #ddd", paddingTop: "8px" }}>
              <div style={{ fontSize: "11px", color: "#888" }}>Assinatura da Empresa</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e9ecef", paddingTop: "12px", textAlign: "center", fontSize: "11px", color: "#999" }}>
            Orçamento gerado pelo GestorX7 · Obrigado pela preferência!
          </div>
        </div>
      </div>
    </div>
  );
}
