import "server-only";
import { randomInt } from "node:crypto";
import { clientAdmin } from "./supabase/admin";
import { ErreurMetier } from "./actions";
import { PERMISSIONS } from "./referentiel";
import type { Role } from "./types";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const CHIFFRES = "23456789";

/** Mot de passe provisoire lisible (sans caractères ambigus), à changer à la première connexion. */
export function motDePasseProvisoire(): string {
  const tirer = (source: string, n: number) =>
    Array.from({ length: n }, () => source[randomInt(source.length)]).join("");
  return `${tirer(ALPHABET, 4)}-${tirer(CHIFFRES, 4)}-${tirer(ALPHABET, 4)}`;
}

export function permissionsValides(valeurs: FormDataEntryValue[]): string[] {
  const connues = new Set<string>(PERMISSIONS.map((p) => p.cle));
  return [...new Set(valeurs.map(String).filter((v) => connues.has(v)))];
}

export function controlerEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ErreurMetier("L'adresse e-mail est invalide.");
}

/**
 * Crée le compte d'authentification et son profil.
 * Réservé au serveur : les droits de l'appelant doivent avoir été vérifiés.
 */
export async function creerCompte(compte: {
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  compagnieId: string | null;
  telephone?: string | null;
  fonction?: string | null;
  permissions?: string[];
}): Promise<{ id: string; motDePasse: string }> {
  const admin = clientAdmin();
  const motDePasse = motDePasseProvisoire();

  const creation = await admin.auth.admin.createUser({
    email: compte.email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { prenom: compte.prenom, nom: compte.nom },
  });
  if (creation.error || !creation.data.user) {
    const dejaPris = creation.error?.code === "email_exists" || /already/i.test(creation.error?.message ?? "");
    throw new ErreurMetier(
      dejaPris ? "Un compte existe déjà avec cette adresse e-mail." : "Le compte n'a pas pu être créé.",
    );
  }

  const id = creation.data.user.id;
  const { error } = await admin.from("profils").insert({
    id,
    role: compte.role,
    compagnie_id: compte.compagnieId,
    prenom: compte.prenom,
    nom: compte.nom,
    email: compte.email,
    telephone: compte.telephone ?? null,
    fonction: compte.fonction ?? null,
    permissions: compte.role === "agent" ? (compte.permissions ?? []) : [],
    doit_changer_mdp: true,
  });
  if (error) {
    await admin.auth.admin.deleteUser(id);
    console.error("[comptes]", error.message);
    throw new ErreurMetier("Le profil n'a pas pu être créé.");
  }
  return { id, motDePasse };
}
