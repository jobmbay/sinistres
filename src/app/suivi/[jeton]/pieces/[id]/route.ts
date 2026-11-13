import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin, COMPARTIMENT_PIECES } from "@/lib/supabase/admin";
import { dossierParJeton } from "@/lib/suivi";

/** Téléchargement d'une pièce par l'assuré, depuis son lien de suivi. */
export async function GET(_: NextRequest, { params }: RouteContext<"/suivi/[jeton]/pieces/[id]">) {
  const { jeton, id } = await params;
  const dossier = await dossierParJeton(jeton);
  if (!dossier) return new NextResponse("Lien de suivi invalide.", { status: 404 });

  const admin = clientAdmin();
  const { data: piece } = await admin
    .from("documents")
    .select("chemin, nom_fichier")
    .eq("id", id)
    .eq("sinistre_id", dossier.id)
    .eq("visible_client", true)
    .maybeSingle();
  if (!piece?.chemin) return new NextResponse("Pièce introuvable.", { status: 404 });

  const { data: lien } = await admin.storage
    .from(COMPARTIMENT_PIECES)
    .createSignedUrl(piece.chemin, 60, { download: piece.nom_fichier ?? true });
  if (!lien?.signedUrl) return new NextResponse("Pièce indisponible.", { status: 404 });

  return NextResponse.redirect(lien.signedUrl);
}
