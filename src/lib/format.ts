import { langue, locale } from "./i18n";

const dec = (n: number, d: number) => (langue() === "en" ? n.toFixed(d) : n.toFixed(d).replace(".", ","));
export const fDec = (n: number, d = 1) => dec(n, d);
export const fEuros = (n: number) => {
  const en = langue() === "en";
  const u = (v: string, fr: string, e: string) => (en ? `€${v}${e}` : `${v} ${fr}`);
  return n >= 1e9 ? u(dec(n / 1e9, 2), "Md€", "bn")
    : n >= 1e6 ? u(dec(n / 1e6, 1), "M€", "M")
    : n >= 1e3 ? u(String(Math.round(n / 1e3)), "k€", "k") : u(String(Math.round(n)), "€", "");
};
export const fNombre = (n: number) => (n < 20 && n % 1 ? dec(n, 1) : Math.round(n).toLocaleString(locale()));
export const fPourcent = (n: number) => (langue() === "en" ? `${Math.round(n)}%` : `${Math.round(n)} %`);
export const fHeure = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
export const fDate = (iso: string) => new Date(iso).toLocaleDateString(locale(), { month: "short", year: "numeric" });
export const fJour = (iso: string | Date) => new Date(iso).toLocaleDateString(locale(), langue() === "en" ? { day: "numeric", month: "short", year: "numeric" } : undefined);
export const FORMATS = { euros: fEuros, nombre: fNombre, pourcent: fPourcent };
