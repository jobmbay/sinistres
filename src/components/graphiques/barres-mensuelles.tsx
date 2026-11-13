"use client";

import { useMemo, useState } from "react";
import { Table2, ChartColumn } from "lucide-react";
import { cx } from "../ui";

export type SerieMensuelle = { cle: string; libelle: string; couleur: string };
export type PointMensuel = { cle: string; libelle: string; libelleLong: string; valeurs: Record<string, number> };

/** Graduations entières et régulières pour l'axe vertical (on compte des dossiers). */
function graduations(max: number): number[] {
  const brut = Math.max(1, max) / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = Math.max(1, [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut);
  const ticks: number[] = [];
  for (let v = 0; v < max + pas; v += pas) ticks.push(v);
  return ticks;
}

/**
 * Colonnes empilées : nombre de sinistres déclarés par mois et par famille.
 * Légende toujours visible, infobulle au survol et au clavier, vue tableau.
 */
export function BarresMensuelles({
  series,
  points,
  unite = "dossiers",
  large = false,
}: {
  series: SerieMensuelle[];
  points: PointMensuel[];
  unite?: string;
  /** Carte occupant toute la largeur de la page : le graphique s'étale sans grossir. */
  large?: boolean;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const [vueTableau, setVueTableau] = useState(false);

  const { ticks, max } = useMemo(() => {
    const plusHaut = Math.max(1, ...points.map((p) => series.reduce((s, serie) => s + (p.valeurs[serie.cle] ?? 0), 0)));
    const t = graduations(plusHaut);
    return { ticks: t, max: t[t.length - 1] };
  }, [points, series]);

  // Géométrie (unités du viewBox)
  const L = large ? 1120 : 760;
  const H = 340;
  const marge = { haut: 12, droite: 8, bas: 30, gauche: 34 };
  const largeur = L - marge.gauche - marge.droite;
  const hauteur = H - marge.haut - marge.bas;
  const bande = largeur / Math.max(1, points.length);
  const epaisseur = Math.min(24, bande * 0.55);
  const y = (v: number) => marge.haut + hauteur - (v / max) * hauteur;
  const total = (p: PointMensuel) => series.reduce((s, serie) => s + (p.valeurs[serie.cle] ?? 0), 0);

  const pointActif = actif !== null ? points[actif] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-encre-2">
          {series.map((s) => (
            <li key={s.cle} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.couleur }} />
              {s.libelle}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setVueTableau((v) => !v)}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-trait px-2.5 text-xs text-encre-2 transition hover:border-white/25 hover:text-encre"
        >
          {vueTableau ? <ChartColumn size={14} /> : <Table2 size={14} />}
          {vueTableau ? "Graphique" : "Tableau"}
        </button>
      </div>

      {vueTableau ? (
        <div className="max-h-80 overflow-auto">
          <table className="tableau">
            <thead>
              <tr>
                <th>Mois</th>
                {series.map((s) => (
                  <th key={s.cle} className="chiffre">
                    {s.libelle}
                  </th>
                ))}
                <th className="chiffre">Total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.cle}>
                  <td className="capitalize">{p.libelleLong}</td>
                  {series.map((s) => (
                    <td key={s.cle} className="chiffre text-encre-2">
                      {p.valeurs[s.cle] ?? 0}
                    </td>
                  ))}
                  <td className="chiffre font-medium">{total(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setActif(null)}>
          <svg viewBox={`0 0 ${L} ${H}`} className="block w-full" role="img" aria-label={`Sinistres déclarés par mois, en ${unite}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={marge.gauche} x2={L - marge.droite} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--graphique-axe)" : "var(--graphique-grille)"} strokeWidth="1" />
                <text x={marge.gauche - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-encre-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const cx0 = marge.gauche + bande * i + bande / 2;
              let cumul = 0;
              const segments = series
                .map((s) => ({ s, v: p.valeurs[s.cle] ?? 0 }))
                .filter((seg) => seg.v > 0);
              return (
                <g key={p.cle} opacity={actif === null || actif === i ? 1 : 0.45} style={{ transition: "opacity .15s" }}>
                  {actif === i && (
                    <rect x={cx0 - bande / 2 + 2} y={marge.haut} width={bande - 4} height={hauteur} rx="6" fill="rgb(255 255 255 / 0.04)" />
                  )}
                  {segments.map((seg, k) => {
                    const bas = y(cumul);
                    cumul += seg.v;
                    const haut = y(cumul);
                    const dernier = k === segments.length - 1;
                    // 2 px de surface entre deux segments empilés.
                    const h = Math.max(1, bas - haut - (dernier ? 0 : 2));
                    const yRect = bas - h;
                    const x = cx0 - epaisseur / 2;
                    const r = dernier ? Math.min(4, h) : 0;
                    return (
                      <path
                        key={seg.s.cle}
                        d={`M${x},${yRect + h} V${yRect + r} Q${x},${yRect} ${x + r},${yRect} H${x + epaisseur - r} Q${x + epaisseur},${yRect} ${x + epaisseur},${yRect + r} V${yRect + h} Z`}
                        fill={seg.s.couleur}
                      />
                    );
                  })}
                  <text x={cx0} y={H - 9} textAnchor="middle" fontSize="11" fill={actif === i ? "var(--color-encre)" : "var(--color-encre-3)"}>
                    {p.libelle}
                  </text>
                  {/* Cible de survol : toute la bande du mois */}
                  <rect
                    x={cx0 - bande / 2}
                    y={marge.haut}
                    width={bande}
                    height={hauteur + marge.bas}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.libelleLong} : ${total(p)} ${unite}`}
                    onMouseEnter={() => setActif(i)}
                    onFocus={() => setActif(i)}
                    onBlur={() => setActif(null)}
                    style={{ outline: "none" }}
                  />
                </g>
              );
            })}
          </svg>

          {pointActif && actif !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-trait-fort bg-[#06110f]/95 px-3.5 py-3 shadow-2xl backdrop-blur"
              style={{
                left: `${((marge.gauche + bande * (actif + 0.5)) / L) * 100}%`,
                transform: actif > points.length / 2 ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
              }}
            >
              <p className="mb-2 text-xs text-encre-3 capitalize">{pointActif.libelleLong}</p>
              <ul className="space-y-1.5">
                {series
                  .filter((s) => (pointActif.valeurs[s.cle] ?? 0) > 0)
                  .map((s) => (
                    <li key={s.cle} className="flex items-center gap-2 text-xs">
                      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.couleur }} />
                      <span className="flex-1 text-encre-2">{s.libelle}</span>
                      <span className="font-semibold text-encre tabular-nums">{pointActif.valeurs[s.cle]}</span>
                    </li>
                  ))}
              </ul>
              <p className={cx("mt-2 flex justify-between border-t border-trait pt-2 text-xs", "text-encre-2")}>
                Total <span className="font-semibold text-encre tabular-nums">{total(pointActif)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
