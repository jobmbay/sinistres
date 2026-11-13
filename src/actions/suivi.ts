"use server";

import { refresh } from "next/cache";
import { ErreurMetier, echec, succes, texte, texteOuNul } from "@/lib/actions";
import { clientAdmin, COMPARTIMENT_PIECES } from "@/lib/supabase/admin";
import { cheminDePiece, controlerFichier } from "@/lib/fichiers";
import { dossierParJeton, type DossierSuivi } from "@/lib/suivi";
import { fcfa } from "@/lib/format";
import { STATUTS_TERMINES } from "@/lib/referentiel";
import type { EtatAction } from "@/lib/types";

/**
 * Actions de l'espace de suivi : l'assuré agit sans compte, identifié par
 * le jeton de son lien. Chaque action revalide le jeton et ne touche que
 * le dossier correspondant.
 */
async function avecJeton(jeton: string, traitement: (dossier: DossierSuivi) => Promise<EtatAction | void>): Promise<EtatAction> {
  const dossier = await dossierParJeton(jeton);
  if (!dossier) return echec("Ce lien de suivi n'est plus valide.");
  try {
    return (await traitement(dossier)) ?? succes();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return echec(erreur.message);
    console.error("[suivi]", erreur);
    return echec("Une erreur est survenue. Réessayez dans un instant.");
  }
}

async function consigner(dossier: DossierSuivi, type: string, titre: string, description?: string | null) {
  await clientAdmin().from("evenements").insert({
    sinistre_id: dossier.id,
    type,
    titre,
    description: description ?? null,
    visible_client: true,
    auteur_nom: `${dossier.assure_nom} (assuré)`,
  });
}

export async function clientEnvoyerMessage(jeton: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecJeton(jeton, async (dossier) => {
    const contenu = texte(formulaire, "contenu");
    if (!contenu) throw new ErreurMetier("Écrivez votre message.");
    if (contenu.length > 2000) throw new ErreurMetier("Votre message est trop long (2 000 caractères au maximum).");

    const admin = clientAdmin();
    // Garde-fou contre les envois en rafale.
    const depuis = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recents = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sinistre_id", dossier.id)
      .eq("auteur_type", "client")
      .gte("created_at", depuis);
    if ((recents.count ?? 0) >= 8) {
      throw new ErreurMetier("Vous avez envoyé beaucoup de messages. Patientez quelques minutes avant de réessayer.");
    }

    const { error } = await admin.from("messages").insert({
      sinistre_id: dossier.id,
      canal: "client",
      auteur_type: "client",
      auteur_nom: dossier.assure_nom,
      contenu,
    });
    if (error) throw new ErreurMetier("Votre message n'a pas pu être envoyé.");
    refresh();
  });
}

export async function clientDeposerPiece(jeton: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecJeton(jeton, async (dossier) => {
    if (STATUTS_TERMINES.includes(dossier.statut)) {
      throw new ErreurMetier("Ce dossier est terminé : il n'est plus possible d'y déposer de pièce.");
    }
    const fichier = formulaire.get("fichier");
    const documentId = texteOuNul(formulaire, "document_id");
    const libelle = texte(formulaire, "libelle");
    if (!(fichier instanceof File)) throw new ErreurMetier("Choisissez un fichier à envoyer.");
    controlerFichier(fichier);
    if (!documentId && !libelle) throw new ErreurMetier("Précisez de quelle pièce il s'agit.");

    const admin = clientAdmin();

    let libellePiece = libelle;
    if (documentId) {
      // La pièce doit appartenir à ce dossier et être en attente côté assuré.
      const { data: piece } = await admin
        .from("documents")
        .select("id, libelle, statut")
        .eq("id", documentId)
        .eq("sinistre_id", dossier.id)
        .eq("visible_client", true)
        .maybeSingle();
      if (!piece || !["demande", "refuse"].includes(piece.statut)) {
        throw new ErreurMetier("Cette pièce n'est plus attendue.");
      }
      libellePiece = piece.libelle;
    } else {
      const { count } = await admin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("sinistre_id", dossier.id)
        .eq("source", "client");
      if ((count ?? 0) >= 40) throw new ErreurMetier("Le nombre maximal de pièces pour ce dossier est atteint.");
    }

    const chemin = cheminDePiece(dossier.id, fichier.name);
    const depot = await admin.storage.from(COMPARTIMENT_PIECES).upload(chemin, fichier, { contentType: fichier.type });
    if (depot.error) throw new ErreurMetier("Le fichier n'a pas pu être envoyé. Réessayez.");

    const champs = {
      chemin,
      nom_fichier: fichier.name,
      taille: fichier.size,
      mime: fichier.type,
      statut: "recu",
      source: "client",
      commentaire: null,
      recu_le: new Date().toISOString(),
    };
    const { error } = documentId
      ? await admin.from("documents").update(champs).eq("id", documentId).eq("sinistre_id", dossier.id)
      : await admin.from("documents").insert({ ...champs, sinistre_id: dossier.id, libelle, visible_client: true });
    if (error) {
      await admin.storage.from(COMPARTIMENT_PIECES).remove([chemin]);
      throw new ErreurMetier("La pièce n'a pas pu être enregistrée.");
    }

    await consigner(dossier, "piece", `Pièce reçue : ${libellePiece}`, "Envoyée par l'assuré depuis son espace de suivi.");
    refresh();
    return succes("Votre pièce a bien été reçue.");
  });
}

export async function clientRepondreOffre(
  jeton: string,
  offreId: string,
  decision: "acceptee" | "refusee",
  _: EtatAction,
  formulaire: FormData,
): Promise<EtatAction> {
  return avecJeton(jeton, async (dossier) => {
    const motif = texteOuNul(formulaire, "motif");
    if (decision === "refusee" && !motif) throw new ErreurMetier("Expliquez en quelques mots pourquoi vous refusez l'offre.");
    if (decision === "acceptee" && formulaire.get("consentement") !== "on") {
      throw new ErreurMetier("Cochez la case pour confirmer votre accord.");
    }

    const admin = clientAdmin();
    const { data: offre } = await admin
      .from("offres")
      .update({
        statut: decision,
        reponse_motif: motif,
        repondu_par: `${dossier.assure_nom} (espace de suivi)`,
        date_reponse: new Date().toISOString(),
      })
      .eq("id", offreId)
      .eq("sinistre_id", dossier.id)
      .eq("statut", "envoyee")
      .select("montant")
      .maybeSingle();
    if (!offre) throw new ErreurMetier("Cette offre n'est plus en attente de réponse.");

    if (decision === "acceptee") {
      await admin
        .from("sinistres")
        .update({ statut: "accord", montant_provision: offre.montant })
        .eq("id", dossier.id)
        .in("statut", ["declare", "en_instruction", "expertise", "evaluation"]);
    }
    await consigner(
      dossier,
      "offre",
      decision === "acceptee" ? "Offre acceptée par l'assuré" : "Offre refusée par l'assuré",
      decision === "acceptee" ? `Accord sur ${fcfa(offre.montant)}.` : motif,
    );
    refresh();
  });
}
