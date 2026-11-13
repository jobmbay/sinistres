import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, Lightbulb, Pencil, Trash2, UserRound } from "lucide-react";
import { exigerSession } from "@/lib/session";
import { SELECTION_SINISTRE } from "@/lib/requetes";
import {
  champsDeBranche,
  peut,
  PRIORITES,
  STATUTS,
  STATUTS_TERMINES,
  TRANSITIONS,
} from "@/lib/referentiel";
import { fcfa, initiales, pourChampDate } from "@/lib/format";
import type {
  CompagnieResume,
  DocumentPiece,
  Evenement,
  Expertise,
  Message,
  Offre,
  Priorite,
  Recours,
  Reglement,
  SinistreDetail,
  Statut,
  TypeSinistre,
} from "@/lib/types";
import {
  attribuerDossier,
  changerStatut,
  modifierSinistre,
  passerAuStatut,
  supprimerSinistre,
} from "@/actions/sinistres";
import { Avatar, Carte, Champ, EnTeteCarte, LigneDetail, classesBouton } from "@/components/ui";
import { BoutonAction, FormulaireAction, Modale, Onglets } from "@/components/interactif";
import { FriseEtapes, PastillePriorite, PastilleStatut, Sigle } from "@/components/metier";
import { PartageSuivi } from "./partage";
import {
  SectionEchanges,
  SectionExpertise,
  SectionHistorique,
  SectionIndemnisation,
  SectionPieces,
  SectionRecours,
  SectionSynthese,
  type Droits,
} from "./sections";

export const metadata: Metadata = { title: "Dossier sinistre" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageSinistre({ params }: PageProps<"/sinistres/[id]">) {
  const { id } = await params;
  const { supabase, profil } = await exigerSession();
  if (!UUID.test(id)) notFound();

  const { data } = await supabase.from("sinistres").select(SELECTION_SINISTRE).eq("id", id).maybeSingle();
  const sinistre = data as unknown as SinistreDetail | null;
  if (!sinistre) notFound();

  const parDossier = (table: string) => supabase.from(table).select("*").eq("sinistre_id", id);
  const [documentsRes, expertisesRes, offresRes, reglementsRes, recoursRes, messagesRes, evenementsRes, equipeRes, compagniesRes, typesRes] =
    await Promise.all([
      parDossier("documents").order("created_at"),
      parDossier("expertises").order("created_at", { ascending: false }),
      parDossier("offres").order("created_at", { ascending: false }),
      parDossier("reglements").order("created_at", { ascending: false }),
      parDossier("recours").order("created_at", { ascending: false }),
      parDossier("messages").order("created_at"),
      parDossier("evenements").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("profils")
        .select("id, prenom, nom, role, compagnie_id")
        .eq("actif", true)
        .or(`compagnie_id.eq.${sinistre.compagnie_id},role.eq.gestionnaire`)
        .order("prenom"),
      supabase.from("compagnies").select("id, nom, sigle").eq("actif", true).order("nom"),
      supabase.from("types_sinistre").select("*").eq("branche_id", sinistre.branche_id).order("ordre"),
    ]);

  const documents = (documentsRes.data ?? []) as DocumentPiece[];
  const expertises = (expertisesRes.data ?? []) as Expertise[];
  const offres = (offresRes.data ?? []) as Offre[];
  const reglements = (reglementsRes.data ?? []) as Reglement[];
  const recours = (recoursRes.data ?? []) as Recours[];
  const messages = (messagesRes.data ?? []) as Message[];
  const evenements = (evenementsRes.data ?? []) as Evenement[];
  const equipe = (equipeRes.data ?? []) as { id: string; prenom: string; nom: string; role: string }[];
  const compagnies = (compagniesRes.data ?? []) as CompagnieResume[];
  const types = (typesRes.data ?? []) as TypeSinistre[];

  const droits: Droits = {
    modifier: peut(profil, "sinistres.modifier"),
    cloturer: peut(profil, "sinistres.cloturer"),
    documents: peut(profil, "documents.gerer"),
    expertises: peut(profil, "expertises.gerer"),
    evaluation: peut(profil, "evaluation.gerer"),
    reglements: peut(profil, "reglements.gerer"),
    validerReglements: peut(profil, "reglements.valider"),
    recours: peut(profil, "recours.gerer"),
    communication: peut(profil, "communication.gerer", "sinistres.modifier"),
  };

  const termine = STATUTS_TERMINES.includes(sinistre.statut);
  const transitions = TRANSITIONS[sinistre.statut].filter((cible) => {
    const toucheCloture = STATUTS_TERMINES.includes(cible) || termine;
    return toucheCloture ? droits.cloturer : droits.modifier;
  });

  const piecesAControler = documents.filter((d) => d.statut === "recu").length;
  const piecesAttendues = documents.filter((d) => d.statut === "demande" || d.statut === "refuse").length;
  const reglementsOuverts = reglements.filter((r) => r.statut === "en_attente" || r.statut === "valide").length;
  const messagesAssure = messages.filter((m) => m.canal === "client").length;
  const champsSpecifiques = champsDeBranche(sinistre.branche?.code);

  return (
    <>
      {/* ------------------------------ En-tête ------------------------------ */}
      <div className="mb-5">
        <Link href="/sinistres" className="mb-3 inline-flex items-center gap-1.5 text-sm text-encre-3 transition hover:text-encre">
          <span aria-hidden>←</span> Sinistres
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-or-clair">{sinistre.numero}</span>
              <PastilleStatut statut={sinistre.statut} />
              <PastillePriorite priorite={sinistre.priorite} />
            </p>
            <h1 className="mt-2 text-[1.75rem] leading-tight font-normal tracking-tight text-encre">{sinistre.assure_nom}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-encre-3">
              <span className="text-encre-2">{sinistre.branche?.nom}</span>
              {sinistre.type && <span>· {sinistre.type.nom}</span>}
              <span aria-hidden>·</span>
              {sinistre.compagnie && <Sigle>{sinistre.compagnie.sigle}</Sigle>}
              {sinistre.adverse && (
                <>
                  <ArrowRight size={13} aria-label="contre" />
                  <Sigle ton="neutre">{sinistre.adverse.sigle}</Sigle>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {droits.modifier && (
              <Modale bouton={<><Pencil size={15} /> Modifier</>} tailleBouton="md" titre="Modifier le dossier" large>
                <FormulaireAction action={modifierSinistre.bind(null, sinistre.id)}>
                  <p className="surtitre">Assuré et contrat</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ libelle="Assuré" requis>
                      <input className="champ" name="assure_nom" required defaultValue={sinistre.assure_nom} />
                    </Champ>
                    <Champ libelle="Numéro de police" requis>
                      <input className="champ" name="numero_police" required defaultValue={sinistre.numero_police} />
                    </Champ>
                    <Champ libelle="Téléphone">
                      <input className="champ" name="assure_telephone" type="tel" defaultValue={sinistre.assure_telephone ?? ""} />
                    </Champ>
                    <Champ libelle="E-mail">
                      <input className="champ" name="assure_email" type="email" defaultValue={sinistre.assure_email ?? ""} />
                    </Champ>
                    <Champ libelle="Adresse" className="sm:col-span-2">
                      <input className="champ" name="assure_adresse" defaultValue={sinistre.assure_adresse ?? ""} />
                    </Champ>
                  </div>

                  <p className="surtitre pt-2">Sinistre</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ libelle="Type de sinistre">
                      <select className="champ" name="type_sinistre_id" defaultValue={sinistre.type_sinistre_id ?? ""}>
                        <option value="">À préciser</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nom}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Date et heure de survenance" requis>
                      <input className="champ" name="date_survenance" type="datetime-local" required defaultValue={pourChampDate(sinistre.date_survenance, true)} />
                    </Champ>
                    <Champ libelle="Lieu">
                      <input className="champ" name="lieu" defaultValue={sinistre.lieu ?? ""} />
                    </Champ>
                    <Champ libelle="Ville">
                      <input className="champ" name="ville" defaultValue={sinistre.ville ?? ""} />
                    </Champ>
                    {champsSpecifiques.map((c) => (
                      <Champ key={c.cle} libelle={c.libelle}>
                        <input className="champ" name={`detail_${c.cle}`} defaultValue={sinistre.details?.[c.cle] ?? ""} />
                      </Champ>
                    ))}
                  </div>
                  <Champ libelle="Circonstances">
                    <textarea className="champ" name="circonstances" rows={3} defaultValue={sinistre.circonstances ?? ""} />
                  </Champ>

                  <p className="surtitre pt-2">Tiers et compagnie adverse</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ libelle="Compagnie adverse">
                      <select className="champ" name="compagnie_adverse_id" defaultValue={sinistre.compagnie_adverse_id ?? ""}>
                        <option value="">Aucune ou inconnue</option>
                        {compagnies
                          .filter((c) => c.id !== sinistre.compagnie_id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.sigle} — {c.nom}
                            </option>
                          ))}
                      </select>
                    </Champ>
                    <Champ libelle="Responsabilité de l'assuré (%)">
                      <input className="champ" name="taux_responsabilite" type="number" min={0} max={100} step={5} defaultValue={sinistre.taux_responsabilite ?? ""} />
                    </Champ>
                    <Champ libelle="Nom du tiers">
                      <input className="champ" name="tiers_nom" defaultValue={sinistre.tiers_nom ?? ""} />
                    </Champ>
                    <Champ libelle="Téléphone du tiers">
                      <input className="champ" name="tiers_telephone" type="tel" defaultValue={sinistre.tiers_telephone ?? ""} />
                    </Champ>
                    <Champ libelle="Police du tiers" className="sm:col-span-2">
                      <input className="champ" name="tiers_police" defaultValue={sinistre.tiers_police ?? ""} />
                    </Champ>
                  </div>
                  <Champ libelle="Précisions sur le tiers">
                    <textarea className="champ" name="tiers_details" rows={2} defaultValue={sinistre.tiers_details ?? ""} />
                  </Champ>
                </FormulaireAction>
              </Modale>
            )}

            {transitions.length > 0 && (
              <Modale
                bouton={termine ? "Rouvrir le dossier" : "Changer le statut"}
                varianteBouton={termine ? "secondaire" : "primaire"}
                tailleBouton="md"
                titre={termine ? "Rouvrir le dossier" : "Changer le statut du dossier"}
                description={`Statut actuel : ${STATUTS[sinistre.statut].libelle}. L'assuré est informé de chaque changement.`}
              >
                <FormulaireAction action={changerStatut.bind(null, sinistre.id)} libelle="Appliquer">
                  <fieldset className="space-y-2">
                    <legend className="etiquette">Nouveau statut</legend>
                    {transitions.map((cible, i) => (
                      <label
                        key={cible}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-trait-fort bg-black/20 px-3.5 py-3 transition hover:border-white/25 has-checked:border-or/70 has-checked:bg-or/10"
                      >
                        <input type="radio" name="statut" value={cible} defaultChecked={i === 0} required className="mt-1 h-4 w-4 accent-[#dcb873]" />
                        <span>
                          <span className="block text-sm font-medium text-encre">{STATUTS[cible].libelle}</span>
                          <span className="block text-xs text-encre-3">{STATUTS[cible].description}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <Champ
                    libelle="Motif ou commentaire"
                    aide="Obligatoire pour un rejet, un classement sans suite ou un contentieux. Il est communiqué à l'assuré."
                  >
                    <textarea className="champ" name="motif" rows={3} />
                  </Champ>
                </FormulaireAction>
              </Modale>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------ Avancement ------------------------------ */}
      <Carte className="mb-4 p-5 sm:p-6">
        {STATUTS[sinistre.statut].etape >= 0 ? (
          <FriseEtapes statut={sinistre.statut} />
        ) : (
          <p className="text-sm text-encre-2">
            <span className="font-medium text-encre">{STATUTS[sinistre.statut].libelle}.</span>{" "}
            {sinistre.motif_cloture ?? STATUTS[sinistre.statut].description}
          </p>
        )}
        <ProchaineAction
          sinistreId={sinistre.id}
          statut={sinistre.statut}
          droits={droits}
          piecesAControler={piecesAControler}
          offreEnAttente={offres.some((o) => o.statut === "envoyee")}
          rapportRecu={expertises.some((e) => e.statut === "rapport_recu")}
          reglementsOuverts={reglementsOuverts}
          toutRegle={reglements.some((r) => r.statut === "paye" && r.nature === "indemnite") && reglementsOuverts === 0}
        />
      </Carte>

      {/* ------------------------------ Corps ------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21.5rem]">
        <div className="min-w-0">
          <Onglets
            onglets={[
              { cle: "synthese", libelle: "Synthèse", contenu: <SectionSynthese sinistre={sinistre} /> },
              {
                cle: "pieces",
                libelle: "Pièces",
                compteur: piecesAControler || piecesAttendues,
                alerte: piecesAControler > 0,
                contenu: <SectionPieces sinistre={sinistre} documents={documents} droits={droits} />,
              },
              {
                cle: "expertise",
                libelle: "Expertise",
                compteur: expertises.length,
                contenu: <SectionExpertise sinistre={sinistre} expertises={expertises} droits={droits} />,
              },
              {
                cle: "indemnisation",
                libelle: "Indemnisation",
                compteur: reglementsOuverts,
                alerte: reglementsOuverts > 0,
                contenu: (
                  <SectionIndemnisation sinistre={sinistre} offres={offres} reglements={reglements} expertises={expertises} droits={droits} />
                ),
              },
              {
                cle: "recours",
                libelle: "Recours",
                compteur: recours.length,
                contenu: <SectionRecours sinistre={sinistre} recours={recours} droits={droits} />,
              },
              {
                cle: "echanges",
                libelle: "Échanges",
                compteur: messagesAssure,
                contenu: <SectionEchanges sinistre={sinistre} messages={messages} droits={droits} />,
              },
              { cle: "historique", libelle: "Historique", contenu: <SectionHistorique evenements={evenements} /> },
            ]}
          />
        </div>

        {/* Colonne latérale */}
        <aside className="min-w-0 space-y-4">
          <Carte className="border-or/25">
            <EnTeteCarte titre="Lien de suivi de l'assuré" description="À lui envoyer : il y suit son dossier, dépose ses pièces et répond à l'offre." />
            <div className="px-5 pb-5">
              <PartageSuivi
                jeton={sinistre.jeton_suivi}
                numero={sinistre.numero}
                assureNom={sinistre.assure_nom}
                telephone={sinistre.assure_telephone}
                email={sinistre.assure_email}
                compagnie={sinistre.compagnie?.nom ?? "votre assureur"}
              />
            </div>
          </Carte>

          <Carte>
            <EnTeteCarte
              titre="Suivi du dossier"
              action={
                droits.modifier && (
                  <Modale bouton="Attribuer" titre="Attribution et priorité">
                    <FormulaireAction action={attribuerDossier.bind(null, sinistre.id)}>
                      <Champ libelle="Dossier suivi par">
                        <select className="champ" name="gestionnaire_id" defaultValue={sinistre.gestionnaire_id ?? ""}>
                          <option value="">Personne (non attribué)</option>
                          {equipe.map((membre) => (
                            <option key={membre.id} value={membre.id}>
                              {membre.prenom} {membre.nom}
                              {membre.role === "gestionnaire" ? " — gestionnaire" : ""}
                            </option>
                          ))}
                        </select>
                      </Champ>
                      <Champ libelle="Priorité">
                        <select className="champ" name="priorite" defaultValue={sinistre.priorite}>
                          {(Object.keys(PRIORITES) as Priorite[]).map((p) => (
                            <option key={p} value={p}>
                              {PRIORITES[p].libelle}
                            </option>
                          ))}
                        </select>
                      </Champ>
                    </FormulaireAction>
                  </Modale>
                )
              }
            />
            <div className="px-5 pb-5">
              {sinistre.gestionnaire ? (
                <p className="flex items-center gap-3">
                  <Avatar texte={initiales(sinistre.gestionnaire.prenom, sinistre.gestionnaire.nom)} />
                  <span>
                    <span className="block text-sm font-medium text-encre">
                      {sinistre.gestionnaire.prenom} {sinistre.gestionnaire.nom}
                    </span>
                    <span className="block text-xs text-encre-3">Responsable du dossier</span>
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2.5 text-sm text-encre-3">
                  <UserRound size={17} /> Dossier non attribué
                </p>
              )}
              <dl className="mt-3 border-t border-trait pt-2">
                <LigneDetail libelle="Priorité">{PRIORITES[sinistre.priorite].libelle}</LigneDetail>
                <LigneDetail libelle="Estimation">{fcfa(sinistre.montant_estime)}</LigneDetail>
                <LigneDetail libelle="Provision">{fcfa(sinistre.montant_provision)}</LigneDetail>
                <LigneDetail libelle="Réglé">{fcfa(sinistre.montant_regle)}</LigneDetail>
              </dl>
            </div>
          </Carte>

          {profil.role === "gestionnaire" && (
            <div className="px-1 text-right">
              <BoutonAction
                action={supprimerSinistre.bind(null, sinistre.id)}
                variante="fantome"
                confirmation={`Supprimer définitivement le dossier ${sinistre.numero} et tout son contenu ? Cette action est irréversible.`}
                className="text-encre-3"
              >
                <Trash2 size={14} /> Supprimer le dossier
              </BoutonAction>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** Oriente le gestionnaire vers ce qu'il y a à faire maintenant sur le dossier. */
function ProchaineAction({
  sinistreId,
  statut,
  droits,
  piecesAControler,
  offreEnAttente,
  rapportRecu,
  reglementsOuverts,
  toutRegle,
}: {
  sinistreId: string;
  statut: Statut;
  droits: Droits;
  piecesAControler: number;
  offreEnAttente: boolean;
  rapportRecu: boolean;
  reglementsOuverts: number;
  toutRegle: boolean;
}) {
  let texte: string;
  let action: React.ReactNode = null;
  const lien = (ancre: string, libelle: string) => (
    <a href={`#${ancre}`} className={classesBouton("secondaire", "sm")}>
      {libelle} <ArrowRight size={14} />
    </a>
  );

  switch (statut) {
    case "declare":
      texte = "Le sinistre vient d'être déclaré. Démarrez l'instruction pour vérifier les garanties et réunir les pièces.";
      if (droits.modifier) {
        action = (
          <BoutonAction action={passerAuStatut.bind(null, sinistreId, "en_instruction")} variante="primaire">
            Démarrer l'instruction
          </BoutonAction>
        );
      }
      break;
    case "en_instruction":
      texte =
        piecesAControler > 0
          ? `${piecesAControler} pièce${piecesAControler > 1 ? "s" : ""} reçue${piecesAControler > 1 ? "s" : ""} de l'assuré attend${piecesAControler > 1 ? "ent" : ""} votre contrôle.`
          : "Réunissez les pièces, puis missionnez un expert ou émettez directement une offre.";
      action = piecesAControler > 0 ? lien("pieces", "Contrôler les pièces") : lien("expertise", "Missionner un expert");
      break;
    case "expertise":
      texte = rapportRecu
        ? "Le rapport d'expertise est enregistré. Vous pouvez chiffrer et émettre l'offre d'indemnisation."
        : "L'expertise est en cours. Saisissez les conclusions de l'expert dès réception de son rapport.";
      action = rapportRecu ? lien("indemnisation", "Émettre une offre") : lien("expertise", "Suivre l'expertise");
      break;
    case "evaluation":
      texte = offreEnAttente
        ? "L'offre a été transmise. En attente de la réponse de l'assuré, depuis son espace de suivi ou par votre intermédiaire."
        : "Aucune offre n'est en attente. Émettez une nouvelle offre d'indemnisation.";
      action = lien("indemnisation", offreEnAttente ? "Voir l'offre" : "Émettre une offre");
      break;
    case "accord":
      texte = "L'assuré a accepté l'offre. Préparez le règlement de l'indemnité.";
      action = lien("indemnisation", "Préparer le règlement");
      break;
    case "reglement":
      if (toutRegle) {
        texte = "L'indemnité est payée. Vous pouvez clôturer le dossier.";
        if (droits.cloturer) {
          action = (
            <BoutonAction
              action={passerAuStatut.bind(null, sinistreId, "clos")}
              variante="primaire"
              confirmation="Clôturer ce dossier ?"
            >
              <CircleCheck size={15} /> Clôturer le dossier
            </BoutonAction>
          );
        }
      } else {
        texte = `${reglementsOuverts} règlement${reglementsOuverts > 1 ? "s" : ""} à valider ou à payer.`;
        action = lien("indemnisation", "Voir les règlements");
      }
      break;
    case "contentieux":
      texte = "Le dossier est en contentieux. Consignez les suites dans les notes internes et l'historique.";
      action = lien("echanges", "Ouvrir les échanges");
      break;
    default:
      texte = "Ce dossier est terminé. Il peut être rouvert si un élément nouveau le justifie.";
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-trait bg-black/25 px-4 py-3">
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-sm text-encre-2">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-or" />
        <span>
          <span className="sr-only">Prochaine action : </span>
          {texte}
        </span>
      </p>
      {action}
    </div>
  );
}
