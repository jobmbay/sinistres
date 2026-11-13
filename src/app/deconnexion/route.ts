import { NextResponse, type NextRequest } from "next/server";
import { clientServeur } from "@/lib/supabase/serveur";

/**
 * Ferme la session puis renvoie à la connexion.
 * Utilisé quand un compte authentifié n'a plus le droit d'entrer
 * (compte désactivé, compagnie suspendue, profil supprimé).
 */
export async function GET(request: NextRequest) {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/connexion", request.url));
}
