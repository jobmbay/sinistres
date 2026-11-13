import type { Metadata } from "next";
import { exigerPermission } from "@/lib/session";
import type { Branche, CompagnieResume, TypeSinistre } from "@/lib/types";
import { EnTetePage } from "@/components/ui";
import { AssistantDeclaration } from "./assistant";

export const metadata: Metadata = { title: "Déclarer un sinistre" };

export default async function PageNouveauSinistre() {
  const { supabase, profil } = await exigerPermission("sinistres.creer");

  const [branchesRes, typesRes, compagniesRes] = await Promise.all([
    supabase.from("branches").select("*").eq("actif", true).order("ordre"),
    supabase.from("types_sinistre").select("*").order("ordre"),
    supabase.from("compagnies").select("id, nom, sigle").eq("actif", true).order("nom"),
  ]);

  return (
    <>
      <EnTetePage
        titre="Déclarer un sinistre"
        description="Cinq étapes courtes. Le dossier est créé à la fin, avec son lien de suivi pour l'assuré."
        retour={{ href: "/sinistres", libelle: "Sinistres" }}
      />
      <AssistantDeclaration
        branches={(branchesRes.data ?? []) as Branche[]}
        types={(typesRes.data ?? []) as TypeSinistre[]}
        compagnies={(compagniesRes.data ?? []) as CompagnieResume[]}
        compagnieFixe={profil.role === "gestionnaire" ? null : profil.compagnie_id}
      />
    </>
  );
}
