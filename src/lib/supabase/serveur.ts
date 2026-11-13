import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Client Supabase lié à la session de l'utilisateur (cookies).
 * Toutes les requêtes passent par la RLS : un utilisateur ne voit que
 * les données de sa compagnie.
 */
export async function clientServeur() {
  const jarre = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, {
    cookies: {
      getAll: () => jarre.getAll(),
      setAll: (liste) => {
        try {
          for (const { name, value, options } of liste) jarre.set(name, value, options);
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}
