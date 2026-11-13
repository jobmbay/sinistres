import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Ton } from "@/lib/referentiel";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Boutons                                                            */
/* ------------------------------------------------------------------ */

type Variante = "primaire" | "secondaire" | "fantome" | "danger";
type Taille = "sm" | "md";

const BASE_BOUTON =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition whitespace-nowrap " +
  "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none";

const VARIANTES: Record<Variante, string> = {
  primaire:
    "bg-gradient-to-b from-or-clair to-or text-[#1b1407] shadow-[0_8px_24px_-12px_rgb(220_184_115/0.8)] " +
    "hover:brightness-110 active:brightness-95",
  secondaire:
    "border border-trait-fort bg-white/[0.04] text-encre hover:border-white/25 hover:bg-white/[0.08] active:bg-white/[0.05]",
  fantome: "text-encre-2 hover:bg-white/[0.06] hover:text-encre",
  danger: "border border-critique/40 bg-critique/10 text-[#ffb3b1] hover:bg-critique/20",
};

const TAILLES: Record<Taille, string> = {
  sm: "h-9 px-3 text-[0.84rem]",
  md: "h-11 px-4 text-[0.925rem]",
};

export function classesBouton(variante: Variante = "secondaire", taille: Taille = "md", extra?: string) {
  return cx(BASE_BOUTON, VARIANTES[variante], TAILLES[taille], extra);
}

export function Bouton({
  variante = "secondaire",
  taille = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; taille?: Taille }) {
  return <button {...props} className={classesBouton(variante, taille, className)} />;
}

export function LienBouton({
  variante = "secondaire",
  taille = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; taille?: Taille }) {
  return <Link {...props} className={classesBouton(variante, taille, className)} />;
}

/* ------------------------------------------------------------------ */
/*  Cartes et mise en page                                             */
/* ------------------------------------------------------------------ */

export function Carte({ className, ...props }: ComponentProps<"section">) {
  return <section {...props} className={cx("carte", className)} />;
}

export function EnTeteCarte({
  titre,
  description,
  action,
  compteur,
}: {
  titre: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compteur?: number;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-[1.02rem] font-medium text-encre">
          {compteur !== undefined && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-sarcelle/15 px-1.5 text-xs font-medium text-sarcelle-clair">
              {compteur}
            </span>
          )}
          {titre}
        </h2>
        {description && <p className="mt-1 text-sm text-encre-3">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function EnTetePage({
  titre,
  description,
  actions,
  retour,
}: {
  titre: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  retour?: { href: string; libelle: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {retour && (
          <Link
            href={retour.href}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-encre-3 transition hover:text-encre"
          >
            <span aria-hidden>←</span> {retour.libelle}
          </Link>
        )}
        <h1 className="text-[1.7rem] leading-tight font-normal tracking-tight text-encre">{titre}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-encre-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pastilles d'état                                                   */
/* ------------------------------------------------------------------ */

const TONS: Record<Ton, string> = {
  neutre: "border-white/12 bg-white/[0.05] text-encre-2",
  info: "border-sarcelle/30 bg-sarcelle/10 text-sarcelle-clair",
  violet: "border-violet/30 bg-violet/10 text-[#c9c2ff]",
  or: "border-or/35 bg-or/10 text-or-clair",
  bon: "border-bon/30 bg-bon/10 text-[#8eeaa9]",
  attention: "border-attention/35 bg-attention/10 text-[#ffd77a]",
  critique: "border-critique/35 bg-critique/10 text-[#ffb3b1]",
};

const POINTS: Record<Ton, string> = {
  neutre: "bg-encre-3",
  info: "bg-sarcelle",
  violet: "bg-violet",
  or: "bg-or",
  bon: "bg-bon",
  attention: "bg-attention",
  critique: "bg-critique",
};

export function Pastille({
  ton = "neutre",
  children,
  point = true,
  className,
}: {
  ton?: Ton;
  children: ReactNode;
  point?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONS[ton],
        className,
      )}
    >
      {point && <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", POINTS[ton])} />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Formulaires                                                        */
/* ------------------------------------------------------------------ */

export function Champ({
  libelle,
  aide,
  requis,
  children,
  className,
}: {
  libelle: string;
  aide?: string;
  requis?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="etiquette">
        {libelle}
        {requis && (
          <span className="ml-1 text-or" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
      {aide && <span className="mt-1.5 block text-xs text-encre-3">{aide}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Divers                                                             */
/* ------------------------------------------------------------------ */

export function Vide({
  icone,
  titre,
  description,
  action,
}: {
  icone?: ReactNode;
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icone && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-trait bg-white/[0.04] text-encre-3">
          {icone}
        </div>
      )}
      <p className="text-[0.98rem] font-medium text-encre">{titre}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-encre-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alerte({ ton = "critique", children }: { ton?: "critique" | "bon" | "attention" | "info"; children: ReactNode }) {
  return (
    <div role={ton === "critique" ? "alert" : "status"} className={cx("rounded-xl border px-3.5 py-2.5 text-sm", TONS[ton])}>
      {children}
    </div>
  );
}

export function Avatar({ texte, taille = "md", ton = "sarcelle" }: { texte: string; taille?: "sm" | "md"; ton?: "sarcelle" | "or" | "rose" }) {
  const couleurs = {
    sarcelle: "from-sarcelle/40 to-sarcelle/10 text-sarcelle-clair border-sarcelle/30",
    or: "from-or/40 to-or/10 text-or-clair border-or/30",
    rose: "from-rose/40 to-rose/10 text-[#ffc2d6] border-rose/30",
  }[ton];
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full border bg-gradient-to-br font-medium",
        couleurs,
        taille === "sm" ? "h-7 w-7 text-[0.65rem]" : "h-9 w-9 text-xs",
      )}
    >
      {texte}
    </span>
  );
}

/** Ligne « libellé ....... valeur » des fiches de détail. */
export function LigneDetail({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2 text-sm">
      <dt className="shrink-0 text-encre-3">{libelle}</dt>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-white/12" />
      <dd className="max-w-[62%] text-right break-words text-encre">{children}</dd>
    </div>
  );
}
