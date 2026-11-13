import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireSession, nomComplet } from "./session";
import { peut, type Permission } from "./referentiel";
import type { EtatAction, Profil } from "./types";

/** Erreur métier dont le message peut être montré tel quel à l'utilisateur. */
export class ErreurMetier extends Error {}

export const echec = (message: string): EtatAction => ({ ok: false, message });
export const succes = (message?: string, donnees?: Record<string, string>): EtatAction => ({
  ok: true,
  message,
  donnees,
});

type Contexte = { supabase: SupabaseClient; profil: Profil };

/**
 * Enveloppe commune des actions serveur : revérifie la session et les
 * permissions à chaque appel (on ne fait jamais confiance au client),
 * puis traduit les erreurs en message lisible.
 */
export async function avecSession(
  permissions: Permission[] | null,
  traitement: (contexte: Contexte) => Promise<EtatAction | void>,
): Promise<EtatAction> {
  const session = await lireSession();
  if (!session) return echec("Votre session a expiré. Reconnectez-vous.");
  if (permissions && !peut(session.profil, ...permissions)) {
    return echec("Vous n'avez pas la permission d'effectuer cette action.");
  }
  try {
    return (await traitement(session)) ?? succes();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return echec(erreur.message);
    // Laisse passer les redirections et notFound de Next.js.
    if (typeof erreur === "object" && erreur !== null && "digest" in erreur) throw erreur;
    console.error("[action]", erreur);
    return echec("Une erreur est survenue. Réessayez dans un instant.");
  }
}

/** Lève une ErreurMetier si la requête Supabase a échoué. */
export function verifier<T>(resultat: { data: T; error: { message: string; code?: string } | null }, contexte: string): T {
  if (resultat.error) {
    console.error(`[supabase] ${contexte}:`, resultat.error.message);
    if (resultat.error.code === "42501") {
      throw new ErreurMetier("Vous n'avez pas les droits nécessaires pour cette action.");
    }
    throw new ErreurMetier(`${contexte} : l'enregistrement a échoué.`);
  }
  return resultat.data;
}

/** Ajoute une ligne à l'historique du dossier. */
export async function journaliser(
  { supabase, profil }: Contexte,
  sinistreId: string,
  evenement: { type: string; titre: string; description?: string | null; visibleClient?: boolean },
) {
  const { error } = await supabase.from("evenements").insert({
    sinistre_id: sinistreId,
    type: evenement.type,
    titre: evenement.titre,
    description: evenement.description ?? null,
    visible_client: evenement.visibleClient ?? false,
    auteur_id: profil.id,
    auteur_nom: nomComplet(profil),
  });
  if (error) console.error("[journal]", error.message);
}

export function texte(formulaire: FormData, cle: string): string {
  return String(formulaire.get(cle) ?? "").trim();
}

export function texteOuNul(formulaire: FormData, cle: string): string | null {
  return texte(formulaire, cle) || null;
}

/**
 * Lit un champ <input type="datetime-local"> (« 2026-03-14T09:30 »).
 * Convention de l'application : les heures sont saisies et affichées en
 * temps universel (GMT, l'heure de Dakar), quel que soit le fuseau du
 * navigateur ou du serveur.
 */
export function lireDateHeure(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valeur)) return null;
  const instant = new Date(`${valeur.slice(0, 16)}:00Z`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}
