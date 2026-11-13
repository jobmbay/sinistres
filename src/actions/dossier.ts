"use server";

import { refresh } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avecSession, ErreurMetier, journaliser, texte, texteOuNul, verifier } from "@/lib/actions";
import { clientAdmin, COMPARTIMENT_PIECES } from "@/lib/supabase/admin";
import { controlerFichier, cheminDePiece } from "@/lib/fichiers";
import { fcfa, lireMontant } from "@/lib/format";
import { nomComplet } from "@/lib/session";
import { MODES_REGLEMENT, NATURES_EXPERTISE, NATURES_REGLEMENT, peut, STATUTS } from "@/lib/referentiel";
import type { DocumentPiece, EtatAction, Expertise, Offre, Reglement, Statut } from "@/lib/types";

/** Fait avancer le dossier vers `cible` s'il n'y est pas encore arrivé. */
async function avancerVers(supabase: SupabaseClient, sinistreId: string, cible: Statut) {
  const { data } = await supabase.from("sinistres").select("statut").eq("id", sinistreId).single();
  const actuel = data?.statut as Statut | undefined;
  if (!actuel) return;
  const etape = STATUTS[actuel].etape;
  if (etape >= 0 && etape < STATUTS[cible].etape) {
    await supabase.from("sinistres").update({ statut: cible }).eq("id", sinistreId);
  }
}

async function exigerDossier(supabase: SupabaseClient, sinistreId: string) {
  return verifier(
    await supabase.from("sinistres").select("id, numero, statut, assure_nom").eq("id", sinistreId).single(),
    "Dossier introuvable",
  ) as { id: string; numero: string; statut: Statut; assure_nom: string };
}

/* ================================================================== */
/*  PIÈCES                                                             */
/* ================================================================== */

export async function demanderPiece(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["documents.gerer"], async (contexte) => {
    const libelle = texte(formulaire, "libelle");
    if (!libelle) throw new ErreurMetier("Indiquez la pièce à demander.");
    verifier(
      await contexte.supabase
        .from("documents")
        .insert({
          sinistre_id: sinistreId,
          libelle,
          statut: "demande",
          source: "client",
          visible_client: true,
          commentaire: texteOuNul(formulaire, "commentaire"),
        })
        .select("id")
        .single(),
      "Demande de pièce",
    );
    await journaliser(contexte, sinistreId, {
      type: "piece",
      titre: `Pièce demandée : ${libelle}`,
      visibleClient: true,
    });
    refresh();
  });
}

export async function deposerPiece(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["documents.gerer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const fichier = formulaire.get("fichier");
    const documentId = texteOuNul(formulaire, "document_id");
    const libelle = texte(formulaire, "libelle");
    const visibleClient = formulaire.get("visible_client") === "on";

    if (!(fichier instanceof File)) throw new ErreurMetier("Choisissez un fichier à déposer.");
    controlerFichier(fichier);
    if (!documentId && !libelle) throw new ErreurMetier("Donnez un intitulé à la pièce.");

    await exigerDossier(supabase, sinistreId); // contrôle d'accès (RLS) avant tout dépôt

    const admin = clientAdmin();
    const chemin = cheminDePiece(sinistreId, fichier.name);
    const depot = await admin.storage.from(COMPARTIMENT_PIECES).upload(chemin, fichier, { contentType: fichier.type });
    if (depot.error) throw new ErreurMetier("Le fichier n'a pas pu être enregistré. Réessayez.");

    const champs = {
      chemin,
      nom_fichier: fichier.name,
      taille: fichier.size,
      mime: fichier.type,
      statut: "valide",
      source: "agent",
      depose_par: profil.id,
      recu_le: new Date().toISOString(),
    };
    const requete = documentId
      ? supabase.from("documents").update(champs).eq("id", documentId).eq("sinistre_id", sinistreId)
      : supabase.from("documents").insert({ ...champs, sinistre_id: sinistreId, libelle, visible_client: visibleClient });
    const resultat = await requete.select("libelle").single();
    if (resultat.error) {
      await admin.storage.from(COMPARTIMENT_PIECES).remove([chemin]);
      throw new ErreurMetier("La pièce n'a pas pu être rattachée au dossier.");
    }

    await journaliser(contexte, sinistreId, {
      type: "piece",
      titre: `Pièce ajoutée : ${(resultat.data as { libelle: string }).libelle}`,
      visibleClient: documentId ? true : visibleClient,
    });
    refresh();
  });
}

export async function statuerPiece(
  documentId: string,
  decision: "valide" | "refuse",
  _: EtatAction,
  formulaire: FormData,
): Promise<EtatAction> {
  return avecSession(["documents.gerer"], async (contexte) => {
    const commentaire = texteOuNul(formulaire, "commentaire");
    if (decision === "refuse" && !commentaire) {
      throw new ErreurMetier("Expliquez à l'assuré pourquoi la pièce est refusée.");
    }
    const piece = verifier(
      await contexte.supabase
        .from("documents")
        .update({ statut: decision, commentaire })
        .eq("id", documentId)
        .select("sinistre_id, libelle, chemin")
        .single(),
      "Mise à jour de la pièce",
    ) as Pick<DocumentPiece, "sinistre_id" | "libelle" | "chemin">;

    await journaliser(contexte, piece.sinistre_id, {
      type: "piece",
      titre: decision === "valide" ? `Pièce validée : ${piece.libelle}` : `Pièce refusée : ${piece.libelle}`,
      description: decision === "refuse" ? commentaire : null,
      visibleClient: true,
    });
    refresh();
  });
}

export async function validerPiece(documentId: string): Promise<EtatAction> {
  return statuerPiece(documentId, "valide", null, new FormData());
}

export async function partagerPieceAdverse(documentId: string, partager: boolean): Promise<EtatAction> {
  return avecSession(["documents.gerer", "recours.gerer"], async ({ supabase }) => {
    verifier(
      await supabase.from("documents").update({ visible_adverse: partager }).eq("id", documentId).select("id").single(),
      "Partage de la pièce",
    );
    refresh();
  });
}

export async function supprimerPiece(documentId: string): Promise<EtatAction> {
  return avecSession(["documents.gerer"], async (contexte) => {
    const piece = verifier(
      await contexte.supabase.from("documents").delete().eq("id", documentId).select("sinistre_id, libelle, chemin").single(),
      "Suppression de la pièce",
    ) as Pick<DocumentPiece, "sinistre_id" | "libelle" | "chemin">;
    if (piece.chemin) await clientAdmin().storage.from(COMPARTIMENT_PIECES).remove([piece.chemin]);
    await journaliser(contexte, piece.sinistre_id, { type: "piece", titre: `Pièce retirée : ${piece.libelle}` });
    refresh();
  });
}

/* ================================================================== */
/*  EXPERTISES                                                         */
/* ================================================================== */

export async function missionnerExpert(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["expertises.gerer"], async (contexte) => {
    const { supabase } = contexte;
    const expertNom = texte(formulaire, "expert_nom");
    const nature = texte(formulaire, "nature") || "materielle";
    if (!expertNom) throw new ErreurMetier("Indiquez le nom de l'expert.");
    if (!NATURES_EXPERTISE[nature]) throw new ErreurMetier("Nature d'expertise invalide.");

    verifier(
      await supabase
        .from("expertises")
        .insert({
          sinistre_id: sinistreId,
          nature,
          expert_nom: expertNom,
          expert_cabinet: texteOuNul(formulaire, "expert_cabinet"),
          expert_telephone: texteOuNul(formulaire, "expert_telephone"),
          expert_email: texteOuNul(formulaire, "expert_email"),
          date_mission: texte(formulaire, "date_mission") || new Date().toISOString().slice(0, 10),
          date_visite: texteOuNul(formulaire, "date_visite"),
        })
        .select("id")
        .single(),
      "Mission d'expertise",
    );
    await avancerVers(supabase, sinistreId, "expertise");
    await journaliser(contexte, sinistreId, {
      type: "expertise",
      titre: `${NATURES_EXPERTISE[nature]} confiée à ${expertNom}`,
      description: texteOuNul(formulaire, "date_visite") ? `Visite prévue le ${texte(formulaire, "date_visite")}.` : null,
      visibleClient: true,
    });
    refresh();
  });
}

export async function mettreAJourExpertise(expertiseId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["expertises.gerer"], async (contexte) => {
    const statut = texte(formulaire, "statut") as Expertise["statut"];
    if (!["missionnee", "en_cours", "rapport_recu", "annulee"].includes(statut)) {
      throw new ErreurMetier("Statut d'expertise invalide.");
    }
    const montantEvalue = texte(formulaire, "montant_evalue") ? lireMontant(formulaire.get("montant_evalue")) : null;
    if (statut === "rapport_recu" && montantEvalue === null) {
      throw new ErreurMetier("Saisissez le montant évalué par l'expert pour enregistrer son rapport.");
    }

    const expertise = verifier(
      await contexte.supabase
        .from("expertises")
        .update({
          statut,
          date_visite: texteOuNul(formulaire, "date_visite"),
          date_rapport:
            statut === "rapport_recu"
              ? texte(formulaire, "date_rapport") || new Date().toISOString().slice(0, 10)
              : texteOuNul(formulaire, "date_rapport"),
          montant_evalue: montantEvalue,
          honoraires: texte(formulaire, "honoraires") ? lireMontant(formulaire.get("honoraires")) : null,
          conclusions: texteOuNul(formulaire, "conclusions"),
        })
        .eq("id", expertiseId)
        .select("sinistre_id, expert_nom")
        .single(),
      "Mise à jour de l'expertise",
    ) as Pick<Expertise, "sinistre_id" | "expert_nom">;

    if (statut === "rapport_recu") {
      await journaliser(contexte, expertise.sinistre_id, {
        type: "expertise",
        titre: "Rapport d'expertise reçu",
        description: `Rapport de ${expertise.expert_nom} enregistré au dossier.`,
        visibleClient: true,
      });
    } else {
      await journaliser(contexte, expertise.sinistre_id, {
        type: "expertise",
        titre: `Expertise mise à jour (${expertise.expert_nom})`,
      });
    }
    refresh();
  });
}

/* ================================================================== */
/*  OFFRES D'INDEMNISATION                                             */
/* ================================================================== */

export async function emettreOffre(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["evaluation.gerer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const montant = lireMontant(formulaire.get("montant"));
    if (montant <= 0) throw new ErreurMetier("Saisissez le montant de l'offre.");

    const enCours = await supabase
      .from("offres")
      .select("id", { count: "exact", head: true })
      .eq("sinistre_id", sinistreId)
      .eq("statut", "envoyee");
    if ((enCours.count ?? 0) > 0) {
      throw new ErreurMetier("Une offre attend déjà la réponse de l'assuré. Annulez-la avant d'en émettre une nouvelle.");
    }

    verifier(
      await supabase
        .from("offres")
        .insert({
          sinistre_id: sinistreId,
          montant,
          detail: texteOuNul(formulaire, "detail"),
          statut: "envoyee",
          date_envoi: new Date().toISOString(),
          cree_par: profil.id,
        })
        .select("id")
        .single(),
      "Émission de l'offre",
    );
    await avancerVers(supabase, sinistreId, "evaluation");
    await journaliser(contexte, sinistreId, {
      type: "offre",
      titre: "Offre d'indemnisation transmise",
      description: `Montant proposé : ${fcfa(montant)}.`,
      visibleClient: true,
    });
    refresh();
  });
}

/** Réponse de l'assuré saisie par l'agent (par téléphone, courrier, en agence…). */
export async function enregistrerReponseOffre(
  offreId: string,
  decision: "acceptee" | "refusee",
  _: EtatAction,
  formulaire: FormData,
): Promise<EtatAction> {
  return avecSession(["evaluation.gerer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const motif = texteOuNul(formulaire, "motif");
    if (decision === "refusee" && !motif) throw new ErreurMetier("Indiquez le motif du refus exprimé par l'assuré.");

    const offre = verifier(
      await supabase
        .from("offres")
        .update({
          statut: decision,
          reponse_motif: motif,
          repondu_par: `Saisi par ${nomComplet(profil)}`,
          date_reponse: new Date().toISOString(),
        })
        .eq("id", offreId)
        .eq("statut", "envoyee")
        .select("sinistre_id, montant")
        .single(),
      "Réponse à l'offre",
    ) as Pick<Offre, "sinistre_id" | "montant">;

    if (decision === "acceptee") {
      await supabase
        .from("sinistres")
        .update({ statut: "accord", montant_provision: offre.montant })
        .eq("id", offre.sinistre_id)
        .in("statut", ["declare", "en_instruction", "expertise", "evaluation"]);
    }
    await journaliser(contexte, offre.sinistre_id, {
      type: "offre",
      titre: decision === "acceptee" ? "Offre acceptée par l'assuré" : "Offre refusée par l'assuré",
      description: decision === "acceptee" ? `Accord sur ${fcfa(offre.montant)}.` : motif,
      visibleClient: true,
    });
    refresh();
  });
}

export async function annulerOffre(offreId: string): Promise<EtatAction> {
  return avecSession(["evaluation.gerer"], async (contexte) => {
    const offre = verifier(
      await contexte.supabase
        .from("offres")
        .update({ statut: "annulee" })
        .eq("id", offreId)
        .eq("statut", "envoyee")
        .select("sinistre_id, montant")
        .single(),
      "Annulation de l'offre",
    ) as Pick<Offre, "sinistre_id" | "montant">;
    await journaliser(contexte, offre.sinistre_id, {
      type: "offre",
      titre: "Offre d'indemnisation annulée",
      description: `Offre de ${fcfa(offre.montant)} retirée.`,
      visibleClient: true,
    });
    refresh();
  });
}

/* ================================================================== */
/*  RÈGLEMENTS                                                         */
/* ================================================================== */

export async function creerReglement(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["reglements.gerer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const beneficiaire = texte(formulaire, "beneficiaire");
    const montant = lireMontant(formulaire.get("montant"));
    const nature = texte(formulaire, "nature") || "indemnite";
    const mode = texte(formulaire, "mode") || "virement";
    if (!beneficiaire) throw new ErreurMetier("Indiquez le bénéficiaire du règlement.");
    if (montant <= 0) throw new ErreurMetier("Saisissez le montant du règlement.");
    if (!NATURES_REGLEMENT[nature] || !MODES_REGLEMENT[mode]) throw new ErreurMetier("Règlement invalide.");

    verifier(
      await supabase
        .from("reglements")
        .insert({
          sinistre_id: sinistreId,
          beneficiaire,
          nature,
          montant,
          mode,
          reference: texteOuNul(formulaire, "reference"),
          cree_par: profil.id,
        })
        .select("id")
        .single(),
      "Création du règlement",
    );
    if (nature === "indemnite") await avancerVers(supabase, sinistreId, "reglement");
    await journaliser(contexte, sinistreId, {
      type: "reglement",
      titre: `Règlement préparé — ${NATURES_REGLEMENT[nature]}`,
      description: `${fcfa(montant)} pour ${beneficiaire} (${MODES_REGLEMENT[mode].toLowerCase()}).`,
    });
    refresh();
  });
}

export async function changerEtatReglement(
  reglementId: string,
  etat: "valide" | "paye" | "annule",
): Promise<EtatAction> {
  return avecSession(["reglements.gerer", "reglements.valider"], async (contexte) => {
    const { supabase, profil } = contexte;
    if (etat !== "annule" && !peut(profil, "reglements.valider")) {
      throw new ErreurMetier("Vous n'avez pas la permission de valider ou de payer un règlement.");
    }
    const attendu = { valide: ["en_attente"], paye: ["valide"], annule: ["en_attente", "valide"] }[etat];

    const reglement = verifier(
      await supabase
        .from("reglements")
        .update({
          statut: etat,
          ...(etat === "valide" ? { valide_par: profil.id } : {}),
          ...(etat === "paye" ? { date_reglement: new Date().toISOString().slice(0, 10) } : {}),
        })
        .eq("id", reglementId)
        .in("statut", attendu)
        .select("sinistre_id, montant, beneficiaire, nature")
        .single(),
      "Mise à jour du règlement",
    ) as Pick<Reglement, "sinistre_id" | "montant" | "beneficiaire" | "nature">;

    const titres = { valide: "Règlement validé", paye: "Règlement effectué", annule: "Règlement annulé" };
    await journaliser(contexte, reglement.sinistre_id, {
      type: "reglement",
      titre: titres[etat],
      description: `${fcfa(reglement.montant)} — ${reglement.beneficiaire}.`,
      // L'assuré n'est informé que du paiement de son indemnité.
      visibleClient: etat === "paye" && reglement.nature === "indemnite",
    });
    refresh();
  });
}

/* ================================================================== */
/*  ÉCHANGES                                                           */
/* ================================================================== */

export async function envoyerMessage(
  sinistreId: string,
  canal: "interne" | "client",
  _: EtatAction,
  formulaire: FormData,
): Promise<EtatAction> {
  return avecSession(["communication.gerer", "sinistres.modifier"], async (contexte) => {
    const { supabase, profil } = contexte;
    const contenu = texte(formulaire, "contenu");
    if (!contenu) throw new ErreurMetier("Écrivez votre message.");
    if (contenu.length > 5000) throw new ErreurMetier("Le message est trop long (5 000 caractères au maximum).");

    verifier(
      await supabase
        .from("messages")
        .insert({
          sinistre_id: sinistreId,
          canal,
          auteur_type: "agent",
          auteur_id: profil.id,
          auteur_nom: nomComplet(profil),
          contenu,
        })
        .select("id")
        .single(),
      "Envoi du message",
    );
    refresh();
  });
}

/** L'assuré a donné son accord autrement que par son espace de suivi. */
export async function accepterOffre(offreId: string): Promise<EtatAction> {
  return enregistrerReponseOffre(offreId, "acceptee", null, new FormData());
}
