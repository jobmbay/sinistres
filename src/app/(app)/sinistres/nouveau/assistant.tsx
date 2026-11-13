"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { declarerSinistre } from "@/actions/sinistres";
import { champsDeBranche, FAMILLES, PRIORITES } from "@/lib/referentiel";
import type { Branche, CompagnieResume, Priorite, TypeSinistre } from "@/lib/types";
import { Alerte, Bouton, Champ, cx } from "@/components/ui";
import { ChampMontant } from "@/components/interactif";

const ETAPES = ["Contrat", "Assuré", "Sinistre", "Tiers", "Récapitulatif"];

export function AssistantDeclaration({
  branches,
  types,
  compagnies,
  compagnieFixe,
}: {
  branches: Branche[];
  types: TypeSinistre[];
  compagnies: CompagnieResume[];
  /** Compagnie imposée (utilisateur d'une compagnie) ; null pour le gestionnaire. */
  compagnieFixe: string | null;
}) {
  const [etat, envoyer, enCours] = useActionState(declarerSinistre, null);
  const [, demarrer] = useTransition();
  const [etape, setEtape] = useState(0);
  const [brancheId, setBrancheId] = useState("");
  const [compagnieId, setCompagnieId] = useState(compagnieFixe ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [recap, setRecap] = useState<Record<string, string>>({});
  const formulaire = useRef<HTMLFormElement>(null);

  const branche = branches.find((b) => b.id === brancheId);
  const typesDeBranche = types.filter((t) => t.branche_id === brancheId);
  const champsSpecifiques = champsDeBranche(branche?.code);
  const familles = [...FAMILLES, ...new Set(branches.map((b) => b.famille).filter((f) => !FAMILLES.includes(f as never)))];

  /** Vérifie les champs de l'étape affichée avant d'avancer. */
  const etapeValide = () => {
    setErreur(null);
    const bloc = formulaire.current?.querySelector<HTMLElement>(`[data-etape="${etape}"]`);
    const champs = bloc?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
    for (const champ of champs ?? []) {
      if (!champ.checkValidity()) {
        champ.reportValidity();
        return false;
      }
    }
    if (etape === 0 && !brancheId) {
      setErreur("Choisissez la branche d'assurance concernée.");
      return false;
    }
    if (etape === 2) {
      const survenance = new FormData(formulaire.current!).get("date_survenance") as string;
      if (survenance && new Date(survenance).getTime() > Date.now()) {
        setErreur("La date de survenance ne peut pas être dans le futur.");
        return false;
      }
    }
    return true;
  };

  const avancer = () => {
    if (!etapeValide()) return;
    if (etape === ETAPES.length - 2) {
      const donnees = new FormData(formulaire.current!);
      setRecap(Object.fromEntries([...donnees.entries()].map(([cle, valeur]) => [cle, String(valeur)])));
    }
    setEtape((e) => Math.min(ETAPES.length - 1, e + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nomCompagnie = (id: string | undefined) => compagnies.find((c) => c.id === id)?.nom;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progression */}
      <ol className="mb-6 flex items-center gap-1.5 sm:gap-2">
        {ETAPES.map((libelle, i) => (
          <li key={libelle} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={i >= etape}
              onClick={() => setEtape(i)}
              aria-current={i === etape ? "step" : undefined}
              className={cx(
                "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition",
                i < etape && "cursor-pointer text-encre-2 hover:bg-white/[0.06]",
                i === etape && "bg-white/[0.06] text-encre",
                i > etape && "text-encre-3",
              )}
            >
              <span
                className={cx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
                  i < etape && "border-sarcelle bg-sarcelle text-[#04201c]",
                  i === etape && "border-or bg-or/15 text-or-clair",
                  i > etape && "border-white/15",
                )}
              >
                {i < etape ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx(i !== etape && "hidden sm:inline")}>{libelle}</span>
            </button>
            {i < ETAPES.length - 1 && <span aria-hidden className={cx("h-px flex-1", i < etape ? "bg-sarcelle/60" : "bg-white/10")} />}
          </li>
        ))}
      </ol>

      {/* Envoi manuel : si le serveur refuse la déclaration, la saisie des cinq étapes est conservée. */}
      <form
        ref={formulaire}
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (etape !== ETAPES.length - 1) return avancer();
          const donnees = new FormData(evenement.currentTarget);
          demarrer(() => envoyer(donnees));
        }}
        className="carte p-5 sm:p-7"
      >
        {/* ---------------- 1. Contrat ---------------- */}
        <fieldset data-etape="0" hidden={etape !== 0} className="space-y-5">
          <Legende titre="Le contrat concerné" texte="Quelle compagnie, quelle branche, quelle police ?" />
          {compagnieFixe ? (
            <input type="hidden" name="compagnie_id" value={compagnieFixe} />
          ) : (
            <Champ libelle="Compagnie de l'assuré" requis>
              <select className="champ" name="compagnie_id" required value={compagnieId} onChange={(e) => setCompagnieId(e.target.value)}>
                <option value="">Choisir une compagnie…</option>
                {compagnies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sigle} — {c.nom}
                  </option>
                ))}
              </select>
            </Champ>
          )}

          <div>
            <span className="etiquette">
              Branche d'assurance <span className="text-or">*</span>
            </span>
            <div className="space-y-3">
              {familles.map((famille) => {
                const duGroupe = branches.filter((b) => b.famille === famille);
                if (duGroupe.length === 0) return null;
                return (
                  <div key={famille}>
                    <p className="surtitre mb-1.5">{famille}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {duGroupe.map((b) => (
                        <label
                          key={b.id}
                          className={cx(
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition",
                            brancheId === b.id
                              ? "border-or/70 bg-or/10 text-encre"
                              : "border-trait-fort bg-black/20 text-encre-2 hover:border-white/25",
                          )}
                        >
                          <input
                            type="radio"
                            name="branche_id"
                            value={b.id}
                            checked={brancheId === b.id}
                            onChange={() => setBrancheId(b.id)}
                            className="sr-only"
                          />
                          <span
                            aria-hidden
                            className={cx(
                              "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                              brancheId === b.id ? "border-or" : "border-white/30",
                            )}
                          >
                            {brancheId === b.id && <span className="h-2 w-2 rounded-full bg-or" />}
                          </span>
                          {b.nom}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Type de sinistre">
              <select className="champ" name="type_sinistre_id" disabled={!brancheId} key={brancheId}>
                <option value="">{brancheId ? "À préciser plus tard" : "Choisissez d'abord la branche"}</option>
                {typesDeBranche.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Numéro de police" requis>
              <input className="champ" name="numero_police" required placeholder="Ex. AUT-2025-004512" />
            </Champ>
          </div>
          <Champ libelle="Priorité du dossier" className="sm:max-w-xs">
            <select className="champ" name="priorite" defaultValue="normale">
              {(Object.keys(PRIORITES) as Priorite[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITES[p].libelle}
                </option>
              ))}
            </select>
          </Champ>
        </fieldset>

        {/* ---------------- 2. Assuré ---------------- */}
        <fieldset data-etape="1" hidden={etape !== 1} className="space-y-5">
          <Legende titre="L'assuré" texte="Ses coordonnées serviront à lui envoyer son lien de suivi." />
          <Champ libelle="Nom complet ou raison sociale" requis>
            <input className="champ" name="assure_nom" required autoComplete="off" />
          </Champ>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Téléphone" aide="Avec l'indicatif, pour l'envoi par WhatsApp ou SMS.">
              <input className="champ" name="assure_telephone" type="tel" placeholder="+221 77 000 00 00" autoComplete="off" />
            </Champ>
            <Champ libelle="Adresse e-mail">
              <input className="champ" name="assure_email" type="email" placeholder="nom@exemple.com" autoComplete="off" />
            </Champ>
          </div>
          <Champ libelle="Adresse">
            <input className="champ" name="assure_adresse" autoComplete="off" />
          </Champ>
        </fieldset>

        {/* ---------------- 3. Sinistre ---------------- */}
        <fieldset data-etape="2" hidden={etape !== 2} className="space-y-5">
          <Legende titre="Le sinistre" texte="Que s'est-il passé, quand et où ?" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Champ libelle="Date et heure de survenance" requis className="sm:col-span-1">
              <input className="champ" name="date_survenance" type="datetime-local" required />
            </Champ>
            <Champ libelle="Lieu">
              <input className="champ" name="lieu" placeholder="Rue, quartier, axe routier…" />
            </Champ>
            <Champ libelle="Ville">
              <input className="champ" name="ville" placeholder="Dakar" />
            </Champ>
          </div>
          <Champ libelle="Circonstances" aide="Décrivez les faits tels que rapportés par l'assuré.">
            <textarea className="champ" name="circonstances" rows={4} />
          </Champ>
          {champsSpecifiques.length > 0 && (
            <div>
              <p className="surtitre mb-2.5">Précisions — {branche?.nom}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {champsSpecifiques.map((c) => (
                  <Champ key={c.cle} libelle={c.libelle}>
                    <input className="champ" name={`detail_${c.cle}`} placeholder={c.exemple} />
                  </Champ>
                ))}
              </div>
            </div>
          )}
          <Champ libelle="Première estimation des dommages" aide="Facultatif. Sert de provision initiale, modifiable ensuite." className="sm:max-w-xs">
            <ChampMontant name="montant_estime" />
          </Champ>
        </fieldset>

        {/* ---------------- 4. Tiers ---------------- */}
        <fieldset data-etape="3" hidden={etape !== 3} className="space-y-5">
          <Legende
            titre="Tiers et compagnie adverse"
            texte="Facultatif. Renseignez cette étape si une autre personne ou une autre compagnie est impliquée."
          />
          <Champ libelle="Compagnie adverse" aide="Elle sera informée du dossier et pourra répondre à un éventuel recours.">
            <select className="champ" name="compagnie_adverse_id" defaultValue="">
              <option value="">Aucune ou inconnue</option>
              {compagnies
                .filter((c) => c.id !== compagnieId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sigle} — {c.nom}
                  </option>
                ))}
            </select>
          </Champ>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Nom du tiers">
              <input className="champ" name="tiers_nom" autoComplete="off" />
            </Champ>
            <Champ libelle="Téléphone du tiers">
              <input className="champ" name="tiers_telephone" type="tel" autoComplete="off" />
            </Champ>
            <Champ libelle="Police du tiers">
              <input className="champ" name="tiers_police" />
            </Champ>
            <Champ libelle="Part de responsabilité de l'assuré" aide="En pourcentage, si elle est déjà connue.">
              <span className="relative block">
                <input className="champ pr-9" name="taux_responsabilite" type="number" min={0} max={100} step={5} placeholder="—" />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-sm text-encre-3">%</span>
              </span>
            </Champ>
          </div>
          <Champ libelle="Précisions sur le tiers" aide="Véhicule adverse, témoins, dommages causés…">
            <textarea className="champ" name="tiers_details" rows={3} />
          </Champ>
        </fieldset>

        {/* ---------------- 5. Récapitulatif ---------------- */}
        <div data-etape="4" hidden={etape !== 4} className="space-y-5">
          <Legende titre="Vérifiez avant de créer le dossier" texte="Tout reste modifiable après la création." />
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Bloc titre="Contrat">
              <Ligne libelle="Compagnie" valeur={nomCompagnie(recap.compagnie_id)} />
              <Ligne libelle="Branche" valeur={branche?.nom} />
              <Ligne libelle="Type" valeur={types.find((t) => t.id === recap.type_sinistre_id)?.nom} />
              <Ligne libelle="Police" valeur={recap.numero_police} />
            </Bloc>
            <Bloc titre="Assuré">
              <Ligne libelle="Nom" valeur={recap.assure_nom} />
              <Ligne libelle="Téléphone" valeur={recap.assure_telephone} />
              <Ligne libelle="E-mail" valeur={recap.assure_email} />
            </Bloc>
            <Bloc titre="Sinistre">
              <Ligne libelle="Survenance" valeur={dateLisible(recap.date_survenance)} />
              <Ligne libelle="Lieu" valeur={[recap.lieu, recap.ville].filter(Boolean).join(", ")} />
              <Ligne libelle="Estimation" valeur={recap.montant_estime ? `${recap.montant_estime} FCFA` : undefined} />
            </Bloc>
            <Bloc titre="Tiers">
              <Ligne libelle="Compagnie adverse" valeur={nomCompagnie(recap.compagnie_adverse_id)} />
              <Ligne libelle="Tiers" valeur={recap.tiers_nom} />
              <Ligne libelle="Responsabilité" valeur={recap.taux_responsabilite ? `${recap.taux_responsabilite} %` : undefined} />
            </Bloc>
          </dl>
          {branche && branche.pieces_requises.length > 0 && (
            <div className="carte-plate px-4 py-3.5">
              <p className="text-sm text-encre-2">
                Ces pièces seront demandées à l'assuré dans son espace de suivi :
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {branche.pieces_requises.map((p) => (
                  <li key={p} className="rounded-full border border-trait bg-white/[0.04] px-2.5 py-1 text-xs text-encre-2">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(erreur || (etat && !etat.ok)) && (
          <div className="mt-5">
            <Alerte>{erreur ?? etat?.message}</Alerte>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-trait pt-5">
          <Bouton
            type="button"
            variante="fantome"
            disabled={etape === 0 || enCours}
            onClick={() => {
              setErreur(null);
              setEtape((e) => e - 1);
            }}
          >
            <ArrowLeft size={16} /> Précédent
          </Bouton>
          {/* Clés distinctes : sans elles, React réutiliserait le même bouton et le clic
              sur « Continuer » validerait aussitôt le formulaire, sans laisser relire. */}
          {etape < ETAPES.length - 1 ? (
            <Bouton key="continuer" type="button" variante="primaire" onClick={avancer}>
              Continuer <ArrowRight size={16} />
            </Bouton>
          ) : (
            <Bouton key="creer" type="submit" variante="primaire" disabled={enCours}>
              {enCours ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
              {enCours ? "Création du dossier…" : "Créer le dossier"}
            </Bouton>
          )}
        </div>
      </form>
    </div>
  );
}

/** « 2026-11-11T23:50 » → « 11/11/2026 à 23:50 » */
function dateLisible(valeur: string | undefined) {
  const morceaux = valeur?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]} à ${morceaux[4]}` : undefined;
}

function Legende({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div>
      <h2 className="text-xl font-normal tracking-tight text-encre">{titre}</h2>
      <p className="mt-1 text-sm text-encre-3">{texte}</p>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="surtitre mb-1.5">{titre}</p>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur?: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-encre-3">{libelle}</dt>
      <dd className={cx("text-right", valeur ? "text-encre" : "text-encre-3")}>{valeur || "—"}</dd>
    </div>
  );
}
