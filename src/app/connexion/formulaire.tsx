"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { connexion } from "@/actions/auth";
import { Alerte, Bouton, Champ } from "@/components/ui";

export function FormulaireConnexion() {
  const [etat, envoyer, enCours] = useActionState(connexion, null);
  const [, demarrer] = useTransition();
  const [visible, setVisible] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(evenement) => {
        // Envoi manuel : l'adresse saisie est conservée si le mot de passe est refusé.
        evenement.preventDefault();
        const donnees = new FormData(evenement.currentTarget);
        demarrer(() => envoyer(donnees));
      }}
    >
      <Champ libelle="Adresse e-mail">
        <input className="champ" type="email" name="email" autoComplete="username" placeholder="vous@compagnie.sn" required autoFocus />
      </Champ>
      <Champ libelle="Mot de passe">
        <span className="relative block">
          <input
            className="champ pr-11"
            type={visible ? "text" : "password"}
            name="mot_de_passe"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-1 my-auto grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-encre-3 hover:text-encre"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </Champ>
      {etat && !etat.ok && <Alerte>{etat.message}</Alerte>}
      <Bouton type="submit" variante="primaire" className="w-full" disabled={enCours}>
        {enCours && <LoaderCircle size={16} className="animate-spin" />}
        {enCours ? "Connexion…" : "Se connecter"}
      </Bouton>
      <p className="pt-1 text-center text-xs text-encre-3">
        Mot de passe oublié ? Demandez à votre administrateur de le réinitialiser.
      </p>
    </form>
  );
}
