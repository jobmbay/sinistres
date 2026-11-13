const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Dakar",
});
const moisCourt = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const moisLong = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** 1250000 → « 1 250 000 » */
export function entier(n: number | null | undefined): string {
  return nombre.format(Number(n ?? 0));
}

/** 1250000 → « 1 250 000 FCFA » */
export function fcfa(n: number | null | undefined): string {
  return `${nombre.format(Number(n ?? 0))} FCFA`;
}

/** 1250000 → « 1,3 M » (pour les tuiles et les axes) */
export function abrege(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return Math.abs(v) < 10000 ? nombre.format(v) : compact.format(v);
}

export function date(v: string | null | undefined): string {
  if (!v) return "—";
  return dateCourte.format(new Date(v));
}

export function dateEnLettres(v: string | null | undefined): string {
  if (!v) return "—";
  return dateLongue.format(new Date(v));
}

export function dateEtHeure(v: string | null | undefined): string {
  if (!v) return "—";
  return dateHeure.format(new Date(v));
}

/** « 2026-03 » → « mars » */
export function libelleMois(cle: string, long = false): string {
  const d = new Date(`${cle}-01T00:00:00Z`);
  return long ? moisLong.format(d) : moisCourt.format(d).replace(".", "");
}

export function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

export function tailleFichier(octets: number | null | undefined): string {
  if (!octets) return "";
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/** Valeur pour <input type="datetime-local"> / <input type="date"> */
export function pourChampDate(v: string | null | undefined, avecHeure = false): string {
  if (!v) return "";
  const iso = new Date(v).toISOString();
  return avecHeure ? iso.slice(0, 16) : iso.slice(0, 10);
}

/** Lit un montant saisi (« 1 250 000 », « 1250000 ») */
export function lireMontant(v: FormDataEntryValue | null): number {
  const propre = String(v ?? "").replace(/[^\d]/g, "");
  return propre ? Number(propre) : 0;
}
