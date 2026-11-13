import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUTS, STATUTS_OUVERTS, STATUTS_TERMINES } from "./referentiel";
import type { Statut } from "./types";

export const SELECTION_SINISTRE = `*,
  compagnie:compagnies!sinistres_compagnie_id_fkey(id, nom, sigle),
  adverse:compagnies!sinistres_compagnie_adverse_id_fkey(id, nom, sigle),
  branche:branches(id, code, nom, famille, pieces_requises),
  type:types_sinistre(nom),
  gestionnaire:profils!sinistres_gestionnaire_id_fkey(prenom, nom)`;

export type FiltresSinistres = {
  q?: string;
  statut?: string;
  branche?: string;
  compagnie?: string;
  adverse?: string;
  attente?: "pieces" | "reglements" | "offres";
  mien?: boolean;
};

type Parametres = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function un(valeur: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v?.trim() || undefined;
}

export function lireFiltres(parametres: Parametres): FiltresSinistres {
  const uuid = (cle: string) => {
    const v = un(parametres[cle]);
    return v && UUID.test(v) ? v : undefined;
  };
  const attente = un(parametres.attente);
  return {
    q: un(parametres.q)?.slice(0, 80),
    statut: un(parametres.statut),
    branche: uuid("branche"),
    compagnie: uuid("compagnie"),
    adverse: uuid("adverse"),
    attente: attente === "pieces" || attente === "reglements" || attente === "offres" ? attente : undefined,
    mien: un(parametres.mien) === "1",
  };
}

/**
 * Construit la requête « liste des sinistres » filtrée.
 * La RLS restreint déjà le résultat aux dossiers visibles par l'utilisateur.
 *
 * Renvoie `{ requete }` et non la requête elle-même : un constructeur de
 * requête Supabase est « thenable », le renvoyer directement depuis une
 * fonction async l'exécuterait avant qu'on ait pu la trier ou la paginer.
 */
export async function requeteSinistres(
  supabase: SupabaseClient,
  filtres: FiltresSinistres,
  options: { compter?: boolean; utilisateurId?: string } = {},
) {
  let requete = supabase
    .from("sinistres")
    .select(SELECTION_SINISTRE, options.compter ? { count: "exact" } : undefined);

  if (filtres.q) {
    // Caractères réservés de la syntaxe de filtre PostgREST retirés.
    const terme = filtres.q.replace(/[,()"'\\%*]/g, " ").trim();
    if (terme) {
      requete = requete.or(
        `numero.ilike.%${terme}%,assure_nom.ilike.%${terme}%,numero_police.ilike.%${terme}%,tiers_nom.ilike.%${terme}%`,
      );
    }
  }
  if (filtres.statut === "ouverts") requete = requete.in("statut", STATUTS_OUVERTS);
  else if (filtres.statut === "termines") requete = requete.in("statut", STATUTS_TERMINES);
  else if (filtres.statut && filtres.statut in STATUTS) requete = requete.eq("statut", filtres.statut as Statut);

  if (filtres.branche) requete = requete.eq("branche_id", filtres.branche);
  if (filtres.compagnie) requete = requete.eq("compagnie_id", filtres.compagnie);
  if (filtres.adverse) requete = requete.eq("compagnie_adverse_id", filtres.adverse);
  if (filtres.mien && options.utilisateurId) requete = requete.eq("gestionnaire_id", options.utilisateurId);

  if (filtres.attente) {
    const source = {
      pieces: supabase.from("documents").select("sinistre_id").eq("statut", "recu"),
      reglements: supabase.from("reglements").select("sinistre_id").in("statut", ["en_attente", "valide"]),
      offres: supabase.from("offres").select("sinistre_id").eq("statut", "envoyee"),
    }[filtres.attente];
    const { data } = await source.limit(1000);
    const ids = [...new Set((data ?? []).map((l) => l.sinistre_id as string))];
    // Aucun dossier concerné : identifiant impossible, pour renvoyer une liste vide.
    requete = requete.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  return { requete };
}

export const LIBELLES_ATTENTE: Record<NonNullable<FiltresSinistres["attente"]>, string> = {
  pieces: "Pièces reçues à contrôler",
  reglements: "Règlements à valider ou à payer",
  offres: "Offres en attente de réponse",
};
