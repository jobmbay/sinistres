import { redirect } from "next/navigation";

// Le proxy redirige déjà « / » selon la session ; ceci n'est qu'un filet de sécurité.
export default function Accueil() {
  redirect("/connexion");
}
