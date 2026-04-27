import { useQuery } from "@tanstack/react-query";

export type CompanySettings = {
  id: number;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logoUrl: string;
};

export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 60_000,
  });
}
