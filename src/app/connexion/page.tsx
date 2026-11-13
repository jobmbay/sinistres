import type { Metadata } from "next";
import { ShieldCheck, Network, Link2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

const ATOUTS = [
  {
    icone: Network,
    titre: "Toutes les branches, toutes les compagnies",
    texte: "Automobile, santé, incendie, transport, vie… un seul espace pour instruire chaque dossier.",
  },
  {
    icone: ShieldCheck,
    titre: "Des accès cloisonnés",
    texte: "Chaque compagnie ne voit que ses dossiers, chaque agent que les fonctions qui lui sont confiées.",
  },
  {
    icone: Link2,
    titre: "L'assuré suit son dossier",
    texte: "Un lien personnel lui montre l'avancement, les pièces attendues et l'offre d'indemnisation.",
  },
];

export default function PageConnexion() {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Présentation */}
      <section className="relative hidden overflow-hidden border-r border-trait lg:flex lg:flex-col lg:justify-between lg:p-12">
        <DecorConstellation />
        <Logo className="relative" />
        <div className="relative mt-24 max-w-lg">
          <h1 className="text-[2.6rem] leading-[1.1] font-light tracking-tight text-encre">
            La gestion des sinistres, <span className="text-or-clair">de la déclaration au règlement.</span>
          </h1>
          <ul className="mt-10 space-y-6">
            {ATOUTS.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="flex gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sarcelle/25 bg-sarcelle/10 text-sarcelle-clair">
                  <Icone size={19} strokeWidth={1.7} />
                </span>
                <span>
                  <span className="block font-medium text-encre">{titre}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-encre-3">{texte}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-encre-3">© AWA Africa — Plateforme réservée aux utilisateurs habilités.</p>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          <div className="carte p-7 sm:p-9">
            <h2 className="text-2xl font-normal tracking-tight text-encre">Connexion</h2>
            <p className="mt-1.5 text-sm text-encre-3">Accédez à votre espace de gestion des sinistres.</p>
            <div className="mt-7">
              <FormulaireConnexion />
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-encre-3">
            Vous êtes assuré ? Utilisez le lien de suivi reçu de votre gestionnaire.
          </p>
        </div>
      </section>
    </main>
  );
}

/** Illustration décorative (positions fixes, aucune donnée), cantonnée au haut et à la droite du panneau. */
function DecorConstellation() {
  const CENTRE = { x: 560, y: 150 };
  const noeuds = [
    { x: 440, y: 62, r: 8, c: "#e77a9d", fort: true },
    { x: 668, y: 58, r: 5, c: "#45c896" },
    { x: 335, y: 138, r: 5, c: "#9b8ff0" },
    { x: 690, y: 226, r: 9, c: "#e77a9d", fort: true },
    { x: 652, y: 372, r: 6, c: "#9b8ff0" },
    { x: 700, y: 520, r: 5, c: "#45c896" },
  ];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 720" preserveAspectRatio="xMaxYMin slice" aria-hidden>
      <defs>
        <radialGradient id="decor-noyau" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff1cf" />
          <stop offset="60%" stopColor="#dcb873" />
          <stop offset="100%" stopColor="#7a5c26" />
        </radialGradient>
        <radialGradient id="decor-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dcb873" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#dcb873" stopOpacity="0" />
        </radialGradient>
      </defs>
      {noeuds.map((n, i) => (
        <line
          key={`l${i}`}
          x1={CENTRE.x}
          y1={CENTRE.y}
          x2={n.x}
          y2={n.y}
          stroke={n.fort ? "#dcb873" : "#2fb8a8"}
          strokeOpacity={n.fort ? 0.55 : 0.3}
          strokeWidth={n.fort ? 1.5 : 1}
        />
      ))}
      <line x1="690" y1="226" x2="652" y2="372" stroke="#fff" strokeOpacity="0.16" strokeDasharray="2 4" />
      <line x1="652" y1="372" x2="700" y2="520" stroke="#fff" strokeOpacity="0.16" strokeDasharray="2 4" />
      <circle cx={CENTRE.x} cy={CENTRE.y} r="74" fill="url(#decor-halo)" />
      <circle cx={CENTRE.x} cy={CENTRE.y} r="31" fill="none" stroke="#dcb873" strokeOpacity="0.45" strokeDasharray="1.5 3" />
      <circle cx={CENTRE.x} cy={CENTRE.y} r="18" fill="url(#decor-noyau)" />
      {noeuds.map((n, i) => (
        <g key={`n${i}`}>
          <circle cx={n.x} cy={n.y} r={n.r + 5} fill={n.c} fillOpacity="0.14" />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} />
          <circle cx={n.x - n.r * 0.3} cy={n.y - n.r * 0.35} r={n.r * 0.3} fill="#fff" fillOpacity="0.5" />
        </g>
      ))}
    </svg>
  );
}
