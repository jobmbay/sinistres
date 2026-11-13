"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X, LoaderCircle } from "lucide-react";
import { cx } from "@/components/ui";

type Option = { valeur: string; libelle: string };

/**
 * Barre de filtres de la liste : chaque changement met à jour l'URL,
 * ce qui permet de partager ou de retrouver une recherche.
 */
export function BarreFiltres({
  statuts,
  branches,
  compagnies,
}: {
  statuts: Option[];
  branches: Option[];
  compagnies?: Option[];
}) {
  const routeur = useRouter();
  const chemin = usePathname();
  const parametres = useSearchParams();
  const [enCours, demarrer] = useTransition();
  const [recherche, setRecherche] = useState(parametres.get("q") ?? "");
  const premierRendu = useRef(true);

  const appliquer = (cle: string, valeur: string) => {
    const suivants = new URLSearchParams(parametres.toString());
    if (valeur) suivants.set(cle, valeur);
    else suivants.delete(cle);
    suivants.delete("page");
    demarrer(() => routeur.replace(`${chemin}?${suivants.toString()}`, { scroll: false }));
  };

  // Recherche différée : on attend la fin de la frappe.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuterie = setTimeout(() => appliquer("q", recherche.trim()), 350);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const actifs = ["q", "statut", "branche", "compagnie", "adverse", "attente", "mien"].some((c) => parametres.get(c));

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">Rechercher un dossier</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-encre-3">
          {enCours ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
        </span>
        <input
          className="champ pl-9"
          type="search"
          placeholder="Numéro de dossier, assuré, police, tiers…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </label>

      <Selection libelle="Statut" valeur={parametres.get("statut") ?? ""} options={statuts} vide="Tous les statuts" onChange={(v) => appliquer("statut", v)} />
      <Selection libelle="Branche" valeur={parametres.get("branche") ?? ""} options={branches} vide="Toutes les branches" onChange={(v) => appliquer("branche", v)} />
      {compagnies && (
        <Selection
          libelle="Compagnie"
          valeur={parametres.get("compagnie") ?? ""}
          options={compagnies}
          vide="Toutes les compagnies"
          onChange={(v) => appliquer("compagnie", v)}
        />
      )}

      <button
        type="button"
        aria-pressed={parametres.get("mien") === "1"}
        onClick={() => appliquer("mien", parametres.get("mien") === "1" ? "" : "1")}
        className={cx(
          "h-11 cursor-pointer rounded-xl border px-3.5 text-sm transition",
          parametres.get("mien") === "1"
            ? "border-or/60 bg-or/10 text-or-clair"
            : "border-trait-fort bg-white/[0.03] text-encre-2 hover:border-white/25",
        )}
      >
        Mes dossiers
      </button>

      {actifs && (
        <button
          type="button"
          onClick={() => {
            setRecherche("");
            premierRendu.current = true;
            demarrer(() => routeur.replace(chemin, { scroll: false }));
          }}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm text-encre-3 transition hover:bg-white/[0.06] hover:text-encre"
        >
          <X size={15} /> Réinitialiser
        </button>
      )}
    </div>
  );
}

function Selection({
  libelle,
  valeur,
  options,
  vide,
  onChange,
}: {
  libelle: string;
  valeur: string;
  options: Option[];
  vide: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{libelle}</span>
      <select className={cx("champ w-auto min-w-44", valeur && "!border-or/60 text-or-clair")} value={valeur} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vide}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}
