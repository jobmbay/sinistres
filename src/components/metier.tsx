import { Check } from "lucide-react";
import { ETAPES, PRIORITES, STATUTS, type Ton } from "@/lib/referentiel";
import type { Priorite, Statut } from "@/lib/types";
import { Pastille, cx } from "./ui";

export function PastilleStatut({ statut }: { statut: Statut }) {
  const s = STATUTS[statut];
  return <Pastille ton={s.ton}>{s.libelle}</Pastille>;
}

export function PastillePriorite({ priorite }: { priorite: Priorite }) {
  if (priorite === "normale" || priorite === "basse") return null;
  const p = PRIORITES[priorite];
  return <Pastille ton={p.ton}>{p.libelle}</Pastille>;
}

export function PastilleEtat({ etat, table }: { etat: string; table: Record<string, { libelle: string; ton: Ton }> }) {
  const e = table[etat] ?? { libelle: etat, ton: "neutre" as Ton };
  return <Pastille ton={e.ton}>{e.libelle}</Pastille>;
}

/** Sigle de compagnie dans un petit cartouche. */
export function Sigle({ children, ton = "rose" }: { children: string; ton?: "rose" | "neutre" }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-md border px-1.5 font-mono text-[0.68rem] font-medium tracking-wide whitespace-nowrap",
        ton === "rose" ? "border-rose/30 bg-rose/10 text-[#ffc2d6]" : "border-white/12 bg-white/[0.05] text-encre-2",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Frise d'avancement du dossier, partagée entre l'espace de gestion et
 * l'espace de suivi de l'assuré.
 */
export function FriseEtapes({ statut, compacte = false }: { statut: Statut; compacte?: boolean }) {
  const info = STATUTS[statut];
  const horsParcours = info.etape < 0;
  const courante = info.etape;

  return (
    <div>
      {/* Sur petit écran, la frise n'affiche que les pastilles : l'étape en cours est écrite au-dessus. */}
      {!horsParcours && (
        <p className="mb-3 text-sm text-encre-2 sm:hidden">
          Étape {Math.min(courante + 1, ETAPES.length)} sur {ETAPES.length} —{" "}
          <span className="font-medium text-encre">{ETAPES[Math.min(courante, ETAPES.length - 1)]}</span>
        </p>
      )}
      <ol className="flex items-start">
        {ETAPES.map((etape, i) => {
          const faite = !horsParcours && (i < courante || statut === "clos");
          const enCours = !horsParcours && i === courante && statut !== "clos";
          return (
            <li key={etape} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-[13px] right-1/2 left-[-50%] h-0.5",
                    faite || enCours ? "bg-gradient-to-r from-sarcelle/70 to-sarcelle" : "bg-white/10",
                  )}
                />
              )}
              <span
                className={cx(
                  "relative z-[1] grid h-7 w-7 place-items-center rounded-full border text-xs font-medium",
                  faite && "border-sarcelle bg-sarcelle text-[#04201c]",
                  enCours && "border-or bg-[#1c1708] text-or-clair shadow-[0_0_0_4px_rgb(220_184_115/0.18)]",
                  !faite && !enCours && "border-white/15 bg-[#0a1716] text-encre-3",
                )}
              >
                {faite ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cx(
                  "mt-2 px-1 leading-tight",
                  compacte ? "sr-only text-[0.72rem] sm:not-sr-only" : "hidden text-xs sm:block sm:text-[0.82rem]",
                  enCours ? "font-medium text-encre" : faite ? "text-encre-2" : "text-encre-3",
                )}
              >
                {etape}
                {enCours && <span className="sr-only"> (étape en cours)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fil de messages                                                    */
/* ------------------------------------------------------------------ */

export function FilMessages({
  messages,
  moi,
  vide,
}: {
  messages: { id: string; auteur_type: string; auteur_nom: string; contenu: string; created_at: string }[];
  /** Type d'auteur du lecteur : ses messages sont alignés à droite. */
  moi: "agent" | "client" | "adverse";
  vide: string;
}) {
  if (messages.length === 0) {
    return <p className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-sm text-encre-3">{vide}</p>;
  }
  const formater = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dakar",
  });
  return (
    <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1">
      {messages.map((m) => {
        const deMoi = m.auteur_type === moi;
        return (
          <li key={m.id} className={cx("flex flex-col", deMoi ? "items-end" : "items-start")}>
            <div
              className={cx(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                deMoi
                  ? "rounded-br-md border border-sarcelle/25 bg-sarcelle/15 text-encre"
                  : "rounded-bl-md border border-trait bg-white/[0.06] text-encre",
              )}
            >
              {m.contenu}
            </div>
            <span className="mt-1 px-1 text-[0.7rem] text-encre-3">
              {m.auteur_nom} · {formater.format(new Date(m.created_at))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Chronologie des événements du dossier                              */
/* ------------------------------------------------------------------ */

const COULEURS_EVENEMENT: Record<string, string> = {
  declaration: "bg-or",
  statut: "bg-or",
  piece: "bg-sarcelle",
  expertise: "bg-violet",
  offre: "bg-or-clair",
  reglement: "bg-bon",
  recours: "bg-rose",
};

export function Chronologie({
  evenements,
  avecAuteur = true,
}: {
  evenements: { id: string; type: string; titre: string; description: string | null; auteur_nom: string | null; created_at: string }[];
  avecAuteur?: boolean;
}) {
  const formater = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dakar",
  });
  return (
    <ol className="relative ml-1.5 space-y-5 border-l border-white/10 pl-6">
      {evenements.map((e) => (
        <li key={e.id} className="relative">
          <span
            aria-hidden
            className={cx(
              "absolute top-1.5 -left-[1.82rem] h-2.5 w-2.5 rounded-full ring-4 ring-[#0a1a19]",
              COULEURS_EVENEMENT[e.type] ?? "bg-encre-3",
            )}
          />
          <p className="text-[0.95rem] text-encre">{e.titre}</p>
          {e.description && <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{e.description}</p>}
          <p className="mt-1 text-xs text-encre-3">
            {formater.format(new Date(e.created_at))}
            {avecAuteur && e.auteur_nom && ` · ${e.auteur_nom}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
