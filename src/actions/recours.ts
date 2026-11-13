"use server";

import { refresh } from "next/cache";
import { avecSession, ErreurMetier, journaliser, texte, texteOuNul, verifier } from "@/lib/actions";
import { clientAdmin } from "@/lib/supabase/admin";
import { fcfa, lireMontant } from "@/lib/format";
import { nomComplet } from "@/lib/session";
import type { EtatAction, Profil, Recours } from "@/lib/types";

type Cote = "emettrice" | "adverse" | "gestionnaire";

function coteDe(profil: Profil, recours: Pick<Recours, "compagnie_emettrice_id" | "compagnie_adverse_id">): Cote | null {
  if (profil.role === "gestionnaire") return "gestionnaire";
  if (profil.compagnie_id === recours.compagnie_emettrice_id) return "emettrice";
  if (profil.compagnie_id === recours.compagnie_adverse_id) return "adverse";
  return null;
}

/**
 * Historique écrit avec la clé secrète : la compagnie adverse n'a pas accès
 * au dossier lui-même, mais sa réponse doit y être consignée.
 */
async function consigner(sinistreId: string, profil: Profil, titre: string, description?: string | null) {
  const { error } = await clientAdmin()
    .from("evenements")
    .insert({
      sinistre_id: sinistreId,
      type: "recours",
      titre,
      description: description ?? null,
      visible_client: false,
      auteur_id: profil.id,
      auteur_nom: `${nomComplet(profil)}${profil.compagnie ? ` (${profil.compagnie.sigle})` : ""}`,
    });
  if (error) console.error("[journal recours]", error.message);
}

export async function emettreRecours(sinistreId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["recours.gerer"], async (contexte) => {
    const { supabase, profil } = contexte;
    const montant = lireMontant(formulaire.get("montant_reclame"));
    const motif = texte(formulaire, "motif");
    if (montant <= 0) throw new ErreurMetier("Saisissez le montant réclamé.");
    if (!motif) throw new ErreurMetier("Exposez le fondement du recours.");

    const sinistre = verifier(
      await supabase.from("sinistres").select("id, compagnie_id, compagnie_adverse_id").eq("id", sinistreId).single(),
      "Dossier introuvable",
    ) as { id: string; compagnie_id: string; compagnie_adverse_id: string | null };
    if (!sinistre.compagnie_adverse_id) {
      throw new ErreurMetier("Renseignez d'abord la compagnie adverse dans les informations du dossier.");
    }

    const actif = await supabase
      .from("recours")
      .select("id", { count: "exact", head: true })
      .eq("sinistre_id", sinistreId)
      .in("statut", ["emis", "accepte", "conteste"]);
    if ((actif.count ?? 0) > 0) throw new ErreurMetier("Un recours est déjà en cours sur ce dossier.");

    const recours = verifier(
      await supabase
        .from("recours")
        .insert({
          sinistre_id: sinistreId,
          compagnie_emettrice_id: sinistre.compagnie_id,
          compagnie_adverse_id: sinistre.compagnie_adverse_id,
          montant_reclame: montant,
          motif,
          cree_par: profil.id,
        })
        .select("numero")
        .single(),
      "Émission du recours",
    ) as { numero: string };

    await journaliser(contexte, sinistreId, {
      type: "recours",
      titre: `Recours ${recours.numero} émis`,
      description: `Montant réclamé : ${fcfa(montant)}.`,
    });
    refresh();
  });
}

/** Réponse de la compagnie adverse (ou du gestionnaire pour son compte). */
export async function repondreRecours(recoursId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["recours.gerer"], async ({ supabase, profil }) => {
    const decision = texte(formulaire, "decision");
    const reponse = texteOuNul(formulaire, "reponse");
    if (decision !== "accepte" && decision !== "conteste") throw new ErreurMetier("Choisissez d'accepter ou de contester.");
    if (decision === "conteste" && !reponse) throw new ErreurMetier("Motivez votre contestation.");

    const recours = verifier(
      await supabase.from("recours").select("*").eq("id", recoursId).single(),
      "Recours introuvable",
    ) as Recours;
    const cote = coteDe(profil, recours);
    if (cote !== "adverse" && cote !== "gestionnaire") {
      throw new ErreurMetier("Seule la compagnie adverse peut répondre à ce recours.");
    }
    if (recours.statut !== "emis") throw new ErreurMetier("Ce recours a déjà reçu une réponse.");

    const montantAccorde =
      decision === "accepte"
        ? texte(formulaire, "montant_accorde")
          ? lireMontant(formulaire.get("montant_accorde"))
          : recours.montant_reclame
        : null;
    if (montantAccorde !== null && (montantAccorde <= 0 || montantAccorde > recours.montant_reclame)) {
      throw new ErreurMetier("Le montant accordé doit être compris entre 1 FCFA et le montant réclamé.");
    }

    verifier(
      await supabase
        .from("recours")
        .update({
          statut: decision,
          reponse,
          montant_accorde: montantAccorde,
          date_reponse: new Date().toISOString(),
        })
        .eq("id", recoursId)
        .eq("statut", "emis")
        .select("id")
        .single(),
      "Réponse au recours",
    );

    await consigner(
      recours.sinistre_id,
      profil,
      decision === "accepte" ? `Recours ${recours.numero} accepté` : `Recours ${recours.numero} contesté`,
      decision === "accepte" ? `Montant accordé : ${fcfa(montantAccorde)}.` : reponse,
    );
    refresh();
  });
}

/** Suites données par la compagnie émettrice : encaissement, relance ou abandon. */
export async function cloreRecours(recoursId: string, suite: "regle" | "abandonne" | "emis"): Promise<EtatAction> {
  return avecSession(["recours.gerer"], async ({ supabase, profil }) => {
    const recours = verifier(
      await supabase.from("recours").select("*").eq("id", recoursId).single(),
      "Recours introuvable",
    ) as Recours;
    const cote = coteDe(profil, recours);
    if (cote !== "emettrice" && cote !== "gestionnaire") {
      throw new ErreurMetier("Seule la compagnie à l'origine du recours peut effectuer cette action.");
    }
    const possibles: Record<typeof suite, Recours["statut"][]> = {
      regle: ["accepte"],
      abandonne: ["emis", "conteste", "accepte"],
      emis: ["conteste"],
    };
    if (!possibles[suite].includes(recours.statut)) {
      throw new ErreurMetier("Cette action n'est pas possible dans l'état actuel du recours.");
    }

    verifier(
      await supabase
        .from("recours")
        .update({
          statut: suite,
          ...(suite === "regle" ? { date_reglement: new Date().toISOString() } : {}),
          ...(suite === "emis" ? { reponse: null, date_reponse: null, montant_accorde: null } : {}),
        })
        .eq("id", recoursId)
        .select("id")
        .single(),
      "Mise à jour du recours",
    );

    const titres = {
      regle: `Recours ${recours.numero} encaissé`,
      abandonne: `Recours ${recours.numero} abandonné`,
      emis: `Recours ${recours.numero} maintenu et relancé`,
    };
    await consigner(
      recours.sinistre_id,
      profil,
      titres[suite],
      suite === "regle" ? `Montant encaissé : ${fcfa(recours.montant_accorde ?? recours.montant_reclame)}.` : null,
    );
    refresh();
  });
}

/** Message échangé entre les deux compagnies au sujet du recours. */
export async function envoyerMessageRecours(recoursId: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(["recours.gerer"], async ({ supabase, profil }) => {
    const contenu = texte(formulaire, "contenu");
    if (!contenu) throw new ErreurMetier("Écrivez votre message.");
    if (contenu.length > 5000) throw new ErreurMetier("Le message est trop long (5 000 caractères au maximum).");

    const recours = verifier(
      await supabase.from("recours").select("*").eq("id", recoursId).single(),
      "Recours introuvable",
    ) as Recours;
    const cote = coteDe(profil, recours);
    if (!cote) throw new ErreurMetier("Vous n'avez pas accès à ce recours.");

    verifier(
      await supabase
        .from("messages")
        .insert({
          sinistre_id: recours.sinistre_id,
          canal: "adverse",
          auteur_type: cote === "adverse" ? "adverse" : "agent",
          auteur_id: profil.id,
          auteur_nom: `${nomComplet(profil)} — ${profil.compagnie?.sigle ?? "Gestionnaire"}`,
          contenu,
        })
        .select("id")
        .single(),
      "Envoi du message",
    );
    refresh();
  });
}
