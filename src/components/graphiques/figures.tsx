import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cx } from "../ui";

/* ------------------------------------------------------------------ */
/*  Tuile de chiffre clé                                               */
/* ------------------------------------------------------------------ */

export function TuileChiffre({
  libelle,
  valeur,
  unite,
  icone,
  detail,
  variation,
  accent = false,
}: {
  libelle: string;
  valeur: string;
  unite?: string;
  icone?: ReactNode;
  /** Ligne secondaire sous la valeur. */
  detail?: ReactNode;
  /** Écart signé par rapport à la période précédente ; `hausseFavorable` décide de la couleur. */
  variation?: { valeur: number; periode: string; hausseFavorable?: boolean };
  accent?: boolean;
}) {
  const sens = variation ? Math.sign(variation.valeur) : 0;
  const favorable = variation ? (variation.hausseFavorable ? sens > 0 : sens < 0) : false;
  const Icone = sens > 0 ? TrendingUp : sens < 0 ? TrendingDown : Minus;

  return (
    <div className={cx("carte flex flex-col justify-between gap-3 p-4 sm:p-5", accent && "border-or/30")}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-encre-2">
          <span aria-hidden className={cx("h-4 w-[3px] rounded-full", accent ? "bg-or" : "bg-sarcelle")} />
          {libelle}
        </span>
        {icone && <span className="text-encre-3">{icone}</span>}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-[1.75rem] leading-none font-light tracking-tight text-encre sm:text-[2rem]">{valeur}</span>
        {unite && <span className="text-sm text-encre-3">{unite}</span>}
      </p>
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug text-encre-3">
        {variation && (
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium",
              sens === 0 ? "bg-white/[0.06] text-encre-2" : favorable ? "bg-bon/12 text-[#8eeaa9]" : "bg-critique/12 text-[#ffb3b1]",
            )}
          >
            <Icone size={12} />
            {variation.valeur > 0 ? "+" : ""}
            {variation.valeur}
          </span>
        )}
        {variation ? <span>{variation.periode}</span> : detail}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Jauge en demi-cercle : répartition d'un tout en quelques parts     */
/* ------------------------------------------------------------------ */

export type PartJauge = { cle: string; libelle: string; valeur: number; couleur: string };

function arc(cx0: number, cy0: number, rayon: number, debut: number, fin: number) {
  const point = (angle: number) => [cx0 + rayon * Math.cos(angle), cy0 + rayon * Math.sin(angle)];
  const [x1, y1] = point(debut);
  const [x2, y2] = point(fin);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${rayon},${rayon} 0 ${fin - debut > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

export function JaugeRepartition({ parts, libelleTotal }: { parts: PartJauge[]; libelleTotal: string }) {
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  const ECART = 0.035; // 2 px de surface entre deux parts
  const visibles = parts.filter((p) => p.valeur > 0);
  const arcs = visibles.map((p, i) => {
    const avant = visibles.slice(0, i).reduce((s, q) => s + q.valeur, 0);
    const debut = Math.PI + (avant / Math.max(1, total)) * Math.PI;
    const fin = Math.PI + ((avant + p.valeur) / Math.max(1, total)) * Math.PI;
    return { ...p, debut: debut + ECART / 2, fin: Math.max(debut + ECART / 2 + 0.001, fin - ECART / 2) };
  });

  return (
    <div>
      <div className="relative mx-auto max-w-[19rem]">
        <svg viewBox="0 0 240 132" className="block w-full" role="img" aria-label={`${libelleTotal} : ${total}`}>
          {/* Piste graduée */}
          <path d={arc(120, 122, 96, Math.PI, 2 * Math.PI)} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="14" />
          {Array.from({ length: 41 }, (_, i) => {
            const a = Math.PI + (i / 40) * Math.PI;
            return (
              <line
                key={i}
                x1={120 + 82 * Math.cos(a)}
                y1={122 + 82 * Math.sin(a)}
                x2={120 + 86 * Math.cos(a)}
                y2={122 + 86 * Math.sin(a)}
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth="1"
              />
            );
          })}
          {arcs.map((a) => (
            <path key={a.cle} d={arc(120, 122, 96, a.debut, a.fin)} fill="none" stroke={a.couleur} strokeWidth="14" />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-[2.2rem] leading-none font-light tracking-tight text-encre">{total.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-sm text-encre-3">{libelleTotal}</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-2">
        {parts.map((p) => {
          const part = total > 0 ? Math.round((p.valeur / total) * 100) : 0;
          return (
            <li key={p.cle} className="carte-plate px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs text-encre-2">
                <span aria-hidden className="h-3 w-1.5 rounded-sm" style={{ background: p.couleur }} />
                {p.libelle}
              </p>
              <p className="mt-1.5 text-sm">
                <span className="text-base font-semibold text-encre">{part}%</span>
                <span className="text-encre-3"> / {p.valeur}</span>
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${part}%`, background: p.couleur }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Barre graduée : un taux, lu d'un coup d'œil                        */
/* ------------------------------------------------------------------ */

export function BarreGraduee({ taux, libelle }: { taux: number; libelle: string }) {
  const borne = Math.max(0, Math.min(100, taux));
  const CRANS = 48;
  const allumes = Math.round((borne / 100) * CRANS);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(borne)}
      aria-label={libelle}
      className="flex h-9 items-stretch gap-[3px] rounded-lg border border-trait bg-black/30 p-1.5"
    >
      {Array.from({ length: CRANS }, (_, i) => (
        <span key={i} className={cx("flex-1 rounded-[1px]", i < allumes ? "bg-sarcelle-clair/85" : "bg-sarcelle/15")} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tendance en points : 12 périodes, la dernière mise en avant        */
/* ------------------------------------------------------------------ */

export function TendancePoints({ valeurs, libelle }: { valeurs: number[]; libelle: string }) {
  const max = Math.max(1, ...valeurs);
  const LIGNES = 6;
  return (
    <div role="img" aria-label={libelle} className="flex items-end gap-[5px]">
      {valeurs.map((v, i) => {
        const hauteur = v === 0 ? 1 : Math.max(1, Math.round((v / max) * LIGNES));
        const dernier = i === valeurs.length - 1;
        return (
          <span key={i} className="flex flex-col-reverse gap-[3px]">
            {Array.from({ length: hauteur }, (_, k) => (
              <span
                key={k}
                className={cx(
                  "h-[5px] w-[5px] rounded-[1px]",
                  dernier ? "bg-or-clair shadow-[0_0_6px_rgb(243_220_171/0.7)]" : v === 0 ? "bg-white/10" : "bg-white/30",
                )}
              />
            ))}
          </span>
        );
      })}
    </div>
  );
}
