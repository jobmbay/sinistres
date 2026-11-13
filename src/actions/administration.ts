"use server";

import { refresh } from "next/cache";
import { avecSession, ErreurMetier, succes, texte, texteOuNul, verifier } from "@/lib/actions";
import { clientAdmin } from "@/lib/supabase/admin";
import { controlerEmail, creerCompte, motDePasseProvisoire, permissionsValides } from "@/lib/comptes";
import type { EtatAction, Profil, Role } from "@/lib/types";

/* ================================================================== */
/*  COMPAGNIES (gestionnaire)                                          */
/* ================================================================== */

export async function creerCompagnie(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    if (profil.role !== "gestionnaire") throw new ErreurMetier("Seul le gestionnaire peut créer une compagnie.");

    const nom = texte(formulaire, "nom");
    const sigle = texte(formulaire, "sigle").toUpperCase();
    const adminPrenom = texte(formulaire, "admin_prenom");
    const adminNom = texte(formulaire, "admin_nom");
    const adminEmail = texte(formulaire, "admin_email").toLowerCase();
    if (!nom || !sigle) throw new ErreurMetier("Le nom et le sigle de la compagnie sont obligatoires.");
    if (!adminPrenom || !adminNom || !adminEmail) {
      throw new ErreurMetier("Renseignez le prénom, le nom et l'e-mail de l'administrateur de la compagnie.");
    }
    controlerEmail(adminEmail);

    const code = (texte(formulaire, "code") || sigle).toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const creation = await supabase
      .from("compagnies")
      .insert({
        nom,
        sigle,
        code,
        email: texteOuNul(formulaire, "email"),
        telephone: texteOuNul(formulaire, "telephone"),
        adresse: texteOuNul(formulaire, "adresse"),
        ville: texteOuNul(formulaire, "ville"),
        pays: texte(formulaire, "pays") || "Sénégal",
      })
      .select("id")
      .single();
    if (creation.error?.code === "23505") throw new ErreurMetier(`Le code « ${code} » est déjà utilisé par une autre compagnie.`);
    const compagnie = verifier(creation, "Création de la compagnie") as { id: string };

    try {
      const compte = await creerCompte({
        email: adminEmail,
        prenom: adminPrenom,
        nom: adminNom,
        role: "admin_compagnie",
        compagnieId: compagnie.id,
        fonction: "Administrateur",
      });
      refresh();
      return succes(`La compagnie ${nom} et son administrateur ont été créés.`, {
        email: adminEmail,
        mot_de_passe: compte.motDePasse,
      });
    } catch (erreur) {
      // Pas de compagnie sans administrateur : on annule la création.
      await supabase.from("compagnies").delete().eq("id", compagnie.id);
      throw erreur;
    }
  });
}

export async function modifierCompagnie(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    const estAdminDeCetteCompagnie = profil.role === "admin_compagnie" && profil.compagnie_id === id;
    if (profil.role !== "gestionnaire" && !estAdminDeCetteCompagnie) {
      throw new ErreurMetier("Vous ne pouvez pas modifier cette compagnie.");
    }
    const nom = texte(formulaire, "nom");
    const sigle = texte(formulaire, "sigle").toUpperCase();
    if (profil.role === "gestionnaire" && (!nom || !sigle)) {
      throw new ErreurMetier("Le nom et le sigle sont obligatoires.");
    }

    verifier(
      await supabase
        .from("compagnies")
        .update({
          // Seul le gestionnaire peut renommer une compagnie.
          ...(profil.role === "gestionnaire" ? { nom, sigle } : {}),
          email: texteOuNul(formulaire, "email"),
          telephone: texteOuNul(formulaire, "telephone"),
          adresse: texteOuNul(formulaire, "adresse"),
          ville: texteOuNul(formulaire, "ville"),
          pays: texte(formulaire, "pays") || "Sénégal",
        })
        .eq("id", id)
        .select("id")
        .single(),
      "Modification de la compagnie",
    );
    refresh();
    return succes("Les informations de la compagnie ont été enregistrées.");
  });
}

export async function activerCompagnie(id: string, actif: boolean): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    if (profil.role !== "gestionnaire") throw new ErreurMetier("Seul le gestionnaire peut activer ou suspendre une compagnie.");
    verifier(
      await supabase.from("compagnies").update({ actif }).eq("id", id).select("id").single(),
      "Mise à jour de la compagnie",
    );
    refresh();
  });
}

/* ================================================================== */
/*  UTILISATEURS                                                       */
/* ================================================================== */

/** Vérifie que l'appelant a autorité sur le compte visé, et le renvoie. */
async function exigerAutoriteSur(appelant: Profil, cibleId: string): Promise<Profil> {
  const { data: cible } = await clientAdmin().from("profils").select("*").eq("id", cibleId).maybeSingle<Profil>();
  if (!cible) throw new ErreurMetier("Utilisateur introuvable.");
  const autorise =
    appelant.role === "gestionnaire" ||
    (appelant.role === "admin_compagnie" && cible.compagnie_id === appelant.compagnie_id && cible.role !== "gestionnaire");
  if (!autorise) throw new ErreurMetier("Vous n'avez pas autorité sur ce compte.");
  return cible;
}

export async function creerUtilisateur(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ profil }) => {
    if (profil.role === "agent") throw new ErreurMetier("Vous ne pouvez pas créer de compte.");

    const prenom = texte(formulaire, "prenom");
    const nom = texte(formulaire, "nom");
    const email = texte(formulaire, "email").toLowerCase();
    const role = texte(formulaire, "role") as Role;
    if (!prenom || !nom || !email) throw new ErreurMetier("Le prénom, le nom et l'e-mail sont obligatoires.");
    controlerEmail(email);

    let compagnieId: string | null;
    if (profil.role === "gestionnaire") {
      if (!["gestionnaire", "admin_compagnie", "agent"].includes(role)) throw new ErreurMetier("Rôle invalide.");
      compagnieId = role === "gestionnaire" ? null : texteOuNul(formulaire, "compagnie_id");
      if (role !== "gestionnaire" && !compagnieId) throw new ErreurMetier("Choisissez la compagnie de cet utilisateur.");
    } else {
      // Un administrateur ne crée des comptes que dans sa propre compagnie.
      if (!["admin_compagnie", "agent"].includes(role)) throw new ErreurMetier("Rôle invalide.");
      compagnieId = profil.compagnie_id;
    }

    const compte = await creerCompte({
      email,
      prenom,
      nom,
      role,
      compagnieId,
      telephone: texteOuNul(formulaire, "telephone"),
      fonction: texteOuNul(formulaire, "fonction"),
      permissions: permissionsValides(formulaire.getAll("permissions")),
    });
    refresh();
    return succes(`Le compte de ${prenom} ${nom} a été créé.`, { email, mot_de_passe: compte.motDePasse });
  });
}

export async function modifierUtilisateur(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ profil }) => {
    const cible = await exigerAutoriteSur(profil, id);
    const prenom = texte(formulaire, "prenom");
    const nom = texte(formulaire, "nom");
    if (!prenom || !nom) throw new ErreurMetier("Le prénom et le nom sont obligatoires.");

    let role = cible.role;
    const roleDemande = texte(formulaire, "role") as Role;
    if (cible.role !== "gestionnaire" && ["admin_compagnie", "agent"].includes(roleDemande)) {
      if (id === profil.id && roleDemande !== cible.role) {
        throw new ErreurMetier("Vous ne pouvez pas modifier votre propre rôle.");
      }
      role = roleDemande;
    }

    const { error } = await clientAdmin()
      .from("profils")
      .update({
        prenom,
        nom,
        telephone: texteOuNul(formulaire, "telephone"),
        fonction: texteOuNul(formulaire, "fonction"),
        role,
        permissions: role === "agent" ? permissionsValides(formulaire.getAll("permissions")) : [],
      })
      .eq("id", id);
    if (error) throw new ErreurMetier("Le compte n'a pas pu être modifié.");
    refresh();
  });
}

export async function activerUtilisateur(id: string, actif: boolean): Promise<EtatAction> {
  return avecSession(null, async ({ profil }) => {
    if (id === profil.id) throw new ErreurMetier("Vous ne pouvez pas désactiver votre propre compte.");
    await exigerAutoriteSur(profil, id);
    const admin = clientAdmin();
    const { error } = await admin.from("profils").update({ actif }).eq("id", id);
    if (error) throw new ErreurMetier("Le compte n'a pas pu être mis à jour.");
    // Coupe aussi l'accès au niveau de l'authentification.
    await admin.auth.admin.updateUserById(id, { ban_duration: actif ? "none" : "876000h" });
    refresh();
  });
}

export async function reinitialiserMotDePasse(id: string): Promise<EtatAction> {
  return avecSession(null, async ({ profil }) => {
    const cible = await exigerAutoriteSur(profil, id);
    const admin = clientAdmin();
    const motDePasse = motDePasseProvisoire();
    const maj = await admin.auth.admin.updateUserById(id, { password: motDePasse });
    if (maj.error) throw new ErreurMetier("Le mot de passe n'a pas pu être réinitialisé.");
    await admin.from("profils").update({ doit_changer_mdp: true }).eq("id", id);
    return succes("Un nouveau mot de passe provisoire a été généré.", {
      email: cible.email,
      mot_de_passe: motDePasse,
    });
  });
}

/* ================================================================== */
/*  MON PROFIL                                                         */
/* ================================================================== */

export async function modifierMonProfil(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ profil }) => {
    const prenom = texte(formulaire, "prenom");
    const nom = texte(formulaire, "nom");
    if (!prenom || !nom) throw new ErreurMetier("Le prénom et le nom sont obligatoires.");
    const { error } = await clientAdmin()
      .from("profils")
      .update({ prenom, nom, telephone: texteOuNul(formulaire, "telephone"), fonction: texteOuNul(formulaire, "fonction") })
      .eq("id", profil.id);
    if (error) throw new ErreurMetier("Votre profil n'a pas pu être modifié.");
    refresh();
    return succes("Votre profil a été enregistré.");
  });
}

/* ================================================================== */
/*  RÉFÉRENTIEL (gestionnaire)                                         */
/* ================================================================== */

export async function ajouterBranche(_: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    if (profil.role !== "gestionnaire") throw new ErreurMetier("Réservé au gestionnaire.");
    const nom = texte(formulaire, "nom");
    const code = texte(formulaire, "code").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const famille = texte(formulaire, "famille");
    if (!nom || !code || !famille) throw new ErreurMetier("Le nom, le code et la famille sont obligatoires.");
    const creation = await supabase.from("branches").insert({ nom, code, famille, ordre: 500 }).select("id").single();
    if (creation.error?.code === "23505") throw new ErreurMetier(`Le code « ${code} » existe déjà.`);
    verifier(creation, "Création de la branche");
    refresh();
  });
}

export async function modifierBranche(id: string, _: EtatAction, formulaire: FormData): Promise<EtatAction> {
  return avecSession(null, async ({ supabase, profil }) => {
    if (profil.role !== "gestionnaire") throw new ErreurMetier("Réservé au gestionnaire.");
    const lignes = (valeur: string) =>
      valeur
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const pieces = lignes(texte(formulaire, "pieces_requises"));
    const types = lignes(texte(formulaire, "types"));

    verifier(
      await supabase
        .from("branches")
        .update({ pieces_requises: pieces, actif: formulaire.get("actif") === "on" })
        .eq("id", id)
        .select("id")
        .single(),
      "Modification de la branche",
    );

    // Types de sinistre : on ajoute les nouveaux et on retire ceux qui ont été effacés.
    const { data: existants } = await supabase.from("types_sinistre").select("id, nom").eq("branche_id", id);
    const noms = new Set((existants ?? []).map((t) => t.nom));
    const aAjouter = types.filter((t) => !noms.has(t));
    const aRetirer = (existants ?? []).filter((t) => !types.includes(t.nom)).map((t) => t.id);
    if (aAjouter.length > 0) {
      await supabase
        .from("types_sinistre")
        .insert(aAjouter.map((nom, i) => ({ branche_id: id, nom, ordre: 500 + i })));
    }
    if (aRetirer.length > 0) await supabase.from("types_sinistre").delete().in("id", aRetirer);
    refresh();
  });
}
