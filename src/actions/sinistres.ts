"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  avecSession,
  ErreurMetier,
  journaliser,
  lireDateHeure,
  texte,
  texteOuNul,
  verifier,
} from "@/lib/actions";
import { clientAdmin, COMPARTIMENT_PIECES } from "@/lib/supabase/admin";
import { lireMontant } from "@/lib/format";
import { champsDeBranche, peut, STATUTS, STATUTS_AVEC_MOTIF, STATUTS_TERMINES, TRANSITIONS } from "@/lib/referentiel";
import type { EtatAction, Priorite, Sinistre, Statut } from "@/lib/types";

const PRIORITES: Priorite[] = ["basse", "normale", "haute", "urgente"];

function lireDetails(formulaire: FormData, codeBranche: string) {
  const details: Record<string, string> = {};
  for (const champ of champsDeBranche(codeBranche)) {
    const valeur = texte(formulaire, `detail_${champ.cle}`);
    if (valeur) details[champ.cle] = valeur;
  }
  return details;
}

function lireTaux(formulaire: FormData): number | null {
  const brut = texte(formulaire, "taux_responsabilite");
  if (brut === "") return null;
  const taux = Number(brut);
  if (!Number.isInteger(taux) || taux < 0 || taux > 100) {
    throw new ErreurMetier("Le taux de responsabilité doit être compris entre 0 et 100.");
  }
  return taux;
}

/* ------------------------------------------------------------------ */
/*  Déclaration                                                        */
/* ------------------------------------------------------------------ */

export async function declarerSinistre(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["sinistres.creer"], async (contexte) => {
    const { supabase, profil } = contexte;

    const compagnieId = profil.role === "gestionnaire" ? texte(formulaire, "compagnie_id") : profil.compagnie_id;
    const brancheId = texte(formulaire, "branche_id");
    const assureNom = texte(formulaire, "assure_nom");
    const numeroPolice = texte(formulaire, "numero_police");
    const dateSurvenance = texte(formulaire, "date_survenance");

    if (!compagnieId) throw new ErreurMetier("Choisissez la compagnie d'assurance concernée.");
    if (!brancheId) throw new ErreurMetier("Choisissez la branche d'assurance.");
    if (!numeroPolice) throw new ErreurMetier("Indiquez le numéro de police.");
    if (!assureNom) throw new ErreurMetier("Indiquez le nom de l'assuré.");
    if (!dateSurvenance) throw new ErreurMetier("Indiquez la date de survenance du sinistre.");
    const survenance = lireDateHeure(dateSurvenance);
    if (!survenance) throw new ErreurMetier("La date de survenance est invalide.");
    // Tolérance de quelques heures pour les utilisateurs situés à l'est de GMT.
    if (survenance.getTime() > Date.now() + 3 * 3600_000) {
      throw new ErreurMetier("La date de survenance ne peut pas être dans le futur.");
    }

    const compagnieAdverseId = texteOuNul(formulaire, "compagnie_adverse_id");
    if (compagnieAdverseId && compagnieAdverseId === compagnieId) {
      throw new ErreurMetier("La compagnie adverse doit être différente de la compagnie de l'assuré.");
    }

    const branche = verifier(
      await supabase.from("branches").select("id, code, pieces_requises").eq("id", brancheId).single(),
      "Branche introuvable",
    ) as { id: string; code: string; pieces_requises: string[] };

    const priorite = texte(formulaire, "priorite") as Priorite;

    const sinistre = verifier(
      await supabase
        .from("sinistres")
        .insert({
          compagnie_id: compagnieId,
          compagnie_adverse_id: compagnieAdverseId,
          branche_id: branche.id,
          type_sinistre_id: texteOuNul(formulaire, "type_sinistre_id"),
          priorite: PRIORITES.includes(priorite) ? priorite : "normale",
          numero_police: numeroPolice,
          assure_nom: assureNom,
          assure_telephone: texteOuNul(formulaire, "assure_telephone"),
          assure_email: texteOuNul(formulaire, "assure_email")?.toLowerCase() ?? null,
          assure_adresse: texteOuNul(formulaire, "assure_adresse"),
          date_survenance: survenance.toISOString(),
          lieu: texteOuNul(formulaire, "lieu"),
          ville: texteOuNul(formulaire, "ville"),
          circonstances: texteOuNul(formulaire, "circonstances"),
          details: lireDetails(formulaire, branche.code),
          tiers_nom: texteOuNul(formulaire, "tiers_nom"),
          tiers_telephone: texteOuNul(formulaire, "tiers_telephone"),
          tiers_police: texteOuNul(formulaire, "tiers_police"),
          tiers_details: texteOuNul(formulaire, "tiers_details"),
          taux_responsabilite: lireTaux(formulaire),
          montant_estime: lireMontant(formulaire.get("montant_estime")),
          montant_provision: lireMontant(formulaire.get("montant_estime")),
          gestionnaire_id: profil.id,
          cree_par: profil.id,
        })
        .select("id, numero")
        .single(),
      "Déclaration du sinistre",
    ) as { id: string; numero: string };

    // Les pièces habituelles de la branche sont demandées d'office à l'assuré.
    if (branche.pieces_requises.length > 0) {
      // Horodatages décalés d'une milliseconde : la liste garde l'ordre défini pour la branche.
      const base = Date.now();
      await supabase.from("documents").insert(
        branche.pieces_requises.map((libelle, rang) => ({
          sinistre_id: sinistre.id,
          libelle,
          statut: "demande",
          source: "client",
          visible_client: true,
          created_at: new Date(base + rang).toISOString(),
        })),
      );
    }

    await journaliser(contexte, sinistre.id, {
      type: "declaration",
      titre: "Sinistre déclaré",
      description: `Dossier ${sinistre.numero} ouvert.`,
      visibleClient: true,
    });

    redirect(`/sinistres/${sinistre.id}`);
  });
}

/* ------------------------------------------------------------------ */
/*  Modification des informations du dossier                           */
/* ------------------------------------------------------------------ */

export async function modifierSinistre(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["sinistres.modifier"], async (contexte) => {
    const { supabase } = contexte;
    const actuel = verifier(
      await supabase.from("sinistres").select("id, compagnie_id, branche:branches(code)").eq("id", id).single(),
      "Dossier introuvable",
    ) as unknown as { id: string; compagnie_id: string; branche: { code: string } };

    const assureNom = texte(formulaire, "assure_nom");
    const numeroPolice = texte(formulaire, "numero_police");
    const dateSurvenance = texte(formulaire, "date_survenance");
    if (!assureNom || !numeroPolice || !dateSurvenance) {
      throw new ErreurMetier("Le nom de l'assuré, le numéro de police et la date de survenance sont obligatoires.");
    }
    const survenance = lireDateHeure(dateSurvenance);
    if (!survenance) throw new ErreurMetier("La date de survenance est invalide.");
    const compagnieAdverseId = texteOuNul(formulaire, "compagnie_adverse_id");
    if (compagnieAdverseId === actuel.compagnie_id) {
      throw new ErreurMetier("La compagnie adverse doit être différente de la compagnie de l'assuré.");
    }

    verifier(
      await supabase
        .from("sinistres")
        .update({
          type_sinistre_id: texteOuNul(formulaire, "type_sinistre_id"),
          numero_police: numeroPolice,
          assure_nom: assureNom,
          assure_telephone: texteOuNul(formulaire, "assure_telephone"),
          assure_email: texteOuNul(formulaire, "assure_email")?.toLowerCase() ?? null,
          assure_adresse: texteOuNul(formulaire, "assure_adresse"),
          date_survenance: survenance.toISOString(),
          lieu: texteOuNul(formulaire, "lieu"),
          ville: texteOuNul(formulaire, "ville"),
          circonstances: texteOuNul(formulaire, "circonstances"),
          details: lireDetails(formulaire, actuel.branche.code),
          compagnie_adverse_id: compagnieAdverseId,
          tiers_nom: texteOuNul(formulaire, "tiers_nom"),
          tiers_telephone: texteOuNul(formulaire, "tiers_telephone"),
          tiers_police: texteOuNul(formulaire, "tiers_police"),
          tiers_details: texteOuNul(formulaire, "tiers_details"),
          taux_responsabilite: lireTaux(formulaire),
        })
        .eq("id", id)
        .select("id")
        .single(),
      "Modification du dossier",
    );

    await journaliser(contexte, id, { type: "modification", titre: "Informations du dossier modifiées" });
    refresh();
  });
}

/* ------------------------------------------------------------------ */
/*  Statut                                                             */
/* ------------------------------------------------------------------ */

export async function changerStatut(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["sinistres.modifier", "sinistres.cloturer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const cible = texte(formulaire, "statut") as Statut;
    const motif = texteOuNul(formulaire, "motif");

    const actuel = verifier(
      await supabase.from("sinistres").select("id, statut").eq("id", id).single(),
      "Dossier introuvable",
    ) as Pick<Sinistre, "id" | "statut">;

    if (!STATUTS[cible] || !TRANSITIONS[actuel.statut].includes(cible)) {
      throw new ErreurMetier("Ce changement de statut n'est pas possible depuis l'état actuel du dossier.");
    }

    const toucheCloture = STATUTS_TERMINES.includes(cible) || STATUTS_TERMINES.includes(actuel.statut);
    if (toucheCloture && !peut(profil, "sinistres.cloturer")) {
      throw new ErreurMetier("Vous n'avez pas la permission de clôturer, rejeter ou rouvrir un dossier.");
    }
    if (!toucheCloture && !peut(profil, "sinistres.modifier")) {
      throw new ErreurMetier("Vous n'avez pas la permission de faire avancer ce dossier.");
    }
    if (STATUTS_AVEC_MOTIF.includes(cible) && cible !== "clos" && !motif) {
      throw new ErreurMetier("Un motif est obligatoire pour ce changement de statut.");
    }

    const termine = STATUTS_TERMINES.includes(cible);
    verifier(
      await supabase
        .from("sinistres")
        .update({
          statut: cible,
          motif_cloture: termine || cible === "contentieux" ? motif : null,
          date_cloture: termine ? new Date().toISOString() : null,
          // Un dossier terminé ne porte plus de provision.
          ...(termine ? { montant_provision: 0 } : {}),
        })
        .eq("id", id)
        .select("id")
        .single(),
      "Changement de statut",
    );

    const reouverture = STATUTS_TERMINES.includes(actuel.statut);
    await journaliser(contexte, id, {
      type: "statut",
      titre: reouverture ? `Dossier rouvert — ${STATUTS[cible].libelle}` : `Statut : ${STATUTS[cible].libelle}`,
      description: motif ?? STATUTS[cible].description,
      visibleClient: true,
    });
    refresh();
  });
}

/* ------------------------------------------------------------------ */
/*  Attribution et priorité                                            */
/* ------------------------------------------------------------------ */

export async function attribuerDossier(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["sinistres.modifier"], async (contexte) => {
    const { supabase } = contexte;
    const gestionnaireId = texteOuNul(formulaire, "gestionnaire_id");
    const priorite = texte(formulaire, "priorite") as Priorite;
    if (!PRIORITES.includes(priorite)) throw new ErreurMetier("Priorité invalide.");

    let nomAttribue = "personne";
    if (gestionnaireId) {
      const attribue = verifier(
        await supabase.from("profils").select("prenom, nom").eq("id", gestionnaireId).single(),
        "Utilisateur introuvable",
      ) as { prenom: string; nom: string };
      nomAttribue = `${attribue.prenom} ${attribue.nom}`;
    }

    verifier(
      await supabase
        .from("sinistres")
        .update({ gestionnaire_id: gestionnaireId, priorite })
        .eq("id", id)
        .select("id")
        .single(),
      "Attribution du dossier",
    );
    await journaliser(contexte, id, {
      type: "attribution",
      titre: `Dossier attribué à ${nomAttribue}`,
      description: `Priorité ${priorite}.`,
    });
    refresh();
  });
}

/* ------------------------------------------------------------------ */
/*  Évaluation financière                                              */
/* ------------------------------------------------------------------ */

export async function mettreAJourEvaluation(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["evaluation.gerer"], async (contexte) => {
    const estime = lireMontant(formulaire.get("montant_estime"));
    const provision = lireMontant(formulaire.get("montant_provision"));
    const franchise = lireMontant(formulaire.get("montant_franchise"));

    verifier(
      await contexte.supabase
        .from("sinistres")
        .update({ montant_estime: estime, montant_provision: provision, montant_franchise: franchise })
        .eq("id", id)
        .select("id")
        .single(),
      "Mise à jour de l'évaluation",
    );
    await journaliser(contexte, id, {
      type: "evaluation",
      titre: "Évaluation financière mise à jour",
      description: `Estimation ${estime.toLocaleString("fr-FR")} FCFA · provision ${provision.toLocaleString("fr-FR")} FCFA.`,
    });
    refresh();
  });
}

/* ------------------------------------------------------------------ */
/*  Suppression (gestionnaire uniquement)                              */
/* ------------------------------------------------------------------ */

export async function supprimerSinistre(id: string): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    if (profil.role !== "gestionnaire") throw new ErreurMetier("Seul le gestionnaire peut supprimer un dossier.");
    const { data: pieces } = await supabase.from("documents").select("chemin").eq("sinistre_id", id).not("chemin", "is", null);
    verifier(await supabase.from("sinistres").delete().eq("id", id).select("id").single(), "Suppression du dossier");
    // Les fichiers du dossier ne doivent pas rester orphelins dans le stockage.
    const chemins = (pieces ?? []).map((p) => p.chemin as string);
    if (chemins.length > 0) await clientAdmin().storage.from(COMPARTIMENT_PIECES).remove(chemins);
    redirect("/sinistres");
  });
}

/** Passage de statut en un clic (sans motif). */
export async function passerAuStatut(id: string, statut: Statut): Promise<EtatAction> {
  const formulaire = new FormData();
  formulaire.set("statut", statut);
  return changerStatut(id, null, formulaire);
}
