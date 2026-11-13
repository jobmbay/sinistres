// Crée un compte « gestionnaire » (opérateur de la plateforme).
//
//   npm run compte:gestionnaire -- vous@exemple.com Prénom Nom
//
// Un mot de passe provisoire est affiché une seule fois ; il devra être
// remplacé à la première connexion.

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const [email, prenom, ...resteNom] = process.argv.slice(2);
const nom = resteNom.join(" ");
if (!email || !prenom || !nom || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error("Usage : npm run compte:gestionnaire -- vous@exemple.com Prénom Nom");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SECRET_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY manquant dans .env.");
  process.exit(1);
}
const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

const tirer = (source, n) => Array.from({ length: n }, () => source[randomInt(source.length)]).join("");
const lettres = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const motDePasse = `${tirer(lettres, 4)}-${tirer("23456789", 4)}-${tirer(lettres, 4)}`;

const creation = await supabase.auth.admin.createUser({ email: email.toLowerCase(), password: motDePasse, email_confirm: true });
if (creation.error) {
  console.error(`Création impossible : ${creation.error.message}`);
  process.exit(1);
}

const { error } = await supabase.from("profils").insert({
  id: creation.data.user.id,
  role: "gestionnaire",
  prenom,
  nom,
  email: email.toLowerCase(),
  fonction: "Gestionnaire de la plateforme",
  doit_changer_mdp: true,
});
if (error) {
  await supabase.auth.admin.deleteUser(creation.data.user.id);
  console.error(`Création du profil impossible : ${error.message}`);
  process.exit(1);
}

console.log(`\nCompte gestionnaire créé pour ${prenom} ${nom}.`);
console.log(`  Identifiant            : ${email.toLowerCase()}`);
console.log(`  Mot de passe provisoire : ${motDePasse}`);
console.log("  À remplacer à la première connexion.\n");
