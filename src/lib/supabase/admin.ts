import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé secrète : contourne la RLS.
 * À n'utiliser que côté serveur, après avoir vérifié les droits :
 *  - création et gestion des comptes utilisateurs ;
 *  - espace de suivi client (accès par jeton, sans compte) ;
 *  - stockage des pièces (compartiment privé).
 */
export function clientAdmin() {
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!cle) throw new Error("SUPABASE_SECRET_KEY est absent de l'environnement serveur.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const COMPARTIMENT_PIECES = "pieces";
