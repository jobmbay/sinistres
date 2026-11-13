"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TypeNoeud = "compagnie" | "branche";

export type NoeudEnfant = {
  id: string;
  libelle: string;
  valeur: number;
  href?: string;
};
export type NoeudPrincipal = {
  id: string;
  libelle: string;
  valeur: number;
  /** Part du total, en pourcentage. */
  part: number;
  type: TypeNoeud;
  /** Lien pointillé : relation indirecte (compagnie adverse, par exemple). */
  indirect?: boolean;
  detail?: string;
  href?: string;
  enfants: NoeudEnfant[];
};
export type LienCroise = { de: string; vers: string; valeur: number };

// Cadre volontairement compact : à la largeur d'une carte, une unité vaut
// presque un pixel, et les libellés restent lisibles.
const L = 880;
const H = 560;
const CX = 440;
const CY = 258;
const RX = 232;
const RY = 186;

const COULEURS: Record<
  TypeNoeud | "centre" | "enfant",
  { clair: string; base: string; sombre: string }
> = {
  centre: { clair: "#fff3d6", base: "#dcb873", sombre: "#7a5c26" },
  compagnie: { clair: "#ffd3e0", base: "#e77a9d", sombre: "#8a2f52" },
  branche: { clair: "#ddd8ff", base: "#9b8ff0", sombre: "#4b3fa3" },
  enfant: { clair: "#c9f5e2", base: "#45c896", sombre: "#1b7350" },
};

type Boite = { x1: number; y1: number; x2: number; y2: number };
type Place = NoeudPrincipal & {
  x: number;
  y: number;
  rayon: number;
  aGauche: boolean;
  xTexte: number;
  libelleCourt: string;
  enfantsPlaces: (NoeudEnfant & { x: number; y: number })[];
};

/** Plaque du noyau (libellé + total), sous le noyau. */
const PLAQUE = { largeur: 196, hauteur: 54, y: CY + 46 };

/**
 * Place les nœuds principaux sur deux orbites, puis leurs nœuds secondaires
 * un à un, en écartant toute position qui toucherait un libellé, un autre
 * nœud ou le bord : la lisibilité est garantie par construction.
 */
function disposer(principaux: NoeudPrincipal[]): Place[] {
  const n = principaux.length;
  const maxValeur = Math.max(1, ...principaux.map((p) => p.valeur));
  // Décalage qui laisse libre le bas du noyau, où se trouve sa plaque.
  const decalage = n % 2 === 0 ? Math.PI / Math.max(1, n) : 0;

  const bases = principaux.map((p, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n) + decalage;
    const orbite = n <= 4 ? 0.85 : i % 2 === 0 ? 1 : 0.72;
    const x = CX + Math.cos(angle) * RX * orbite;
    const y = CY + Math.sin(angle) * RY * orbite;
    const rayon = 11 + 9 * Math.sqrt(p.valeur / maxValeur);
    const aGauche = Math.cos(angle) < -0.25;
    const libelleCourt =
      p.libelle.length > 20 ? `${p.libelle.slice(0, 19)}…` : p.libelle;
    const largeur = libelleCourt.length * 9 + 10;
    const xTexte = aGauche ? x - rayon - 12 : x + rayon + 12;
    const boite: Boite = {
      x1: aGauche ? xTexte - largeur : xTexte,
      x2: aGauche ? xTexte : xTexte + largeur,
      y1: y - 22,
      y2: y + 30,
    };
    return { ...p, x, y, rayon, angle, aGauche, xTexte, libelleCourt, boite };
  });

  const boites: Boite[] = [
    ...bases.map((b) => b.boite),
    {
      x1: CX - PLAQUE.largeur / 2,
      x2: CX + PLAQUE.largeur / 2,
      y1: PLAQUE.y,
      y2: PLAQUE.y + PLAQUE.hauteur,
    },
  ];
  const occupes = [
    { x: CX, y: CY, r: 50 },
    ...bases.map((b) => ({ x: b.x, y: b.y, r: b.rayon + 8 })),
  ];
  const dansUneBoite = (x: number, y: number, marge: number) =>
    boites.some(
      (b) =>
        x > b.x1 - marge &&
        x < b.x2 + marge &&
        y > b.y1 - marge &&
        y < b.y2 + marge,
    );

  return bases.map((b) => {
    const candidats = [b.rayon + 42, b.rayon + 62]
      .flatMap((distance, rang) =>
        [0, 1, -1, 2, -2, 3, -3, 4, -4].map((k) => ({
          angle: b.angle + k * 0.5,
          distance,
          cout: Math.abs(k) + rang * 0.5,
        })),
      )
      .sort((a, c) => a.cout - c.cout);

    const enfantsPlaces: Place["enfantsPlaces"] = [];
    for (const enfant of b.enfants.slice(0, 4)) {
      const index = candidats.findIndex((c) => {
        const x = b.x + Math.cos(c.angle) * c.distance;
        const y = b.y + Math.sin(c.angle) * c.distance * 0.9;
        if (x < 26 || x > L - 44 || y < 26 || y > H - 18) return false;
        // Le nœud lui-même, et son petit chiffre en haut à droite.
        if (dansUneBoite(x, y, 13) || dansUneBoite(x + 18, y - 10, 8))
          return false;
        return !occupes.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 17);
      });
      if (index < 0) continue;
      const [choisi] = candidats.splice(index, 1);
      const x = b.x + Math.cos(choisi.angle) * choisi.distance;
      const y = b.y + Math.sin(choisi.angle) * choisi.distance * 0.9;
      occupes.push({ x, y, r: 13 });
      enfantsPlaces.push({ ...enfant, x, y });
    }
    return { ...b, enfantsPlaces };
  });
}

/** Liseré sombre autour du texte : il reste lisible lorsqu'un lien passe derrière. */
const HALO = {
  paintOrder: "stroke",
  stroke: "#071312",
  strokeWidth: 4,
  strokeLinejoin: "round",
} as const;

function courbe(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  courbure = 0.18,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Point de contrôle repoussé vers l'extérieur du centre.
  const dx = mx - CX;
  const dy = my - CY;
  const norme = Math.hypot(dx, dy) || 1;
  const portee = Math.hypot(x2 - x1, y2 - y1) * courbure;
  return `M${x1},${y1} Q${mx + (dx / norme) * portee},${my + (dy / norme) * portee} ${x2},${y2}`;
}

/**
 * Cartographie du portefeuille : un noyau, ses compagnies ou branches en
 * orbite, et les liens entre compagnies adverses.
 * Chaque nœud est cliquable (souris et clavier) et ouvre la liste filtrée.
 */
export function Constellation({
  centre,
  principaux,
  croises = [],
  legende,
  libelleEnfants,
}: {
  centre: { libelle: string; valeur: number; unite: string };
  principaux: NoeudPrincipal[];
  croises?: LienCroise[];
  legende: {
    type: TypeNoeud | "centre" | "enfant" | "croise";
    libelle: string;
    valeur?: number;
  }[];
  libelleEnfants: string;
}) {
  const routeur = useRouter();
  const [survol, setSurvol] = useState<string | null>(null);
  const defilement = useRef<HTMLDivElement>(null);

  // Sur petit écran le graphe défile horizontalement : on démarre centré sur le noyau.
  useEffect(() => {
    const zone = defilement.current;
    if (zone) zone.scrollLeft = (zone.scrollWidth - zone.clientWidth) / 2;
  }, []);
  const places = useMemo(() => disposer(principaux), [principaux]);
  const parId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const maxValeur = Math.max(1, ...places.map((p) => p.valeur));
  const rangs = [...places]
    .sort((a, b) => b.valeur - a.valeur)
    .map((p) => p.id);

  const lie = (id: string) =>
    survol === null ||
    survol === id ||
    croises.some(
      (c) =>
        (c.de === survol && c.vers === id) ||
        (c.vers === survol && c.de === id),
    );

  const actif = survol ? parId.get(survol) : null;
  const ouvrir = (href?: string) => href && routeur.push(href);

  return (
    <div>
      <div ref={defilement} className="overflow-x-auto">
        <div className="relative min-w-[40rem]">
          <svg
            viewBox={`0 0 ${L} ${H}`}
            className="block w-full"
            role="group"
            aria-label="Cartographie du portefeuille de sinistres"
          >
            <defs>
              {(Object.keys(COULEURS) as (keyof typeof COULEURS)[]).map(
                (cle) => (
                  <radialGradient
                    key={cle}
                    id={`sphere-${cle}`}
                    cx="36%"
                    cy="30%"
                    r="78%"
                  >
                    <stop offset="0%" stopColor={COULEURS[cle].clair} />
                    <stop offset="52%" stopColor={COULEURS[cle].base} />
                    <stop offset="100%" stopColor={COULEURS[cle].sombre} />
                  </radialGradient>
                ),
              )}
              <radialGradient id="halo-centre" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#dcb873" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#dcb873" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="lien-or" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f3dcab" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#dcb873" stopOpacity="0.35" />
              </linearGradient>
              <filter id="lueur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* Orbites */}
            <ellipse
              cx={CX}
              cy={CY}
              rx={RX}
              ry={RY}
              fill="none"
              stroke="rgb(255 255 255 / 0.05)"
            />
            <ellipse
              cx={CX}
              cy={CY}
              rx={RX * 0.72}
              ry={RY * 0.72}
              fill="none"
              stroke="rgb(255 255 255 / 0.04)"
              strokeDasharray="2 6"
            />

            {/* Liens entre compagnies adverses */}
            {croises.map((c) => {
              const a = parId.get(c.de);
              const b = parId.get(c.vers);
              if (!a || !b) return null;
              const visible =
                survol === null || survol === c.de || survol === c.vers;
              return (
                <path
                  key={`${c.de}-${c.vers}`}
                  d={courbe(a.x, a.y, b.x, b.y)}
                  fill="none"
                  stroke="#f3dcab"
                  strokeOpacity={visible ? (survol ? 0.75 : 0.3) : 0.06}
                  strokeWidth={survol && visible ? 1.6 : 1}
                  strokeDasharray="3 5"
                  style={{ transition: "stroke-opacity .2s" }}
                />
              );
            })}

            {/* Liens noyau → nœuds principaux */}
            {places.map((p) => {
              const fort = rangs.indexOf(p.id) < 3 && !p.indirect;
              const epaisseur = 1 + 3 * (p.valeur / maxValeur);
              return (
                <g
                  key={`lien-${p.id}`}
                  opacity={lie(p.id) ? 1 : 0.2}
                  style={{ transition: "opacity .2s" }}
                >
                  {fort && (
                    <line
                      x1={CX}
                      y1={CY}
                      x2={p.x}
                      y2={p.y}
                      stroke="#dcb873"
                      strokeOpacity="0.35"
                      strokeWidth={epaisseur + 5}
                      filter="url(#lueur)"
                    />
                  )}
                  <line
                    x1={CX}
                    y1={CY}
                    x2={p.x}
                    y2={p.y}
                    stroke={
                      fort ? "#e8cd92" : p.indirect ? "#ffffff" : "#5fc7ba"
                    }
                    strokeOpacity={fort ? 0.9 : p.indirect ? 0.22 : 0.5}
                    strokeWidth={p.indirect ? 1 : epaisseur}
                    strokeDasharray={p.indirect ? "3 5" : undefined}
                    strokeLinecap="round"
                  />
                  {p.enfantsPlaces.map((e) => (
                    <line
                      key={e.id}
                      x1={p.x}
                      y1={p.y}
                      x2={e.x}
                      y2={e.y}
                      stroke="#ffffff"
                      strokeOpacity="0.2"
                      strokeDasharray="2 4"
                    />
                  ))}
                </g>
              );
            })}

            {/* Noyau */}
            <g>
              <circle cx={CX} cy={CY} r="92" fill="url(#halo-centre)" />
              <circle
                cx={CX}
                cy={CY}
                r="44"
                fill="none"
                stroke="#dcb873"
                strokeOpacity="0.5"
                strokeDasharray="1.5 3.5"
                className="animate-pulsation"
              />
              <circle
                cx={CX}
                cy={CY}
                r="37"
                fill="none"
                stroke="#2fb8a8"
                strokeOpacity="0.55"
              />
              <circle
                cx={CX}
                cy={CY}
                r="31"
                fill="none"
                stroke="#dcb873"
                strokeOpacity="0.8"
                strokeWidth="2.5"
                strokeDasharray="1 2.2"
              />
              <circle cx={CX} cy={CY} r="24" fill="url(#sphere-centre)" />
              <g
                transform={`translate(${CX - PLAQUE.largeur / 2}, ${PLAQUE.y})`}
              >
                <rect
                  width={PLAQUE.largeur}
                  height={PLAQUE.hauteur}
                  rx="12"
                  fill="#06110f"
                  fillOpacity="0.88"
                  stroke="rgb(220 184 115 / 0.3)"
                />
                <text
                  x={PLAQUE.largeur / 2}
                  y="23"
                  textAnchor="middle"
                  fontSize="17"
                  fill="var(--color-encre)"
                >
                  {centre.libelle.length > 20
                    ? `${centre.libelle.slice(0, 19)}…`
                    : centre.libelle}
                </text>
                <text
                  x={PLAQUE.largeur / 2}
                  y="43"
                  textAnchor="middle"
                  fontSize="14"
                  fill="var(--color-encre-2)"
                >
                  <tspan fontWeight="600" fill="var(--color-or-clair)">
                    {centre.valeur.toLocaleString("fr-FR")}
                  </tspan>{" "}
                  {centre.unite}
                </text>
              </g>
            </g>

            {/* Nœuds secondaires */}
            {places.map((p) => (
              <g
                key={`enfants-${p.id}`}
                opacity={lie(p.id) ? 1 : 0.2}
                style={{ transition: "opacity .2s" }}
              >
                {p.enfantsPlaces.map((e) => (
                  <g
                    key={e.id}
                    role={e.href ? "link" : undefined}
                    tabIndex={e.href ? 0 : undefined}
                    aria-label={`${e.libelle} — ${p.libelle} : ${e.valeur} dossiers`}
                    onClick={() => ouvrir(e.href)}
                    onKeyDown={(evt) => evt.key === "Enter" && ouvrir(e.href)}
                    style={{
                      cursor: e.href ? "pointer" : "default",
                      outline: "none",
                    }}
                  >
                    <title>{`${e.libelle} : ${e.valeur}`}</title>
                    <circle cx={e.x} cy={e.y} r="13" fill="transparent" />
                    <circle
                      cx={e.x}
                      cy={e.y}
                      r="9"
                      fill={COULEURS.enfant.base}
                      fillOpacity="0.14"
                    />
                    <circle
                      cx={e.x}
                      cy={e.y}
                      r="5.5"
                      fill="url(#sphere-enfant)"
                    />
                    <text
                      x={e.x + 9}
                      y={e.y - 7}
                      fontSize="13.5"
                      fontWeight="600"
                      fill="var(--color-encre-2)"
                      style={HALO}
                    >
                      {e.valeur}
                    </text>
                  </g>
                ))}
              </g>
            ))}

            {/* Nœuds principaux */}
            {places.map((p) => {
              const ancre = p.aGauche ? "end" : "start";
              const xTexte = p.xTexte;
              const libelle = p.libelleCourt;
              const etiquette = `${p.part}%`;
              const largeurPuce = etiquette.length * 8.4 + 14;
              return (
                <g
                  key={p.id}
                  role={p.href ? "link" : undefined}
                  tabIndex={p.href ? 0 : undefined}
                  aria-label={`${p.libelle} : ${p.valeur} dossiers, ${p.part}% du total`}
                  opacity={lie(p.id) ? 1 : 0.28}
                  onMouseEnter={() => setSurvol(p.id)}
                  onMouseLeave={() => setSurvol(null)}
                  onFocus={() => setSurvol(p.id)}
                  onBlur={() => setSurvol(null)}
                  onClick={() => ouvrir(p.href)}
                  onKeyDown={(evt) => evt.key === "Enter" && ouvrir(p.href)}
                  style={{
                    cursor: p.href ? "pointer" : "default",
                    transition: "opacity .2s",
                    outline: "none",
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.rayon + 14}
                    fill="transparent"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.rayon + 7}
                    fill={COULEURS[p.type].base}
                    fillOpacity={survol === p.id ? 0.3 : 0.14}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.rayon + 3.5}
                    fill="none"
                    stroke={COULEURS[p.type].base}
                    strokeOpacity="0.6"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.rayon}
                    fill={`url(#sphere-${p.type})`}
                  />
                  <text
                    x={xTexte}
                    y={p.y - 4}
                    textAnchor={ancre}
                    fontSize="17"
                    fill="var(--color-encre)"
                    style={HALO}
                  >
                    {libelle}
                  </text>
                  <g
                    transform={`translate(${p.aGauche ? xTexte - largeurPuce : xTexte}, ${p.y + 5})`}
                  >
                    <rect
                      width={largeurPuce}
                      height="21"
                      rx="5"
                      fill="rgb(255 255 255 / 0.1)"
                    />
                    <text
                      x={largeurPuce / 2}
                      y="15.5"
                      textAnchor="middle"
                      fontSize="13.5"
                      fontWeight="600"
                      fill="var(--color-encre)"
                    >
                      {etiquette}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Infobulle */}
          {actif && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 w-56 rounded-xl border border-trait-fort bg-[#06110f]/95 px-3.5 py-3 shadow-2xl backdrop-blur"
              style={{
                left: `${(actif.x / L) * 100}%`,
                top: `${(actif.y / H) * 100}%`,
                transform: `translate(${actif.x > L * 0.62 ? "calc(-100% - 28px)" : "28px"}, ${actif.y > H * 0.6 ? "-105%" : "18px"})`,
              }}
            >
              <p className="text-sm font-medium text-encre">{actif.libelle}</p>
              <p className="mt-1 text-xs text-encre-3">
                <span className="text-base font-semibold text-encre">
                  {actif.valeur.toLocaleString("fr-FR")}
                </span>{" "}
                dossiers · {actif.part}% du total
              </p>
              {actif.detail && (
                <p className="mt-1 text-xs text-encre-3">{actif.detail}</p>
              )}
              {actif.enfants.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-trait pt-2">
                  <li className="surtitre !text-[0.62rem]">{libelleEnfants}</li>
                  {actif.enfants.slice(0, 4).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 text-xs text-encre-2"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full bg-menthe"
                      />
                      <span className="flex-1 truncate">{e.libelle}</span>
                      <span className="font-semibold text-encre tabular-nums">
                        {e.valeur}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {actif.href && (
                <p className="mt-2 text-[0.7rem] text-or-clair">
                  Cliquer pour ouvrir les dossiers →
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Légende */}
      <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 px-2 text-xs text-encre-2">
        {legende.map((l) => (
          <li key={l.libelle} className="flex items-center gap-2">
            {l.type === "croise" ? (
              <span
                aria-hidden
                className="w-4 border-t border-dashed border-or-clair/80"
              />
            ) : (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COULEURS[l.type].base }}
              />
            )}
            {l.libelle}
            {l.valeur !== undefined && (
              <span className="text-encre-3 tabular-nums">{l.valeur}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
