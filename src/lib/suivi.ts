import "server-only";
import { connection } from "next/server";
import { clientAdmin } from "./supabase/admin";
import type { Statut } from "./types";

export type DossierSuivi = {
  id: string;
  numero: string;
  statut: Statut;
  assure_nom: string;
  numero_police: string;
  date_survenance: string;
  date_declaration: string;
  lieu: string | null;
  ville: string | null;
  motif_cloture: string | null;
  montant_regle: number;
  compagnie: { nom: string; sigle: string; telephone: string | null; email: string | null } | null;
  branche: { nom: string } | null;
  type: { nom: string } | null;
  gestionnaire: { prenom: string; nom: string } | null;
};

/**
 * Retrouve un dossier à partir du jeton du lien de suivi.
 * L'assuré n'a pas de compte : le jeton (144 bits aléatoires) fait foi.
 * Seules les colonnes destinées à l'assuré sont lues — jamais les
 * provisions, les notes internes ni les échanges entre compagnies.
 */
export async function dossierParJeton(jeton: string): Promise<DossierSuivi | null> {
  await connection(); // lecture en direct, jamais prérendue
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(jeton)) return null;
  const { data } = await clientAdmin()
    .from("sinistres")
    .select(
      `id, numero, statut, assure_nom, numero_police, date_survenance, date_declaration, lieu, ville,
       motif_cloture, montant_regle,
       compagnie:compagnies!sinistres_compagnie_id_fkey(nom, sigle, telephone, email),
       branche:branches(nom), type:types_sinistre(nom),
       gestionnaire:profils!sinistres_gestionnaire_id_fkey(prenom, nom)`,
    )
    .eq("jeton_suivi", jeton)
    .maybeSingle();
  return (data as unknown as DossierSuivi) ?? null;
}
