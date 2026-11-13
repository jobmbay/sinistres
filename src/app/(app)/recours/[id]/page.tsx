import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, FileText } from "lucide-react";
import { exigerSession } from "@/lib/session";
import { peut, STATUTS_RECOURS } from "@/lib/referentiel";
import { date, dateEtHeure, fcfa, tailleFichier } from "@/lib/format";
import type { CompagnieResume, DocumentPiece, Message, Recours, SinistreAdverse } from "@/lib/types";
import { cloreRecours, envoyerMessageRecours, repondreRecours } from "@/actions/recours";
import { Carte, Champ, EnTeteCarte, LigneDetail } from "@/components/ui";
import { BoutonAction, ChampMontant, FormulaireAction, Modale } from "@/components/interactif";
import { FilMessages, PastilleEtat } from "@/components/metier";

export const metadata: Metadata = { title: "Recours" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLONNES_PARTAGEES =
  "id, numero, compagnie_id, compagnie_adverse_id, branche_id, type_sinistre_id, statut, date_survenance, date_declaration, lieu, ville, circonstances, assure_nom, tiers_nom, tiers_police, tiers_details, taux_responsabilite, created_at";

export default async function PageDetailRecours({ params }: PageProps<"/recours/[id]">) {
  const { id } = await params;
  const { supabase, profil } = await exigerSession();
  if (!UUID.test(id)) notFound();

  const { data } = await supabase
    .from("recours")
    .select(
      `*, emettrice:compagnies!recours_compagnie_emettrice_id_fkey(id, nom, sigle),
       adverse:compagnies!recours_compagnie_adverse_id_fkey(id, nom, sigle)`,
    )
    .eq("id", id)
    .maybeSingle();
  const recours = data as unknown as (Recours & { emettrice: CompagnieResume; adverse: CompagnieResume }) | null;
  if (!recours) notFound();

  const cote =
    profil.role === "gestionnaire"
      ? "gestionnaire"
      : profil.compagnie_id === recours.compagnie_adverse_id
        ? "adverse"
        : "emettrice";
  const peutAgir = peut(profil, "recours.gerer");

  // La compagnie adverse lit le dossier à travers la vue restreinte.
  const [sinistreRes, piecesRes, messagesRes, brancheRes] = await Promise.all([
    cote === "adverse"
      ? supabase.from("sinistres_adverses").select("*").eq("id", recours.sinistre_id).maybeSingle()
      : supabase.from("sinistres").select(COLONNES_PARTAGEES).eq("id", recours.sinistre_id).maybeSingle(),
    supabase
      .from("documents")
      .select("*")
      .eq("sinistre_id", recours.sinistre_id)
      .eq("visible_adverse", true)
      .not("chemin", "is", null)
      .order("created_at"),
    supabase.from("messages").select("*").eq("sinistre_id", recours.sinistre_id).eq("canal", "adverse").order("created_at"),
    supabase.from("branches").select("id, nom"),
  ]);
  const sinistre = sinistreRes.data as SinistreAdverse | null;
  const pieces = (piecesRes.data ?? []) as DocumentPiece[];
  const messages = (messagesRes.data ?? []) as Message[];
  const branche = (brancheRes.data ?? []).find((b) => b.id === sinistre?.branche_id);

  return (
    <>
      <div className="mb-6">
        <Link href="/recours" className="mb-3 inline-flex items-center gap-1.5 text-sm text-encre-3 transition hover:text-encre">
          <span aria-hidden>←</span> Recours
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-or-clair">{recours.numero}</span>
              <PastilleEtat etat={recours.statut} table={STATUTS_RECOURS} />
            </p>
            <h1 className="mt-2 flex flex-wrap items-center gap-2.5 text-[1.6rem] leading-tight font-normal tracking-tight text-encre">
              {recours.emettrice.nom}
              <ArrowRight size={20} className="text-encre-3" aria-label="contre" />
              {recours.adverse.nom}
            </h1>
            <p className="mt-1.5 text-sm text-encre-3">
              {cote === "adverse"
                ? "Votre compagnie est mise en cause. Répondez en acceptant ou en contestant la réclamation."
                : cote === "emettrice"
                  ? "Recours exercé par votre compagnie."
                  : "Vous suivez ce recours en tant que gestionnaire de la plateforme."}
            </p>
          </div>

          {peutAgir && (
            <div className="flex flex-wrap gap-2">
              {recours.statut === "emis" && cote !== "emettrice" && (
                <Modale bouton="Répondre au recours" varianteBouton="primaire" tailleBouton="md" titre={`Répondre au recours ${recours.numero}`}>
                  <FormulaireAction action={repondreRecours.bind(null, recours.id)} libelle="Envoyer la réponse">
                    <fieldset className="space-y-2">
                      <legend className="etiquette">Votre décision</legend>
                      {[
                        ["accepte", "Accepter", "Vous reconnaissez devoir tout ou partie du montant réclamé."],
                        ["conteste", "Contester", "Vous refusez la réclamation ; un motif est obligatoire."],
                      ].map(([valeur, titre, aide], i) => (
                        <label
                          key={valeur}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-trait-fort bg-black/20 px-3.5 py-3 transition hover:border-white/25 has-checked:border-or/70 has-checked:bg-or/10"
                        >
                          <input type="radio" name="decision" value={valeur} defaultChecked={i === 0} required className="mt-1 h-4 w-4 accent-[#dcb873]" />
                          <span>
                            <span className="block text-sm font-medium text-encre">{titre}</span>
                            <span className="block text-xs text-encre-3">{aide}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <Champ libelle="Montant accordé" aide={`En cas d'acceptation. Laissez tel quel pour accorder la totalité (${fcfa(recours.montant_reclame)}).`}>
                      <ChampMontant name="montant_accorde" defaut={recours.montant_reclame} />
                    </Champ>
                    <Champ libelle="Motif ou commentaire" aide="Obligatoire en cas de contestation.">
                      <textarea className="champ" name="reponse" rows={3} />
                    </Champ>
                  </FormulaireAction>
                </Modale>
              )}
              {cote !== "adverse" && recours.statut === "accepte" && (
                <BoutonAction
                  action={cloreRecours.bind(null, recours.id, "regle")}
                  variante="primaire"
                  taille="md"
                  confirmation={`Confirmer l'encaissement de ${fcfa(recours.montant_accorde ?? recours.montant_reclame)} ?`}
                >
                  Confirmer l'encaissement
                </BoutonAction>
              )}
              {cote !== "adverse" && recours.statut === "conteste" && (
                <BoutonAction action={cloreRecours.bind(null, recours.id, "emis")} variante="primaire" taille="md">
                  Maintenir et relancer
                </BoutonAction>
              )}
              {cote !== "adverse" && ["emis", "conteste", "accepte"].includes(recours.statut) && (
                <BoutonAction
                  action={cloreRecours.bind(null, recours.id, "abandonne")}
                  variante="fantome"
                  taille="md"
                  confirmation="Abandonner ce recours ?"
                >
                  Abandonner
                </BoutonAction>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-4">
          <Carte>
            <EnTeteCarte titre="La réclamation" />
            <dl className="grid grid-cols-2 gap-px border-y border-trait bg-white/[0.06] sm:grid-cols-4">
              {[
                ["Montant réclamé", fcfa(recours.montant_reclame)],
                ["Montant accordé", recours.montant_accorde === null ? "—" : fcfa(recours.montant_accorde)],
                ["Émis le", date(recours.date_emission)],
                ["Réponse le", date(recours.date_reponse)],
              ].map(([libelle, valeur]) => (
                <div key={libelle} className="bg-[#081615] px-5 py-4">
                  <dt className="text-xs text-encre-3">{libelle}</dt>
                  <dd className="mt-1 text-lg font-light text-encre">{valeur}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-4 px-5 py-5">
              <div>
                <p className="surtitre mb-1.5">Fondement invoqué par {recours.emettrice.sigle}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{recours.motif ?? "—"}</p>
              </div>
              {recours.reponse && (
                <div>
                  <p className="surtitre mb-1.5">Réponse de {recours.adverse.sigle}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{recours.reponse}</p>
                </div>
              )}
              {recours.date_reglement && (
                <p className="text-sm text-encre-2">Recours encaissé le {dateEtHeure(recours.date_reglement)}.</p>
              )}
            </div>
          </Carte>

          <Carte>
            <EnTeteCarte
              titre="Le sinistre à l'origine du recours"
              action={
                cote !== "adverse" && (
                  <Link href={`/sinistres/${recours.sinistre_id}`} className="text-sm text-or-clair hover:underline">
                    Ouvrir le dossier →
                  </Link>
                )
              }
            />
            {sinistre ? (
              <>
                <dl className="grid gap-x-10 px-5 lg:grid-cols-2">
                  <div>
                    <LigneDetail libelle="Dossier">
                      <span className="font-mono text-[0.82rem]">{sinistre.numero}</span>
                    </LigneDetail>
                    <LigneDetail libelle="Branche">{branche?.nom ?? "—"}</LigneDetail>
                    <LigneDetail libelle="Survenance">{dateEtHeure(sinistre.date_survenance)}</LigneDetail>
                    <LigneDetail libelle="Lieu">{[sinistre.lieu, sinistre.ville].filter(Boolean).join(", ") || "—"}</LigneDetail>
                  </div>
                  <div>
                    <LigneDetail libelle={`Assuré ${recours.emettrice.sigle}`}>{sinistre.assure_nom}</LigneDetail>
                    <LigneDetail libelle={`Assuré ${recours.adverse.sigle}`}>{sinistre.tiers_nom ?? "—"}</LigneDetail>
                    <LigneDetail libelle="Police du tiers">{sinistre.tiers_police ?? "—"}</LigneDetail>
                    <LigneDetail libelle={`Responsabilité de l'assuré ${recours.emettrice.sigle}`}>
                      {sinistre.taux_responsabilite === null ? "Non déterminée" : `${sinistre.taux_responsabilite} %`}
                    </LigneDetail>
                  </div>
                </dl>
                <div className="px-5 pt-2 pb-5">
                  <p className="surtitre mb-1.5">Circonstances</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{sinistre.circonstances ?? "Non renseignées."}</p>
                  {sinistre.tiers_details && (
                    <>
                      <p className="surtitre mt-4 mb-1.5">Précisions sur le tiers</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{sinistre.tiers_details}</p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="px-5 pb-5 text-sm text-encre-3">Les informations du sinistre ne sont plus disponibles.</p>
            )}
          </Carte>

          <Carte>
            <EnTeteCarte
              titre="Pièces partagées"
              description={
                cote === "adverse"
                  ? `Pièces que ${recours.emettrice.nom} a choisi de vous communiquer.`
                  : "Pièces du dossier que vous avez choisi de partager avec la compagnie adverse (onglet « Pièces » du dossier)."
              }
            />
            {pieces.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-encre-3">Aucune pièce n'a été partagée pour le moment.</p>
            ) : (
              <ul className="divide-y divide-white/5 px-2 pb-2">
                {pieces.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-trait bg-white/[0.04] text-encre-3">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-encre">{p.libelle}</span>
                      <span className="block truncate text-xs text-encre-3">
                        {p.nom_fichier} · {tailleFichier(p.taille)}
                      </span>
                    </span>
                    <a href={`/api/pieces/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[0.84rem] text-encre-2 transition hover:bg-white/[0.06] hover:text-encre">
                      <Download size={15} /> Télécharger
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <Carte className="self-start">
          <EnTeteCarte titre="Échanges entre compagnies" description="Visibles par les deux compagnies et par le gestionnaire." />
          <div className="space-y-4 px-5 pb-5">
            <FilMessages
              messages={messages}
              moi={cote === "adverse" ? "adverse" : "agent"}
              vide="Aucun échange pour le moment."
            />
            {peutAgir && (
              <FormulaireAction action={envoyerMessageRecours.bind(null, recours.id)} libelle="Envoyer" libelleEnCours="Envoi…" reinitialiser>
                <label>
                  <span className="sr-only">Votre message</span>
                  <textarea className="champ" name="contenu" rows={3} required maxLength={5000} placeholder="Écrire à l'autre compagnie…" />
                </label>
              </FormulaireAction>
            )}
          </div>
        </Carte>
      </div>
    </>
  );
}
