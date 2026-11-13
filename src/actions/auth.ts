"use server";

import { redirect } from "next/navigation";
import { clientServeur } from "@/lib/supabase/serveur";
import { clientAdmin } from "@/lib/supabase/admin";
import { lireSession } from "@/lib/session";
import { echec, succes, texte } from "@/lib/actions";
import type { EtatAction } from "@/lib/types";

export async function connexion(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  const email = texte(formulaire, "email").toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");
  if (!email || !motDePasse) return echec("Saisissez votre adresse e-mail et votre mot de passe.");

  const supabase = await clientServeur();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error || !data.user) return echec("Adresse e-mail ou mot de passe incorrect.");

  const { data: profil } = await supabase
    .from("profils")
    .select("actif, doit_changer_mdp")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profil?.actif) {
    await supabase.auth.signOut();
    return echec("Ce compte est désactivé. Contactez votre administrateur.");
  }
  redirect(profil.doit_changer_mdp ? "/bienvenue" : "/tableau-de-bord");
}

export async function deconnexion() {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}

function controlerMotDePasse(nouveau: string, confirmation: string): string | null {
  if (nouveau.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (!/[a-zA-Z]/.test(nouveau) || !/\d/.test(nouveau)) return "Le mot de passe doit contenir des lettres et des chiffres.";
  if (nouveau !== confirmation) return "Les deux mots de passe ne sont pas identiques.";
  return null;
}

/** Changement de mot de passe (première connexion ou depuis Paramètres). */
export async function changerMotDePasse(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  const session = await lireSession();
  if (!session) return echec("Votre session a expiré. Reconnectez-vous.");

  const nouveau = String(formulaire.get("nouveau") ?? "");
  const erreur = controlerMotDePasse(nouveau, String(formulaire.get("confirmation") ?? ""));
  if (erreur) return echec(erreur);

  const { error } = await session.supabase.auth.updateUser({ password: nouveau });
  if (error) {
    return echec(
      error.code === "same_password"
        ? "Choisissez un mot de passe différent du mot de passe actuel."
        : "Le mot de passe n'a pas pu être modifié.",
    );
  }

  const etaitProvisoire = session.profil.doit_changer_mdp;
  if (etaitProvisoire) {
    await clientAdmin().from("profils").update({ doit_changer_mdp: false }).eq("id", session.profil.id);
    redirect("/tableau-de-bord");
  }
  return succes("Votre mot de passe a été modifié.");
}
