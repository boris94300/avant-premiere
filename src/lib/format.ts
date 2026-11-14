export const fEuros = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2).replace(".", ",")} Md€`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M€`
  : n >= 1e3 ? `${Math.round(n / 1e3)} k€` : `${Math.round(n)} €`;
export const fNombre = (n: number) => (n < 20 && n % 1 ? n.toFixed(1).replace(".", ",") : Math.round(n).toLocaleString("fr-FR"));
export const fPourcent = (n: number) => `${Math.round(n)} %`;
export const fHeure = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
export const fDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
export const FORMATS = { euros: fEuros, nombre: fNombre, pourcent: fPourcent };
