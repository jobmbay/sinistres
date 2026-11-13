import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { exigerSession } from "@/lib/session";
import { changerMotDePasse } from "@/actions/auth";
import { Logo } from "@/components/logo";
import { Champ } from "@/components/ui";
import { FormulaireAction } from "@/components/interactif";

export const metadata: Metadata = { title: "Bienvenue" };

export default function PageBienvenue() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Logo className="mb-10" />
        <div className="carte p-7 sm:p-9">
          <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-white/[0.04]" />}>
            <Contenu />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Contenu() {
  const { profil } = await exigerSession({ accepterMotDePasseProvisoire: true });
  if (!profil.doit_changer_mdp) redirect("/tableau-de-bord");

  return (
    <>
      <h1 className="text-2xl font-normal tracking-tight text-encre">Bienvenue, {profil.prenom}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-encre-3">
        Votre compte a été créé avec un mot de passe provisoire. Choisissez maintenant votre mot de passe personnel
        pour accéder à la plateforme.
      </p>
      <div className="mt-7">
        <FormulaireAction action={changerMotDePasse} libelle="Enregistrer et continuer">
          <Champ libelle="Nouveau mot de passe" aide="Au moins 10 caractères, avec des lettres et des chiffres.">
            <input className="champ" type="password" name="nouveau" autoComplete="new-password" minLength={10} required />
          </Champ>
          <Champ libelle="Confirmer le mot de passe">
            <input className="champ" type="password" name="confirmation" autoComplete="new-password" minLength={10} required />
          </Champ>
        </FormulaireAction>
      </div>
    </>
  );
}
