import { NextResponse, type NextRequest } from "next/server";
import { lireSession } from "@/lib/session";
import { clientAdmin, COMPARTIMENT_PIECES } from "@/lib/supabase/admin";

/**
 * Téléchargement d'une pièce par un utilisateur connecté.
 * La lecture de la ligne « documents » passe par la RLS : si l'utilisateur
 * n'a pas le droit de voir la pièce, elle est introuvable pour lui.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/pieces/[id]">) {
  const { id } = await params;
  const session = await lireSession();
  if (!session) return NextResponse.redirect(new URL("/connexion", request.url));

  const { data: piece } = await session.supabase
    .from("documents")
    .select("chemin, nom_fichier")
    .eq("id", id)
    .maybeSingle();
  if (!piece?.chemin) return new NextResponse("Pièce introuvable.", { status: 404 });

  const { data: lien } = await clientAdmin()
    .storage.from(COMPARTIMENT_PIECES)
    .createSignedUrl(piece.chemin, 60, { download: piece.nom_fichier ?? true });
  if (!lien?.signedUrl) return new NextResponse("Pièce indisponible.", { status: 404 });

  return NextResponse.redirect(lien.signedUrl);
}
