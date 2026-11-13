import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  Clock3,
  Download,
  FileText,
  FileUp,
  HandCoins,
  Mail,
  Phone,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { clientAdmin } from "@/lib/supabase/admin";
import { dossierParJeton } from "@/lib/suivi";
import { FORMATS_ACCEPTES } from "@/lib/fichiers";
import { date, dateEnLettres, dateEtHeure, fcfa, tailleFichier } from "@/lib/format";
import { STATUTS, STATUTS_DOCUMENT, STATUTS_TERMINES } from "@/lib/referentiel";
import type { Statut } from "@/lib/types";
import { clientDeposerPiece, clientEnvoyerMessage, clientRepondreOffre } from "@/actions/suivi";
import { Embleme } from "@/components/logo";
import { Champ, Pastille } from "@/components/ui";
import { FormulaireAction, Modale } from "@/components/interactif";
import { Chronologie, FilMessages, FriseEtapes, PastilleEtat, PastilleStatut } from "@/components/metier";

export const metadata: Metadata = {
  title: "Suivi de votre sinistre",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const EXPLICATIONS: Record<Statut, string> = {
  declare: "Votre déclaration est bien enregistrée. Un gestionnaire va prendre votre dossier en charge.",
  en_instruction: "Votre dossier est à l'étude. Pensez à transmettre les pièces demandées pour ne pas le retarder.",
  expertise: "Un expert a été missionné pour évaluer les dommages. Il peut vous contacter pour convenir d'un rendez-vous.",
  evaluation: "Le montant de votre indemnisation est en cours de finalisation.",
  accord: "Vous avez accepté l'offre d'indemnisation. Le règlement est en préparation.",
  reglement: "Le paiement de votre indemnité est en cours.",
  clos: "Votre dossier est réglé et clôturé. Merci de votre confiance.",
  rejete: "Votre demande n'a pas pu être prise en charge.",
  sans_suite: "Votre dossier a été classé sans suite.",
  contentieux: "Votre dossier fait l'objet d'un examen particulier. Votre gestionnaire vous tiendra informé.",
};

type PieceSuivi = {
  id: string;
  libelle: string;
  statut: "demande" | "recu" | "valide" | "refuse";
  nom_fichier: string | null;
  taille: number | null;
  commentaire: string | null;
  recu_le: string | null;
  chemin: string | null;
};

export default async function PageSuivi({ params }: PageProps<"/suivi/[jeton]">) {
  const { jeton } = await params;
  const dossier = await dossierParJeton(jeton);
  if (!dossier) notFound();

  const admin = clientAdmin();
  const [piecesRes, offresRes, messagesRes, evenementsRes] = await Promise.all([
    admin
      .from("documents")
      .select("id, libelle, statut, nom_fichier, taille, commentaire, recu_le, chemin")
      .eq("sinistre_id", dossier.id)
      .eq("visible_client", true)
      .order("created_at"),
    admin
      .from("offres")
      .select("id, montant, detail, statut, date_envoi, date_reponse")
      .eq("sinistre_id", dossier.id)
      .in("statut", ["envoyee", "acceptee", "refusee"])
      .order("created_at", { ascending: false }),
    admin
      .from("messages")
      .select("id, auteur_type, auteur_nom, contenu, created_at")
      .eq("sinistre_id", dossier.id)
      .eq("canal", "client")
      .order("created_at"),
    admin
      .from("evenements")
      .select("id, type, titre, description, auteur_nom, created_at")
      .eq("sinistre_id", dossier.id)
      .eq("visible_client", true)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const pieces = (piecesRes.data ?? []) as PieceSuivi[];
  const offres = offresRes.data ?? [];
  const messages = messagesRes.data ?? [];
  const evenements = evenementsRes.data ?? [];

  const termine = STATUTS_TERMINES.includes(dossier.statut);
  const aFournir = pieces.filter((p) => p.statut === "demande" || p.statut === "refuse");
  const transmises = pieces.filter((p) => p.statut === "recu" || p.statut === "valide");
  const offreEnAttente = offres.find((o) => o.statut === "envoyee");
  const offreAcceptee = offres.find((o) => o.statut === "acceptee");
  const horsParcours = STATUTS[dossier.statut].etape < 0;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:pt-10">
      {/* En-tête */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Embleme taille={34} />
          <span className="leading-tight">
            <span className="block text-[0.98rem] font-semibold text-encre">{dossier.compagnie?.nom ?? "Votre assureur"}</span>
            <span className="block text-xs text-encre-3">Suivi de votre sinistre</span>
          </span>
        </span>
        <span className="hidden items-center gap-1.5 text-xs text-encre-3 sm:flex">
          <ShieldCheck size={14} /> Espace personnel sécurisé
        </span>
      </header>

      {/* État du dossier */}
      <section className="carte p-5 sm:p-7">
        <p className="text-sm text-encre-3">Bonjour,</p>
        <h1 className="mt-0.5 text-2xl font-normal tracking-tight text-encre">{dossier.assure_nom}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-sm text-or-clair">{dossier.numero}</span>
          <PastilleStatut statut={dossier.statut} />
        </div>
        <p className="mt-2 text-sm text-encre-3">
          {dossier.branche?.nom}
          {dossier.type && ` · ${dossier.type.nom}`} · sinistre du {dateEnLettres(dossier.date_survenance)}
        </p>

        <div className="mt-6">
          {horsParcours ? (
            <div className="flex gap-3 rounded-xl border border-trait bg-black/25 px-4 py-3.5">
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-attention" />
              <p className="text-sm leading-relaxed text-encre-2">
                {EXPLICATIONS[dossier.statut]}
                {dossier.motif_cloture && <span className="mt-1.5 block text-encre">Motif : {dossier.motif_cloture}</span>}
              </p>
            </div>
          ) : (
            <>
              <FriseEtapes statut={dossier.statut} compacte />
              <p className="mt-5 rounded-xl border border-trait bg-black/25 px-4 py-3.5 text-sm leading-relaxed text-encre-2">
                {offreEnAttente && dossier.statut === "evaluation"
                  ? "Une offre d'indemnisation vous est proposée ci-dessous. Vous pouvez l'accepter ou la refuser."
                  : EXPLICATIONS[dossier.statut]}
              </p>
            </>
          )}
        </div>

        {dossier.montant_regle > 0 && (
          <p className="mt-4 flex items-center gap-2.5 rounded-xl border border-bon/30 bg-bon/10 px-4 py-3 text-sm text-[#b6f2c7]">
            <CircleCheck size={17} className="shrink-0" />
            Indemnité versée : <strong className="font-semibold">{fcfa(dossier.montant_regle)}</strong>
          </p>
        )}
      </section>

      {/* Offre en attente */}
      {offreEnAttente && !termine && (
        <section className="carte mt-4 border-or/40 p-5 sm:p-7">
          <p className="flex items-center gap-2 text-sm font-medium text-or-clair">
            <HandCoins size={17} /> Offre d'indemnisation
          </p>
          <p className="mt-3 text-[2.4rem] leading-none font-light tracking-tight text-encre">{fcfa(offreEnAttente.montant)}</p>
          <p className="mt-2 text-xs text-encre-3">Proposée le {dateEtHeure(offreEnAttente.date_envoi)}</p>
          {offreEnAttente.detail && (
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-encre-2">{offreEnAttente.detail}</p>
          )}
          <div className="mt-6 border-t border-trait pt-5">
            <FormulaireAction
              action={clientRepondreOffre.bind(null, jeton, offreEnAttente.id, "acceptee")}
              libelle="J'accepte cette offre"
              libelleEnCours="Enregistrement…"
              pied={
                <Modale bouton="Je refuse l'offre" varianteBouton="fantome" tailleBouton="md" titre="Refuser l'offre" description="Votre gestionnaire étudiera votre réponse et reviendra vers vous.">
                  <FormulaireAction action={clientRepondreOffre.bind(null, jeton, offreEnAttente.id, "refusee")} libelle="Confirmer mon refus" variante="danger">
                    <Champ libelle="Pourquoi refusez-vous cette offre ?" requis>
                      <textarea className="champ" name="motif" rows={4} required maxLength={1000} placeholder="Ex. Le montant ne couvre pas le devis du réparateur." />
                    </Champ>
                  </FormulaireAction>
                </Modale>
              }
            >
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-encre-2">
                <input type="checkbox" name="consentement" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#dcb873]" />
                J'accepte l'offre de {fcfa(offreEnAttente.montant)} en règlement de ce sinistre.
              </label>
            </FormulaireAction>
          </div>
        </section>
      )}

      {offreAcceptee && !offreEnAttente && (
        <section className="carte mt-4 p-5 sm:px-7">
          <p className="flex flex-wrap items-center gap-2.5 text-sm text-encre-2">
            <CircleCheck size={17} className="text-bon" />
            Vous avez accepté une indemnisation de <strong className="font-semibold text-encre">{fcfa(offreAcceptee.montant)}</strong>
            <span className="text-encre-3">le {date(offreAcceptee.date_reponse)}</span>
          </p>
        </section>
      )}

      {/* Pièces à fournir */}
      {!termine && (
        <section className="carte mt-4">
          <div className="px-5 pt-5 pb-3 sm:px-7">
            <h2 className="flex items-center gap-2.5 text-lg font-medium text-encre">
              Pièces à fournir
              {aFournir.length > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-or/20 px-1.5 text-xs font-medium text-or-clair">{aFournir.length}</span>
              )}
            </h2>
            <p className="mt-1 text-sm text-encre-3">
              {aFournir.length > 0
                ? "Envoyez-les directement ici : une photo nette prise avec votre téléphone suffit."
                : "Vous n'avez aucune pièce à fournir pour le moment."}
            </p>
          </div>
          {aFournir.length > 0 && (
            <ul className="divide-y divide-white/5 px-2 sm:px-4">
              {aFournir.map((piece) => (
                <li key={piece.id} className="flex items-center gap-3 px-3 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-or/30 bg-or/10 text-or-clair">
                    <FileUp size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] text-encre">{piece.libelle}</span>
                    {piece.statut === "refuse" ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#ffb3b1]">
                        Pièce refusée{piece.commentaire ? ` : ${piece.commentaire}` : ""}. Merci d'en envoyer une nouvelle.
                      </span>
                    ) : (
                      piece.commentaire && <span className="mt-0.5 block text-xs text-encre-3">{piece.commentaire}</span>
                    )}
                  </span>
                  <Modale
                    bouton={
                      <>
                        <Upload size={15} /> Envoyer
                        <span className="sr-only"> : {piece.libelle}</span>
                      </>
                    }
                    varianteBouton="primaire"
                    titre={piece.libelle} description="PDF ou photo (JPG, PNG) — 10 Mo au maximum.">
                    <FormulaireAction action={clientDeposerPiece.bind(null, jeton)} libelle="Envoyer la pièce" libelleEnCours="Envoi en cours…">
                      <input type="hidden" name="document_id" value={piece.id} />
                      <ChampFichier />
                    </FormulaireAction>
                  </Modale>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 pt-2 pb-5 sm:px-7">
            <Modale bouton={<><Upload size={15} /> Envoyer une autre pièce</>} titre="Envoyer une autre pièce" description="Un document utile à votre dossier qui ne figure pas dans la liste.">
              <FormulaireAction action={clientDeposerPiece.bind(null, jeton)} libelle="Envoyer la pièce" libelleEnCours="Envoi en cours…">
                <Champ libelle="De quelle pièce s'agit-il ?" requis>
                  <input className="champ" name="libelle" required maxLength={120} placeholder="Ex. Facture du garage" />
                </Champ>
                <ChampFichier />
              </FormulaireAction>
            </Modale>
          </div>
        </section>
      )}

      {/* Pièces transmises */}
      {transmises.length > 0 && (
        <section className="carte mt-4">
          <h2 className="px-5 pt-5 pb-2 text-lg font-medium text-encre sm:px-7">Pièces de votre dossier</h2>
          <ul className="divide-y divide-white/5 px-2 pb-2 sm:px-4">
            {transmises.map((piece) => (
              <li key={piece.id} className="flex items-center gap-3 px-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-trait bg-white/[0.04] text-encre-3">
                  <FileText size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-encre">{piece.libelle}</span>
                  <span className="block truncate text-xs text-encre-3">
                    {piece.recu_le ? `Reçue le ${date(piece.recu_le)}` : ""}
                    {piece.taille ? ` · ${tailleFichier(piece.taille)}` : ""}
                  </span>
                </span>
                {piece.statut === "recu" ? (
                  <Pastille ton="info">
                    <Clock3 size={12} /> En cours de vérification
                  </Pastille>
                ) : (
                  <PastilleEtat etat={piece.statut} table={STATUTS_DOCUMENT} />
                )}
                {piece.chemin && (
                  <a
                    href={`/suivi/${jeton}/pieces/${piece.id}`}
                    aria-label={`Télécharger ${piece.libelle}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-encre-3 transition hover:bg-white/[0.08] hover:text-encre"
                  >
                    <Download size={16} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Messages */}
      <section className="carte mt-4 p-5 sm:p-7">
        <h2 className="text-lg font-medium text-encre">Échanger avec votre gestionnaire</h2>
        <p className="mt-1 mb-4 text-sm text-encre-3">
          {dossier.gestionnaire
            ? `${dossier.gestionnaire.prenom} ${dossier.gestionnaire.nom} suit votre dossier.`
            : "Une question sur votre dossier ? Écrivez-nous."}
        </p>
        <div className="space-y-4">
          <FilMessages messages={messages} moi="client" vide="Aucun message pour le moment." />
          <FormulaireAction action={clientEnvoyerMessage.bind(null, jeton)} libelle="Envoyer" libelleEnCours="Envoi…" reinitialiser>
            <label>
              <span className="sr-only">Votre message</span>
              <textarea className="champ" name="contenu" rows={3} required maxLength={2000} placeholder="Écrire un message…" />
            </label>
          </FormulaireAction>
        </div>
      </section>

      {/* Historique */}
      {evenements.length > 0 && (
        <section className="carte mt-4 p-5 sm:p-7">
          <h2 className="mb-5 text-lg font-medium text-encre">Historique de votre dossier</h2>
          <Chronologie evenements={evenements} avecAuteur={false} />
        </section>
      )}

      {/* Contact */}
      <footer className="mt-8 text-center text-sm text-encre-3">
        <p className="text-encre-2">{dossier.compagnie?.nom}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {dossier.compagnie?.telephone && (
            <a href={`tel:${dossier.compagnie.telephone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-encre">
              <Phone size={14} /> {dossier.compagnie.telephone}
            </a>
          )}
          {dossier.compagnie?.email && (
            <a href={`mailto:${dossier.compagnie.email}`} className="inline-flex items-center gap-1.5 hover:text-encre">
              <Mail size={14} /> {dossier.compagnie.email}
            </a>
          )}
        </p>
        <p className="mx-auto mt-5 max-w-md text-xs leading-relaxed">
          Ce lien vous est personnel : il donne accès à votre dossier sans mot de passe. Ne le transférez qu'aux personnes
          de confiance. Police n° {dossier.numero_police}.
        </p>
      </footer>
    </div>
  );
}

function ChampFichier() {
  return (
    <Champ libelle="Votre fichier" requis>
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
