export function montantTranche(t: string | null | undefined): number {
  if (!t) return 0;
  const nums = [...t.matchAll(/([\d.,]+)\s*(k|M|Md)?/gi)].map((m) => {
    const n = parseFloat(m[1].replace(",", "."));
    const u = (m[2] || "").toLowerCase();
    return n * (u === "k" ? 1e3 : u === "m" ? 1e6 : u === "md" ? 1e9 : 1);
  }).filter((n) => n > 0);
  if (!nums.length) return 0;
  return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
}

export function deptDepuisCodePostal(cp: string | null | undefined): string | null {
  if (!cp) return null;
  const s = String(cp).trim();
  if (/^2[AB]/i.test(s)) return s.slice(0, 2).toUpperCase();
  if (!/^\d{5}$/.test(s)) return /^\d{2,3}$/.test(s) ? normDept(s) : null;
  if (s.startsWith("20")) return Number(s) < 20200 ? "2A" : "2B";
  if (s.startsWith("97")) return s.slice(0, 3);
  return s.slice(0, 2);
}

export function normDept(d: string): string {
  const s = String(d).trim().toUpperCase();
  if (/^0\d\d$/.test(s)) return s.slice(1);
  if (/^\d$/.test(s)) return "0" + s;
  return s;
}

export function deptsListe(v: string | null | undefined): string[] {
  if (!v) return [];
  return String(v).split(/[|,;\s]+/).filter(Boolean).map(normDept);
}

export function ajouterMois(date: string, mois: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + mois);
  return d;
}

export const euros = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".", ",")} Md€`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M€`
  : n >= 1e3 ? `${Math.round(n / 1e3)} k€` : `${Math.round(n)} €`;

export function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

export function mediane(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
