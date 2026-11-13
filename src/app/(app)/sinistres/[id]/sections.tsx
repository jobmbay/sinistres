import Link from "next/link";
import {
  Download,
  FileText,
  FilePlus2,
  FileQuestion,
  HandCoins,
  Microscope,
  Plus,
  Scale,
  Share2,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import {
  accepterOffre,
  annulerOffre,
  changerEtatReglement,
  creerReglement,
  demanderPiece,
  deposerPiece,
  emettreOffre,
  enregistrerReponseOffre,
  envoyerMessage,
  mettreAJourExpertise,
  missionnerExpert,
  partagerPieceAdverse,
  statuerPiece,
  supprimerPiece,
  validerPiece,
} from "@/actions/dossier";
import { emettreRecours } from "@/actions/recours";
import { mettreAJourEvaluation } from "@/actions/sinistres";
import { FORMATS_ACCEPTES } from "@/lib/fichiers";
import { date, dateEtHeure, fcfa, pourChampDate, tailleFichier } from "@/lib/format";
import {
  champsDeBranche,
  MODES_REGLEMENT,
  NATURES_EXPERTISE,
  NATURES_REGLEMENT,
  STATUTS_DOCUMENT,
  STATUTS_EXPERTISE,
  STATUTS_OFFRE,
  STATUTS_RECOURS,
  STATUTS_REGLEMENT,
} from "@/lib/referentiel";
import type {
  DocumentPiece,
  Evenement,
  Expertise,
  Message,
  Offre,
  Recours,
  Reglement,
  SinistreDetail,
} from "@/lib/types";
import { Carte, Champ, EnTeteCarte, LigneDetail, Pastille, Vide } from "@/components/ui";
import { BoutonAction, ChampMontant, FormulaireAction, Modale } from "@/components/interactif";
import { Chronologie, FilMessages, PastilleEtat } from "@/components/metier";

export type Droits = {
  modifier: boolean;
  cloturer: boolean;
  documents: boolean;
  expertises: boolean;
  evaluation: boolean;
  reglements: boolean;
  validerReglements: boolean;
  recours: boolean;
  communication: boolean;
};

/* ================================================================== */
/*  SYNTHÈSE                                                           */
/* ================================================================== */

export function SectionSynthese({ sinistre }: { sinistre: SinistreDetail }) {
  const champs = champsDeBranche(sinistre.branche?.code).filter((c) => sinistre.details?.[c.cle]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Carte>
        <EnTeteCarte titre="Assuré et contrat" />
        <dl className="px-5 pb-4">
          <LigneDetail libelle="Assuré">{sinistre.assure_nom}</LigneDetail>
          <LigneDetail libelle="Téléphone">{sinistre.assure_telephone ?? "—"}</LigneDetail>
          <LigneDetail libelle="E-mail">{sinistre.assure_email ?? "—"}</LigneDetail>
          <LigneDetail libelle="Adresse">{sinistre.assure_adresse ?? "—"}</LigneDetail>
          <LigneDetail libelle="Compagnie">{sinistre.compagnie?.nom}</LigneDetail>
          <LigneDetail libelle="Police">
            <span className="font-mono text-[0.82rem]">{sinistre.numero_police}</span>
          </LigneDetail>
          <LigneDetail libelle="Branche">{sinistre.branche?.nom}</LigneDetail>
          <LigneDetail libelle="Type de sinistre">{sinistre.type?.nom ?? "À préciser"}</LigneDetail>
        </dl>
      </Carte>

      <Carte>
        <EnTeteCarte titre="Le sinistre" />
        <dl className="px-5 pb-2">
          <LigneDetail libelle="Survenance">{dateEtHeure(sinistre.date_survenance)}</LigneDetail>
          <LigneDetail libelle="Déclaration">{date(sinistre.date_declaration)}</LigneDetail>
          <LigneDetail libelle="Lieu">{[sinistre.lieu, sinistre.ville].filter(Boolean).join(", ") || "—"}</LigneDetail>
          {champs.map((c) => (
            <LigneDetail key={c.cle} libelle={c.libelle}>
              {sinistre.details[c.cle]}
            </LigneDetail>
          ))}
        </dl>
        <div className="px-5 pb-5">
          <p className="surtitre mb-1.5">Circonstances</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-encre-2">
            {sinistre.circonstances ?? "Aucune description saisie."}
          </p>
        </div>
      </Carte>

      <Carte className="lg:col-span-2">
        <EnTeteCarte titre="Tiers et compagnie adverse" />
        {sinistre.adverse || sinistre.tiers_nom || sinistre.tiers_details ? (
          <dl className="grid gap-x-10 px-5 pb-4 lg:grid-cols-2">
            <div>
              <LigneDetail libelle="Compagnie adverse">{sinistre.adverse?.nom ?? "Aucune ou inconnue"}</LigneDetail>
              <LigneDetail libelle="Police du tiers">{sinistre.tiers_police ?? "—"}</LigneDetail>
              <LigneDetail libelle="Responsabilité de l'assuré">
                {sinistre.taux_responsabilite === null ? "Non déterminée" : `${sinistre.taux_responsabilite} %`}
              </LigneDetail>
            </div>
            <div>
              <LigneDetail libelle="Tiers">{sinistre.tiers_nom ?? "—"}</LigneDetail>
              <LigneDetail libelle="Téléphone">{sinistre.tiers_telephone ?? "—"}</LigneDetail>
              <LigneDetail libelle="Précisions">{sinistre.tiers_details ?? "—"}</LigneDetail>
            </div>
          </dl>
        ) : (
          <p className="px-5 pb-5 text-sm text-encre-3">Aucun tiers ni compagnie adverse n'est renseigné sur ce dossier.</p>
        )}
      </Carte>
    </div>
  );
}

/* ================================================================== */
/*  PIÈCES                                                             */
/* ================================================================== */

export function SectionPieces({
  sinistre,
  documents,
  droits,
}: {
  sinistre: SinistreDetail;
  documents: DocumentPiece[];
  droits: Droits;
}) {
  const ordre = { recu: 0, demande: 1, refuse: 2, valide: 3 } as const;
  const tries = [...documents].sort((a, b) => ordre[a.statut] - ordre[b.statut]);

  return (
    <Carte>
      <EnTeteCarte
        titre="Pièces du dossier"
        description="Les pièces demandées apparaissent dans l'espace de suivi de l'assuré, qui peut les déposer lui-même."
        action={
          droits.documents && (
            <div className="flex flex-wrap gap-2">
              <Modale bouton={<><FileQuestion size={15} /> Demander une pièce</>} titre="Demander une pièce à l'assuré">
                <FormulaireAction action={demanderPiece.bind(null, sinistre.id)} libelle="Demander">
                  <Champ libelle="Pièce demandée" requis>
                    <input className="champ" name="libelle" required placeholder="Ex. Facture d'achat du téléphone" />
                  </Champ>
                  <Champ libelle="Précision pour l'assuré" aide="Facultatif. Affiché sous l'intitulé dans son espace de suivi.">
                    <textarea className="champ" name="commentaire" rows={2} />
                  </Champ>
                </FormulaireAction>
              </Modale>
              <Modale bouton={<><Upload size={15} /> Ajouter une pièce</>} varianteBouton="primaire" titre="Ajouter une pièce au dossier">
                <FormulaireAction action={deposerPiece.bind(null, sinistre.id)} libelle="Ajouter" libelleEnCours="Envoi du fichier…">
                  <Champ libelle="Intitulé" requis>
                    <input className="champ" name="libelle" required placeholder="Ex. Rapport de police" />
                  </Champ>
                  <ChampFichier />
                  <label className="flex items-center gap-2.5 text-sm text-encre-2">
                    <input type="checkbox" name="visible_client" className="h-4 w-4 accent-[#dcb873]" />
                    Rendre cette pièce visible par l'assuré
                  </label>
                </FormulaireAction>
              </Modale>
            </div>
          )
        }
      />
      {tries.length === 0 ? (
        <Vide icone={<FileText size={22} />} titre="Aucune pièce" description="Demandez une pièce à l'assuré ou ajoutez-en une au dossier." />
      ) : (
        <ul className="divide-y divide-white/5 px-2 pb-2">
          {tries.map((piece) => (
            <li key={piece.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-trait bg-white/[0.04] text-encre-3">
                {piece.chemin ? <FileText size={18} /> : <FilePlus2 size={18} />}
              </span>
              <div className="min-w-48 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.95rem] text-encre">
                  {piece.libelle}
                  <PastilleEtat etat={piece.statut} table={STATUTS_DOCUMENT} />
                  {!piece.visible_client && <Pastille point={false}>Interne</Pastille>}
                  {piece.visible_adverse && <Pastille ton="violet" point={false}>Partagée avec {sinistre.adverse?.sigle}</Pastille>}
                </p>
                <p className="mt-0.5 text-xs text-encre-3">
                  {piece.chemin
                    ? `${piece.nom_fichier} · ${tailleFichier(piece.taille)} · ${piece.source === "client" ? "déposée par l'assuré" : "ajoutée par un agent"} le ${date(piece.recu_le)}`
                    : `Demandée le ${date(piece.created_at)}`}
                </p>
                {piece.commentaire && <p className="mt-1 text-xs text-encre-2">« {piece.commentaire} »</p>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {piece.chemin && (
                  <a href={`/api/pieces/${piece.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[0.84rem] text-encre-2 transition hover:bg-white/[0.06] hover:text-encre">
                    <Download size={15} /> Télécharger
                  </a>
                )}
                {droits.documents && piece.statut === "recu" && (
                  <>
                    <BoutonAction action={validerPiece.bind(null, piece.id)} variante="primaire">
                      Valider
                    </BoutonAction>
                    <Modale bouton="Refuser" titre="Refuser cette pièce" description="L'assuré verra votre explication et pourra déposer une nouvelle version.">
                      <FormulaireAction action={statuerPiece.bind(null, piece.id, "refuse")} libelle="Refuser la pièce" variante="danger">
                        <Champ libelle="Motif du refus" requis>
                          <textarea className="champ" name="commentaire" rows={3} required placeholder="Ex. Document illisible, merci d'envoyer une photo plus nette." />
                        </Champ>
                      </FormulaireAction>
                    </Modale>
                  </>
                )}
                {droits.documents && !piece.chemin && (
                  <Modale
                    bouton={
                      <>
                        <Upload size={14} /> Déposer
                        <span className="sr-only"> : {piece.libelle}</span>
                      </>
                    }
                    titre={`Déposer : ${piece.libelle}`}
                  >
                    <FormulaireAction action={deposerPiece.bind(null, sinistre.id)} libelle="Déposer" libelleEnCours="Envoi du fichier…">
                      <input type="hidden" name="document_id" value={piece.id} />
                      <ChampFichier />
                    </FormulaireAction>
                  </Modale>
                )}
                {droits.documents && piece.chemin && sinistre.adverse && (
                  <BoutonAction
                    action={partagerPieceAdverse.bind(null, piece.id, !piece.visible_adverse)}
                    variante="fantome"
                    titre={piece.visible_adverse ? "Ne plus partager avec la compagnie adverse" : `Partager avec ${sinistre.adverse.nom}`}
                  >
                    <Share2 size={14} /> {piece.visible_adverse ? "Ne plus partager" : "Partager"}
                  </BoutonAction>
                )}
                {droits.documents && (
                  <BoutonAction
                    action={supprimerPiece.bind(null, piece.id)}
                    variante="fantome"
                    confirmation={`Retirer la pièce « ${piece.libelle} » du dossier ?`}
                    titre="Retirer la pièce"
                  >
                    <Trash2 size={14} />
                    <span className="sr-only">Retirer</span>
                  </BoutonAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

function ChampFichier() {
  return (
    <Champ libelle="Fichier" requis aide="PDF, photo (JPG, PNG), Word ou Excel — 10 Mo au maximum.">
      <input
        className="champ file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-encre"
        type="file"
        name="fichier"
        accept={FORMATS_ACCEPTES}
        required
      />
    </Champ>
  );
}

/* ================================================================== */
/*  EXPERTISE                                                          */
/* ================================================================== */

export function SectionExpertise({
  sinistre,
  expertises,
  droits,
}: {
  sinistre: SinistreDetail;
  expertises: Expertise[];
  droits: Droits;
}) {
  return (
    <Carte>
      <EnTeteCarte
        titre="Missions d'expertise"
        description="Missionnez un expert, suivez sa visite puis enregistrez les conclusions de son rapport."
        action={
          droits.expertises && (
            <Modale bouton={<><Plus size={15} /> Missionner un expert</>} varianteBouton="primaire" titre="Missionner un expert" large>
              <FormulaireAction action={missionnerExpert.bind(null, sinistre.id)} libelle="Créer la mission">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ libelle="Nature de la mission">
                    <select className="champ" name="nature" defaultValue="materielle">
                      {Object.entries(NATURES_EXPERTISE).map(([cle, libelle]) => (
                        <option key={cle} value={cle}>
                          {libelle}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ libelle="Expert" requis>
                    <input className="champ" name="expert_nom" required placeholder="Nom de l'expert" />
                  </Champ>
                  <Champ libelle="Cabinet">
                    <input className="champ" name="expert_cabinet" />
                  </Champ>
                  <Champ libelle="Téléphone">
                    <input className="champ" name="expert_telephone" type="tel" />
                  </Champ>
                  <Champ libelle="E-mail">
                    <input className="champ" name="expert_email" type="email" />
                  </Champ>
                  <Champ libelle="Date de visite prévue">
                    <input className="champ" name="date_visite" type="date" />
                  </Champ>
                </div>
              </FormulaireAction>
            </Modale>
          )
        }
      />
      {expertises.length === 0 ? (
        <Vide icone={<Microscope size={22} />} titre="Aucune expertise" description="Aucun expert n'a encore été missionné sur ce dossier." />
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {expertises.map((e) => (
            <li key={e.id} className="carte-plate p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-[0.98rem] font-medium text-encre">
                    {e.expert_nom}
                    <PastilleEtat etat={e.statut} table={STATUTS_EXPERTISE} />
                  </p>
                  <p className="mt-0.5 text-sm text-encre-3">
                    {NATURES_EXPERTISE[e.nature]}
                    {e.expert_cabinet && ` · ${e.expert_cabinet}`}
                    {e.expert_telephone && ` · ${e.expert_telephone}`}
                  </p>
                </div>
                {droits.expertises && (
                  <Modale bouton="Mettre à jour" titre={`Expertise — ${e.expert_nom}`} large>
                    <FormulaireAction action={mettreAJourExpertise.bind(null, e.id)}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Champ libelle="État de la mission">
                          <select className="champ" name="statut" defaultValue={e.statut}>
                            {Object.entries(STATUTS_EXPERTISE).map(([cle, s]) => (
                              <option key={cle} value={cle}>
                                {s.libelle}
                              </option>
                            ))}
                          </select>
                        </Champ>
                        <Champ libelle="Date de visite">
                          <input className="champ" name="date_visite" type="date" defaultValue={pourChampDate(e.date_visite)} />
                        </Champ>
                        <Champ libelle="Date du rapport">
                          <input className="champ" name="date_rapport" type="date" defaultValue={pourChampDate(e.date_rapport)} />
                        </Champ>
                        <Champ libelle="Montant évalué par l'expert">
                          <ChampMontant name="montant_evalue" defaut={e.montant_evalue} />
                        </Champ>
                        <Champ libelle="Honoraires">
                          <ChampMontant name="honoraires" defaut={e.honoraires} />
                        </Champ>
                      </div>
                      <Champ libelle="Conclusions du rapport">
                        <textarea className="champ" name="conclusions" rows={4} defaultValue={e.conclusions ?? ""} />
                      </Champ>
                    </FormulaireAction>
                  </Modale>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Donnee libelle="Mission">{date(e.date_mission)}</Donnee>
                <Donnee libelle="Visite">{date(e.date_visite)}</Donnee>
                <Donnee libelle="Rapport">{date(e.date_rapport)}</Donnee>
                <Donnee libelle="Montant évalué">{e.montant_evalue === null ? "—" : fcfa(e.montant_evalue)}</Donnee>
              </dl>
              {e.conclusions && (
                <p className="mt-3 border-t border-trait pt-3 text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{e.conclusions}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

function Donnee({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-encre-3">{libelle}</dt>
      <dd className="mt-0.5 text-encre">{children}</dd>
    </div>
  );
}

/* ================================================================== */
/*  INDEMNISATION : évaluation, offres, règlements                     */
/* ================================================================== */

export function SectionIndemnisation({
  sinistre,
  offres,
  reglements,
  expertises,
  droits,
}: {
  sinistre: SinistreDetail;
  offres: Offre[];
  reglements: Reglement[];
  expertises: Expertise[];
  droits: Droits;
}) {
  const offreEnCours = offres.find((o) => o.statut === "envoyee");
  const offreAcceptee = offres.find((o) => o.statut === "acceptee");
  const dernierRapport = expertises.find((e) => e.statut === "rapport_recu" && e.montant_evalue !== null);
  const suggestion = offreAcceptee?.montant ?? dernierRapport?.montant_evalue ?? sinistre.montant_provision;
  const resteARegler = Math.max(0, (offreAcceptee?.montant ?? sinistre.montant_provision) - sinistre.montant_regle);

  return (
    <div className="space-y-4">
      {/* Évaluation */}
      <Carte>
        <EnTeteCarte
          titre="Évaluation financière"
          action={
            droits.evaluation && (
              <Modale bouton="Modifier l'évaluation" titre="Évaluation financière" description="Ces montants restent internes : ni l'assuré ni la compagnie adverse ne les voient.">
                <FormulaireAction action={mettreAJourEvaluation.bind(null, sinistre.id)}>
                  <Champ libelle="Estimation des dommages">
                    <ChampMontant name="montant_estime" defaut={sinistre.montant_estime} />
                  </Champ>
                  <Champ libelle="Provision (réserve)" aide="Montant que la compagnie prévoit de payer sur ce dossier.">
                    <ChampMontant name="montant_provision" defaut={sinistre.montant_provision} />
                  </Champ>
                  <Champ libelle="Franchise">
                    <ChampMontant name="montant_franchise" defaut={sinistre.montant_franchise} />
                  </Champ>
                </FormulaireAction>
              </Modale>
            )
          }
        />
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-[18px] border-t border-trait bg-white/[0.06] lg:grid-cols-4">
          {[
            ["Estimation", sinistre.montant_estime],
            ["Provision", sinistre.montant_provision],
            ["Franchise", sinistre.montant_franchise],
            ["Déjà réglé", sinistre.montant_regle],
          ].map(([libelle, montant]) => (
            <div key={libelle} className="bg-[#081615] px-5 py-4">
              <dt className="text-xs text-encre-3">{libelle}</dt>
              <dd className="mt-1 text-lg font-light text-encre">{fcfa(montant as number)}</dd>
            </div>
          ))}
        </dl>
      </Carte>

      {/* Offres */}
      <Carte>
        <EnTeteCarte
          titre="Offres d'indemnisation"
          description="L'assuré reçoit l'offre dans son espace de suivi et peut l'accepter ou la refuser en ligne."
          action={
            droits.evaluation &&
            !offreEnCours && (
              <Modale bouton={<><HandCoins size={15} /> Émettre une offre</>} varianteBouton="primaire" titre="Émettre une offre d'indemnisation">
                <FormulaireAction action={emettreOffre.bind(null, sinistre.id)} libelle="Transmettre l'offre">
                  <Champ libelle="Montant proposé" requis aide={dernierRapport ? `L'expert a évalué les dommages à ${fcfa(dernierRapport.montant_evalue)}.` : undefined}>
                    <ChampMontant name="montant" defaut={dernierRapport?.montant_evalue ?? sinistre.montant_provision} requis />
                  </Champ>
                  <Champ libelle="Détail de l'offre" aide="Visible par l'assuré : base de calcul, franchise appliquée, vétusté…">
                    <textarea className="champ" name="detail" rows={4} />
                  </Champ>
                </FormulaireAction>
              </Modale>
            )
          }
        />
        {offres.length === 0 ? (
          <Vide icone={<HandCoins size={22} />} titre="Aucune offre" description="Aucune offre d'indemnisation n'a encore été émise." />
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {offres.map((o) => (
              <li key={o.id} className="carte-plate p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex flex-wrap items-center gap-3">
                    <span className="text-xl font-light text-encre">{fcfa(o.montant)}</span>
                    <PastilleEtat etat={o.statut} table={STATUTS_OFFRE} />
                  </p>
                  {droits.evaluation && o.statut === "envoyee" && (
                    <div className="flex flex-wrap gap-1.5">
                      <BoutonAction
                        action={accepterOffre.bind(null, o.id)}
                        variante="primaire"
                        confirmation="Confirmer que l'assuré a accepté cette offre ?"
                      >
                        L'assuré accepte
                      </BoutonAction>
                      <Modale bouton="L'assuré refuse" titre="Refus de l'offre par l'assuré">
                        <FormulaireAction action={enregistrerReponseOffre.bind(null, o.id, "refusee")} libelle="Enregistrer le refus" variante="danger">
                          <Champ libelle="Motif exprimé par l'assuré" requis>
                            <textarea className="champ" name="motif" rows={3} required />
                          </Champ>
                        </FormulaireAction>
                      </Modale>
                      <BoutonAction action={annulerOffre.bind(null, o.id)} variante="fantome" confirmation="Retirer cette offre ?">
                        Retirer
                      </BoutonAction>
                    </div>
                  )}
                </div>
                {o.detail && <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{o.detail}</p>}
                <p className="mt-2 text-xs text-encre-3">
                  Transmise le {dateEtHeure(o.date_envoi ?? o.created_at)}
                  {o.date_reponse && ` · réponse le ${dateEtHeure(o.date_reponse)}${o.repondu_par ? ` — ${o.repondu_par}` : ""}`}
                </p>
                {o.reponse_motif && <p className="mt-1.5 text-sm text-encre-2">Motif : « {o.reponse_motif} »</p>}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {/* Règlements */}
      <Carte>
        <EnTeteCarte
          titre="Règlements"
          description={
            offreAcceptee
              ? `Accord sur ${fcfa(offreAcceptee.montant)} — reste à régler : ${fcfa(resteARegler)}.`
              : "Préparez le règlement, faites-le valider, puis marquez-le comme payé."
          }
          action={
            droits.reglements && (
              <Modale bouton={<><Wallet size={15} /> Préparer un règlement</>} varianteBouton="primaire" titre="Préparer un règlement" large>
                <FormulaireAction action={creerReglement.bind(null, sinistre.id)} libelle="Préparer le règlement">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ libelle="Nature">
                      <select className="champ" name="nature" defaultValue="indemnite">
                        {Object.entries(NATURES_REGLEMENT).map(([cle, libelle]) => (
                          <option key={cle} value={cle}>
                            {libelle}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ libelle="Bénéficiaire" requis>
                      <input className="champ" name="beneficiaire" required defaultValue={sinistre.assure_nom} />
                    </Champ>
                    <Champ libelle="Montant" requis>
                      <ChampMontant name="montant" defaut={resteARegler || suggestion} requis />
                    </Champ>
                    <Champ libelle="Mode de paiement">
                      <select className="champ" name="mode" defaultValue="virement">
                        {Object.entries(MODES_REGLEMENT).map(([cle, libelle]) => (
                          <option key={cle} value={cle}>
                            {libelle}
                          </option>
                        ))}
                      </select>
                    </Champ>
                  </div>
                  <Champ libelle="Référence" aide="Numéro de chèque, d'ordre de virement ou de transaction.">
                    <input className="champ" name="reference" />
                  </Champ>
                </FormulaireAction>
              </Modale>
            )
          }
        />
        {reglements.length === 0 ? (
          <Vide icone={<Wallet size={22} />} titre="Aucun règlement" description="Aucun règlement n'a encore été préparé sur ce dossier." />
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Bénéficiaire</th>
                  <th>Nature</th>
                  <th>Mode</th>
                  <th className="chiffre">Montant</th>
                  <th>État</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reglements.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="block text-encre">{r.beneficiaire}</span>
                      {r.reference && <span className="block font-mono text-xs text-encre-3">{r.reference}</span>}
                    </td>
                    <td className="text-encre-2">{NATURES_REGLEMENT[r.nature]}</td>
                    <td className="text-encre-2">{MODES_REGLEMENT[r.mode]}</td>
                    <td className="chiffre">{fcfa(r.montant)}</td>
                    <td>
                      <PastilleEtat etat={r.statut} table={STATUTS_REGLEMENT} />
                      {r.date_reglement && <span className="mt-1 block text-xs text-encre-3">le {date(r.date_reglement)}</span>}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {droits.validerReglements && r.statut === "en_attente" && (
                          <BoutonAction action={changerEtatReglement.bind(null, r.id, "valide")} variante="primaire">
                            Valider
                          </BoutonAction>
                        )}
                        {droits.validerReglements && r.statut === "valide" && (
                          <BoutonAction
                            action={changerEtatReglement.bind(null, r.id, "paye")}
                            variante="primaire"
                            confirmation={`Confirmer le paiement de ${fcfa(r.montant)} à ${r.beneficiaire} ?`}
                          >
                            Marquer payé
                          </BoutonAction>
                        )}
                        {droits.reglements && (r.statut === "en_attente" || r.statut === "valide") && (
                          <BoutonAction action={changerEtatReglement.bind(null, r.id, "annule")} variante="fantome" confirmation="Annuler ce règlement ?">
                            Annuler
                          </BoutonAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </div>
  );
}

/* ================================================================== */
/*  RECOURS                                                            */
/* ================================================================== */

export function SectionRecours({
  sinistre,
  recours,
  droits,
}: {
  sinistre: SinistreDetail;
  recours: Recours[];
  droits: Droits;
}) {
  const actif = recours.some((r) => ["emis", "accepte", "conteste"].includes(r.statut));
  return (
    <Carte>
      <EnTeteCarte
        titre="Recours contre la compagnie adverse"
        description={
          sinistre.adverse
            ? `Réclamez à ${sinistre.adverse.nom} le remboursement des sommes dues. Elle répond directement depuis son espace.`
            : undefined
        }
        action={
          droits.recours &&
          sinistre.adverse &&
          !actif && (
            <Modale bouton={<><Scale size={15} /> Émettre un recours</>} varianteBouton="primaire" titre={`Recours contre ${sinistre.adverse.nom}`}>
              <FormulaireAction action={emettreRecours.bind(null, sinistre.id)} libelle="Émettre le recours">
                <Champ libelle="Montant réclamé" requis>
                  <ChampMontant name="montant_reclame" defaut={sinistre.montant_regle || sinistre.montant_provision} requis />
                </Champ>
                <Champ libelle="Fondement du recours" requis aide="Visible par la compagnie adverse : responsabilité de son assuré, convention applicable…">
                  <textarea className="champ" name="motif" rows={4} required />
                </Champ>
              </FormulaireAction>
            </Modale>
          )
        }
      />
      {!sinistre.adverse ? (
        <Vide
          icone={<Scale size={22} />}
          titre="Aucune compagnie adverse"
          description="Pour exercer un recours, renseignez la compagnie adverse dans les informations du dossier (bouton « Modifier »)."
        />
      ) : recours.length === 0 ? (
        <Vide icone={<Scale size={22} />} titre="Aucun recours" description={`Aucun recours n'a été émis contre ${sinistre.adverse.nom}.`} />
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {recours.map((r) => (
            <li key={r.id} className="carte-plate p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[0.82rem] text-or-clair">{r.numero}</span>
                  <PastilleEtat etat={r.statut} table={STATUTS_RECOURS} />
                </p>
                <Link href={`/recours/${r.id}`} className="text-sm text-or-clair hover:underline">
                  Ouvrir le recours →
                </Link>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Donnee libelle="Montant réclamé">{fcfa(r.montant_reclame)}</Donnee>
                <Donnee libelle="Montant accordé">{r.montant_accorde === null ? "—" : fcfa(r.montant_accorde)}</Donnee>
                <Donnee libelle="Émis le">{date(r.date_emission)}</Donnee>
                <Donnee libelle="Réponse le">{date(r.date_reponse)}</Donnee>
              </dl>
              {r.reponse && <p className="mt-3 border-t border-trait pt-3 text-sm text-encre-2">Réponse : « {r.reponse} »</p>}
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}

/* ================================================================== */
/*  ÉCHANGES                                                           */
/* ================================================================== */

export function SectionEchanges({
  sinistre,
  messages,
  droits,
}: {
  sinistre: SinistreDetail;
  messages: Message[];
  droits: Droits;
}) {
  const avecAssure = messages.filter((m) => m.canal === "client");
  const internes = messages.filter((m) => m.canal === "interne");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Carte>
        <EnTeteCarte titre="Messages avec l'assuré" description={`${sinistre.assure_nom} les lit et y répond depuis son espace de suivi.`} />
        <div className="space-y-4 px-5 pb-5">
          <FilMessages messages={avecAssure} moi="agent" vide="Aucun échange avec l'assuré pour le moment." />
          {droits.communication && (
            <FormulaireAction action={envoyerMessage.bind(null, sinistre.id, "client")} libelle="Envoyer" libelleEnCours="Envoi…" reinitialiser>
              <label>
                <span className="sr-only">Votre message à l'assuré</span>
                <textarea className="champ" name="contenu" rows={3} required maxLength={5000} placeholder="Écrire à l'assuré…" />
              </label>
            </FormulaireAction>
          )}
        </div>
      </Carte>
      <Carte>
        <EnTeteCarte titre="Notes internes" description="Visibles uniquement par les gestionnaires du dossier." />
        <div className="space-y-4 px-5 pb-5">
          <FilMessages messages={internes.map((m) => ({ ...m, auteur_type: "note" }))} moi="agent" vide="Aucune note interne." />
          {droits.communication && (
            <FormulaireAction action={envoyerMessage.bind(null, sinistre.id, "interne")} libelle="Ajouter la note" variante="secondaire" reinitialiser>
              <label>
                <span className="sr-only">Votre note interne</span>
                <textarea className="champ" name="contenu" rows={3} required maxLength={5000} placeholder="Ajouter une note pour l'équipe…" />
              </label>
            </FormulaireAction>
          )}
        </div>
      </Carte>
    </div>
  );
}

/* ================================================================== */
/*  HISTORIQUE                                                         */
/* ================================================================== */

export function SectionHistorique({ evenements }: { evenements: Evenement[] }) {
  return (
    <Carte>
      <EnTeteCarte titre="Historique du dossier" description="Toutes les actions effectuées, de la plus récente à la plus ancienne." />
      <div className="px-5 pb-6">
        {evenements.length === 0 ? (
          <p className="text-sm text-encre-3">Aucun événement.</p>
        ) : (
          <Chronologie evenements={evenements} />
        )}
      </div>
    </Carte>
  );
}

