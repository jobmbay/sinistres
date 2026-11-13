"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, LoaderCircle } from "lucide-react";
import type { EtatAction } from "@/lib/types";
import { Alerte, Bouton, cx } from "./ui";

/* ------------------------------------------------------------------ */
/*  Modale                                                             */
/* ------------------------------------------------------------------ */

const ContexteModale = createContext<{ fermer: () => void } | null>(null);

export function Modale({
  bouton,
  varianteBouton = "secondaire",
  tailleBouton = "sm",
  classeBouton,
  titre,
  description,
  children,
  large = false,
}: {
  /** Contenu du bouton qui ouvre la modale. */
  bouton: ReactNode;
  varianteBouton?: "primaire" | "secondaire" | "fantome" | "danger";
  tailleBouton?: "sm" | "md";
  classeBouton?: string;
  titre: string;
  description?: string;
  children: ReactNode;
  large?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  const idTitre = useId();
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuverte(false);
    document.addEventListener("keydown", surTouche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panneau.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = defilement;
    };
  }, [ouverte]);

  return (
    <>
      <Bouton type="button" variante={varianteBouton} taille={tailleBouton} className={classeBouton} onClick={() => setOuverte(true)}>
        {bouton}
      </Bouton>
      {ouverte &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOuverte(false)}
              aria-hidden
            />
            <div
              ref={panneau}
              role="dialog"
              aria-modal="true"
              aria-labelledby={idTitre}
              className={cx(
                "carte animate-apparition relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-[18px]",
                large ? "sm:max-w-2xl" : "sm:max-w-lg",
              )}
              style={{ background: "linear-gradient(150deg, #173b37 0%, #0b1d1c 45%, #071312 100%)" }}
            >
              <header className="flex items-start justify-between gap-4 border-b border-trait px-6 py-4">
                <div>
                  <h2 id={idTitre} className="text-lg font-medium text-encre">
                    {titre}
                  </h2>
                  {description && <p className="mt-0.5 text-sm text-encre-3">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setOuverte(false)}
                  aria-label="Fermer"
                  className="-mr-2 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-encre-3 transition hover:bg-white/10 hover:text-encre"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="overflow-y-auto px-6 py-5">
                <ContexteModale value={{ fermer: () => setOuverte(false) }}>{children}</ContexteModale>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Formulaire relié à une action serveur                              */
/* ------------------------------------------------------------------ */

type ActionFormulaire = (precedent: EtatAction, formulaire: FormData) => Promise<EtatAction>;

export function FormulaireAction({
  action,
  children,
  libelle = "Enregistrer",
  libelleEnCours = "Enregistrement…",
  className,
  variante = "primaire",
  messageSucces,
  garderOuvert = false,
  reinitialiser = false,
  pied,
}: {
  action: ActionFormulaire;
  children: ReactNode;
  libelle?: string;
  libelleEnCours?: string;
  className?: string;
  variante?: "primaire" | "secondaire" | "danger";
  /** Affiché sous le formulaire après un succès (hors modale). */
  messageSucces?: string;
  /** Ne pas fermer la modale après un succès. */
  garderOuvert?: boolean;
  /** Vider le formulaire après un succès. */
  reinitialiser?: boolean;
  /** Contenu supplémentaire à gauche du bouton. */
  pied?: ReactNode;
}) {
  const [etat, envoyer, enCours] = useActionState(action, null);
  const [, demarrer] = useTransition();
  const modale = useContext(ContexteModale);
  const formulaire = useRef<HTMLFormElement>(null);

  // Envoi manuel plutôt que <form action> : React viderait sinon tous les champs
  // à chaque réponse du serveur, y compris quand celui-ci signale une erreur.
  const soumettre = (evenement: React.FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    // Une modale ouverte depuis ce formulaire est rendue ailleurs dans la page, mais ses
    // événements remontent ici par l'arbre React : on ignore les envois d'un autre formulaire.
    evenement.stopPropagation();
    if (evenement.target !== evenement.currentTarget) return;
    const donnees = new FormData(evenement.currentTarget);
    demarrer(() => envoyer(donnees));
  };

  useEffect(() => {
    if (!etat?.ok) return;
    if (reinitialiser) formulaire.current?.reset();
    if (!garderOuvert && !etat.donnees?.mot_de_passe) modale?.fermer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  // Création de compte ou réinitialisation : on montre une fois les identifiants à transmettre.
  if (etat?.ok && etat.donnees?.mot_de_passe) {
    const identifiants = `Adresse e-mail : ${etat.donnees.email}\nMot de passe provisoire : ${etat.donnees.mot_de_passe}`;
    return (
      <div className="space-y-4">
        <Alerte ton="bon">{etat.message}</Alerte>
        <div className="carte-plate space-y-2.5 px-4 py-4">
          <p className="surtitre">Identifiants à transmettre</p>
          <p className="text-sm text-encre-2">
            E-mail <span className="ml-2 font-mono text-encre">{etat.donnees.email}</span>
          </p>
          <p className="text-sm text-encre-2">
            Mot de passe provisoire <span className="ml-2 font-mono text-base text-or-clair">{etat.donnees.mot_de_passe}</span>
          </p>
        </div>
        <p className="text-xs leading-relaxed text-encre-3">
          Ce mot de passe ne sera plus affiché. L'utilisateur devra le remplacer à sa première connexion.
        </p>
        <div className="flex justify-end gap-2">
          <BoutonCopier texte={identifiants}>Copier les identifiants</BoutonCopier>
          {modale && (
            <Bouton type="button" variante="primaire" taille="sm" onClick={modale.fermer}>
              Terminé
            </Bouton>
          )}
        </div>
      </div>
    );
  }

  return (
    <form ref={formulaire} onSubmit={soumettre} className={cx("space-y-4", className)}>
      {children}
      {etat && !etat.ok && etat.message && <Alerte>{etat.message}</Alerte>}
      {etat?.ok && (messageSucces || etat.message) && <Alerte ton="bon">{etat.message ?? messageSucces}</Alerte>}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {pied && <div className="mr-auto">{pied}</div>}
        {modale && (
          <Bouton type="button" variante="fantome" onClick={modale.fermer}>
            Annuler
          </Bouton>
        )}
        <Bouton type="submit" variante={variante} disabled={enCours}>
          {enCours && <LoaderCircle size={16} className="animate-spin" />}
          {enCours ? libelleEnCours : libelle}
        </Bouton>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Bouton relié à une action serveur (sans formulaire)                */
/* ------------------------------------------------------------------ */

export function BoutonAction({
  action,
  children,
  variante = "secondaire",
  taille = "sm",
  confirmation,
  className,
  titre,
}: {
  action: () => Promise<EtatAction>;
  children: ReactNode;
  variante?: "primaire" | "secondaire" | "fantome" | "danger";
  taille?: "sm" | "md";
  /** Question posée avant d'exécuter l'action. */
  confirmation?: string;
  className?: string;
  titre?: string;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Bouton
        type="button"
        variante={variante}
        taille={taille}
        className={className}
        title={titre}
        disabled={enCours}
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) return;
          setErreur(null);
          demarrer(async () => {
            const resultat = await action();
            if (resultat && !resultat.ok) setErreur(resultat.message ?? "Action impossible.");
          });
        }}
      >
        {enCours && <LoaderCircle size={14} className="animate-spin" />}
        {children}
      </Bouton>
      {erreur && (
        <span role="alert" className="max-w-56 text-right text-xs text-[#ffb3b1]">
          {erreur}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglets (l'onglet actif est conservé dans l'URL : #onglet)         */
/* ------------------------------------------------------------------ */

export function Onglets({
  onglets,
}: {
  onglets: { cle: string; libelle: string; compteur?: number; alerte?: boolean; contenu: ReactNode }[];
}) {
  const [actif, setActif] = useState(onglets[0]?.cle);

  useEffect(() => {
    const lire = () => {
      const cle = window.location.hash.slice(1);
      if (onglets.some((o) => o.cle === cle)) setActif(cle);
    };
    lire();
    window.addEventListener("hashchange", lire);
    return () => window.removeEventListener("hashchange", lire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choisir = (cle: string) => {
    setActif(cle);
    window.history.replaceState(null, "", `#${cle}`);
  };

  return (
    <div>
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-trait pb-px">
        {onglets.map((o) => (
          <button
            key={o.cle}
            role="tab"
            type="button"
            aria-selected={actif === o.cle}
            onClick={() => choisir(o.cle)}
            className={cx(
              "relative flex shrink-0 cursor-pointer items-center gap-2 px-3.5 py-2.5 text-[0.92rem] transition",
              actif === o.cle ? "text-encre" : "text-encre-3 hover:text-encre-2",
            )}
          >
            {o.libelle}
            {o.compteur !== undefined && o.compteur > 0 && (
              <span
                className={cx(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.68rem] font-medium",
                  o.alerte ? "bg-or/20 text-or-clair" : "bg-white/10 text-encre-2",
                )}
              >
                {o.compteur}
              </span>
            )}
            {actif === o.cle && (
              <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-or to-or-clair" />
            )}
          </button>
        ))}
      </div>
      {onglets.map((o) => (
        <div key={o.cle} role="tabpanel" hidden={actif !== o.cle} className={actif === o.cle ? "animate-apparition" : undefined}>
          {o.contenu}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Copier dans le presse-papiers                                      */
/* ------------------------------------------------------------------ */

export function BoutonCopier({ texte, children, className }: { texte: string; children: ReactNode; className?: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <Bouton
      type="button"
      taille="sm"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(texte);
        setCopie(true);
        setTimeout(() => setCopie(false), 1800);
      }}
    >
      {copie ? "Copié ✓" : children}
    </Bouton>
  );
}

/* ------------------------------------------------------------------ */
/*  Saisie d'un montant en FCFA (séparateur de milliers automatique)   */
/* ------------------------------------------------------------------ */

export function ChampMontant({
  name,
  defaut,
  requis,
  placeholder = "0",
}: {
  name: string;
  defaut?: number | null;
  requis?: boolean;
  placeholder?: string;
}) {
  const formater = (brut: string) => {
    const chiffres = brut.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };
  const [valeur, setValeur] = useState(defaut ? formater(String(Math.round(defaut))) : "");
  return (
    <span className="relative block">
      <input
        className="champ pr-16 text-right tabular-nums"
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        required={requis}
        value={valeur}
        onChange={(e) => setValeur(formater(e.target.value))}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-xs text-encre-3">FCFA</span>
    </span>
  );
}
