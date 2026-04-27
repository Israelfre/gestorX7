export function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  // If already has time component, parse directly; otherwise append to avoid UTC offset issues
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR");
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}
