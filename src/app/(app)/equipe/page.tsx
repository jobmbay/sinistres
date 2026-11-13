import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Pencil, UserPlus, Users, X } from "lucide-react";
import { exigerRole } from "@/lib/session";
import { PERMISSIONS, ROLES } from "@/lib/referentiel";
import { initiales } from "@/lib/format";
import type { CompagnieResume, Profil, Role } from "@/lib/types";
import {
  activerUtilisateur,
  creerUtilisateur,
  modifierUtilisateur,
  reinitialiserMotDePasse,
} from "@/actions/administration";
import { Avatar, Carte, EnTeteCarte, EnTetePage, Pastille, Vide } from "@/components/ui";
import { BoutonAction, FormulaireAction, Modale } from "@/components/interactif";
import { Sigle } from "@/components/metier";
import { ChampsUtilisateur } from "./champs-utilisateur";

export const metadata: Metadata = { title: "Équipe" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageEquipe({ searchParams }: PageProps<"/equipe">) {
  const parametres = await searchParams;
  const { supabase, profil } = await exigerRole("gestionnaire", "admin_compagnie");
  const estGestionnaire = profil.role === "gestionnaire";
  const filtreCompagnie = typeof parametres.compagnie === "string" && UUID.test(parametres.compagnie) ? parametres.compagnie : null;

  let requete = supabase.from("profils").select("*").order("actif", { ascending: false }).order("prenom");
  if (estGestionnaire && filtreCompagnie) requete = requete.eq("compagnie_id", filtreCompagnie);

  const [profilsRes, compagniesRes] = await Promise.all([
    requete,
    estGestionnaire ? supabase.from("compagnies").select("id, nom, sigle").order("nom") : Promise.resolve({ data: null }),
  ]);
  const membres = (profilsRes.data ?? []) as Profil[];
  const compagnies = (compagniesRes.data ?? null) as CompagnieResume[] | null;
  const parCompagnie = new Map(compagnies?.map((c) => [c.id, c]));

  const rolesCreation: Role[] = estGestionnaire ? ["agent", "admin_compagnie", "gestionnaire"] : ["agent", "admin_compagnie"];

  // Regroupement : équipe de la plateforme d'abord, puis par compagnie.
  const groupes: { cle: string; titre: string; sigle?: string; membres: Profil[] }[] = [];
  if (estGestionnaire) {
    const plateforme = membres.filter((m) => m.role === "gestionnaire");
    if (plateforme.length > 0 && !filtreCompagnie) groupes.push({ cle: "plateforme", titre: "Gestionnaires de la plateforme", membres: plateforme });
    for (const compagnie of compagnies ?? []) {
      const equipe = membres.filter((m) => m.compagnie_id === compagnie.id);
      if (equipe.length > 0) groupes.push({ cle: compagnie.id, titre: compagnie.nom, sigle: compagnie.sigle, membres: equipe });
    }
  } else {
    groupes.push({ cle: "compagnie", titre: profil.compagnie?.nom ?? "Votre compagnie", membres });
  }

  return (
    <>
      <EnTetePage
        titre="Équipe"
        description={
          estGestionnaire
            ? "Tous les comptes de la plateforme. Créez des gestionnaires, des administrateurs de compagnie ou des agents."
            : "Créez les comptes de vos agents et choisissez, pour chacun, les fonctions de gestion des sinistres auxquelles il a accès."
        }
        actions={
          <Modale bouton={<><UserPlus size={17} /> Nouvel utilisateur</>} varianteBouton="primaire" tailleBouton="md" titre="Nouvel utilisateur" description="Un mot de passe provisoire sera généré ; l'utilisateur le remplacera à sa première connexion." large>
            <FormulaireAction action={creerUtilisateur} libelle="Créer le compte" libelleEnCours="Création…">
              <ChampsUtilisateur
                creation
                rolesPossibles={rolesCreation}
                compagnies={compagnies ?? undefined}
                defaut={filtreCompagnie ? { prenom: "", nom: "", email: "", telephone: null, fonction: null, role: "agent", permissions: ["documents.gerer", "communication.gerer"], compagnie_id: filtreCompagnie } : undefined}
              />
            </FormulaireAction>
          </Modale>
        }
      />

      {filtreCompagnie && (
        <Link href="/equipe" className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-or/40 bg-or/10 px-3 py-1 text-xs text-or-clair hover:bg-or/20">
          {parCompagnie.get(filtreCompagnie)?.nom ?? "Compagnie"} <X size={13} />
        </Link>
      )}

      {groupes.length === 0 ? (
        <Carte>
          <Vide icone={<Users size={22} />} titre="Aucun utilisateur" description="Créez le premier compte avec le bouton « Nouvel utilisateur »." />
        </Carte>
      ) : (
        <div className="space-y-4">
          {groupes.map((groupe) => (
            <Carte key={groupe.cle}>
              <EnTeteCarte
                titre={
                  <>
                    {groupe.sigle && <Sigle>{groupe.sigle}</Sigle>} {groupe.titre}
                  </>
                }
                description={`${groupe.membres.length} compte${groupe.membres.length > 1 ? "s" : ""}`}
              />
              <ul className="divide-y divide-white/5 px-2 pb-2">
                {groupe.membres.map((membre) => {
                  const soi = membre.id === profil.id;
                  return (
                    <li key={membre.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3.5 ${membre.actif ? "" : "opacity-55"}`}>
                      <Avatar texte={initiales(membre.prenom, membre.nom)} ton={membre.role === "agent" ? "sarcelle" : "or"} />
                      <div className="min-w-52 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[0.95rem] font-medium text-encre">
                          {membre.prenom} {membre.nom}
                          {soi && <span className="text-xs font-normal text-encre-3">(vous)</span>}
                          <Pastille ton={membre.role === "agent" ? "neutre" : "or"} point={false}>
                            {ROLES[membre.role]}
                          </Pastille>
                          {!membre.actif && <Pastille ton="critique">Désactivé</Pastille>}
                          {membre.actif && membre.doit_changer_mdp && <Pastille ton="attention">Jamais connecté</Pastille>}
                        </p>
                        <p className="mt-0.5 text-xs text-encre-3">
                          {membre.email}
                          {membre.fonction && ` · ${membre.fonction}`}
                          {membre.role === "agent" && ` · ${membre.permissions.length} fonction${membre.permissions.length > 1 ? "s" : ""} sur ${PERMISSIONS.length}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Modale bouton={<><Pencil size={14} /> Modifier</>} titre={`${membre.prenom} ${membre.nom}`} description={membre.email} large>
                          <FormulaireAction action={modifierUtilisateur.bind(null, membre.id)}>
                            <ChampsUtilisateur
                              creation={false}
                              rolesPossibles={membre.role === "gestionnaire" ? ["gestionnaire"] : ["agent", "admin_compagnie"]}
                              roleVerrouille={soi || membre.role === "gestionnaire"}
                              defaut={membre}
                            />
                          </FormulaireAction>
                        </Modale>
                        {!soi && (
                          <>
                            <Modale
                              bouton={<><KeyRound size={14} /> Mot de passe</>}
                              varianteBouton="fantome"
                              titre="Réinitialiser le mot de passe"
                              description={`${membre.prenom} ${membre.nom} — ${membre.email}`}
                            >
                              <FormulaireAction action={reinitialiserMotDePasse.bind(null, membre.id)} libelle="Générer un mot de passe provisoire">
                                <p className="text-sm leading-relaxed text-encre-2">
                                  Le mot de passe actuel cessera de fonctionner. Un mot de passe provisoire s'affichera ici, à
                                  transmettre à l'utilisateur, qui devra le remplacer à sa prochaine connexion.
                                </p>
                              </FormulaireAction>
                            </Modale>
                            <BoutonAction
                              action={activerUtilisateur.bind(null, membre.id, !membre.actif)}
                              variante="fantome"
                              confirmation={membre.actif ? `Désactiver le compte de ${membre.prenom} ${membre.nom} ? Il ne pourra plus se connecter.` : undefined}
                            >
                              {membre.actif ? "Désactiver" : "Réactiver"}
                            </BoutonAction>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          ))}
        </div>
      )}
    </>
  );
}
