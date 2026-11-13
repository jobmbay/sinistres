import { Suspense } from "react";
import { exigerSession, nomComplet } from "@/lib/session";
import { peut, ROLES } from "@/lib/referentiel";
import { initiales } from "@/lib/format";
import { BarreLaterale, SqueletteBarreLaterale, type EntreeNavigation } from "@/components/coquille";

export default function DispositionApplication({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1">
      <Suspense fallback={<SqueletteBarreLaterale />}>
        <Navigation />
      </Suspense>
      <main className="mx-auto w-full max-w-[1500px] px-4 pt-6 pb-16 sm:px-6 lg:pr-8 lg:pl-[17.5rem]">{children}</main>
    </div>
  );
}

async function Navigation() {
  const { profil, supabase } = await exigerSession();

  // Recours reçus d'autres compagnies et encore sans réponse.
  let recoursEnAttente = 0;
  if (profil.compagnie_id) {
    const { count } = await supabase
      .from("recours")
      .select("id", { count: "exact", head: true })
      .eq("compagnie_adverse_id", profil.compagnie_id)
      .eq("statut", "emis");
    recoursEnAttente = count ?? 0;
  }

  const entrees: EntreeNavigation[] = [
    { href: "/tableau-de-bord", libelle: "Tableau de bord", icone: "tableau" },
    { href: "/sinistres", libelle: "Sinistres", icone: "sinistres" },
    { href: "/recours", libelle: "Recours", icone: "recours", compteur: recoursEnAttente },
  ];
  if (peut(profil, "rapports.consulter")) entrees.push({ href: "/rapports", libelle: "Rapports", icone: "rapports" });
  if (profil.role === "gestionnaire") entrees.push({ href: "/compagnies", libelle: "Compagnies", icone: "compagnies" });
  if (profil.role !== "agent") entrees.push({ href: "/equipe", libelle: "Équipe", icone: "equipe" });
  entrees.push({ href: "/parametres", libelle: "Paramètres", icone: "parametres" });

  return (
    <BarreLaterale
      entrees={entrees}
      peutDeclarer={peut(profil, "sinistres.creer")}
      utilisateur={{
        nom: nomComplet(profil),
        initiales: initiales(profil.prenom, profil.nom),
        role: ROLES[profil.role],
        compagnie: profil.compagnie?.sigle ?? "Plateforme",
      }}
    />
  );
}
