import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { clientServeur } from "./supabase/serveur";
import { peut, type Permission } from "./referentiel";
import type { CompagnieResume, Profil, Role } from "./types";

/**
 * Couche d'accès à la session : point unique où l'on lit l'utilisateur
 * connecté et son profil (rôle, compagnie, permissions).
 * Mémorisée le temps d'une requête.
 */
export const lireSession = cache(async () => {
  // La session se lit toujours sur une vraie requête, jamais lors d'un
  // prérendu ou d'un préchargement : sa validité dépend de l'heure courante.
  await connection();
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  const identifiant = data?.claims?.sub;
  if (!identifiant) return null;

  const { data: profil } = await supabase
    .from("profils")
    .select("*, compagnie:compagnies(id, nom, sigle, actif)")
    .eq("id", identifiant)
    .maybeSingle<Profil & { compagnie: (CompagnieResume & { actif: boolean }) | null }>();

  // Compte désactivé, ou compagnie suspendue par le gestionnaire : pas d'accès.
  if (!profil || !profil.actif) return null;
  if (profil.compagnie && !profil.compagnie.actif) return null;
  return { supabase, profil };
});

/** Exige un utilisateur connecté et actif ; sinon renvoie à la connexion. */
export async function exigerSession(options?: { accepterMotDePasseProvisoire?: boolean }) {
  const session = await lireSession();
  // « /deconnexion » ferme la session éventuelle avant de renvoyer à la connexion :
  // sans cela, un compte désactivé mais encore authentifié tournerait en boucle.
  if (!session) redirect("/deconnexion");
  if (session.profil.doit_changer_mdp && !options?.accepterMotDePasseProvisoire) redirect("/bienvenue");
  return session;
}

/** Exige l'un des rôles donnés ; sinon renvoie au tableau de bord. */
export async function exigerRole(...roles: Role[]) {
  const session = await exigerSession();
  if (!roles.includes(session.profil.role)) redirect("/tableau-de-bord");
  return session;
}

/** Exige au moins une des permissions ; sinon renvoie au tableau de bord. */
export async function exigerPermission(...permissions: Permission[]) {
  const session = await exigerSession();
  if (!peut(session.profil, ...permissions)) redirect("/tableau-de-bord");
  return session;
}

export function nomComplet(profil: Pick<Profil, "prenom" | "nom">) {
  return `${profil.prenom} ${profil.nom}`.trim();
}
