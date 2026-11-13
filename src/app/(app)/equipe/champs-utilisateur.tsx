"use client";

import { useState } from "react";
import { PERMISSIONS, ROLES } from "@/lib/referentiel";
import type { Role } from "@/lib/types";
import { Champ, cx } from "@/components/ui";

const GROUPES = [...new Set(PERMISSIONS.map((p) => p.groupe))];

/**
 * Champs d'un compte utilisateur : identité, rôle et — pour un agent —
 * les fonctions de gestion des sinistres qui lui sont ouvertes.
 */
export function ChampsUtilisateur({
  rolesPossibles,
  compagnies,
  defaut,
  creation,
  roleVerrouille = false,
}: {
  rolesPossibles: Role[];
  /** Liste proposée au gestionnaire ; absente pour un administrateur de compagnie. */
  compagnies?: { id: string; nom: string; sigle: string }[];
  defaut?: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
    fonction: string | null;
    role: Role;
    permissions: string[];
    compagnie_id: string | null;
  };
  creation: boolean;
  roleVerrouille?: boolean;
}) {
  const [role, setRole] = useState<Role>(defaut?.role ?? (rolesPossibles.includes("agent") ? "agent" : rolesPossibles[0]));
  const [cochees, setCochees] = useState<Set<string>>(new Set(defaut?.permissions ?? ["documents.gerer", "communication.gerer"]));

  const basculer = (cle: string) =>
    setCochees((actuelles) => {
      const suivantes = new Set(actuelles);
      if (suivantes.has(cle)) suivantes.delete(cle);
      else suivantes.add(cle);
      return suivantes;
    });
  const toutes = cochees.size === PERMISSIONS.length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ libelle="Prénom" requis>
          <input className="champ" name="prenom" required defaultValue={defaut?.prenom} autoComplete="off" />
        </Champ>
        <Champ libelle="Nom" requis>
          <input className="champ" name="nom" required defaultValue={defaut?.nom} autoComplete="off" />
        </Champ>
        <Champ libelle="Adresse e-mail" requis={creation} aide={creation ? "Elle servira d'identifiant de connexion." : "L'identifiant ne peut pas être modifié."}>
          <input className="champ" name="email" type="email" required={creation} disabled={!creation} defaultValue={defaut?.email} autoComplete="off" />
        </Champ>
        <Champ libelle="Téléphone">
          <input className="champ" name="telephone" type="tel" defaultValue={defaut?.telephone ?? ""} autoComplete="off" />
        </Champ>
        <Champ libelle="Fonction">
          <input className="champ" name="fonction" defaultValue={defaut?.fonction ?? ""} placeholder="Ex. Rédacteur sinistres" />
        </Champ>
        <Champ libelle="Rôle" requis>
          <select className="champ" name="role" value={role} disabled={roleVerrouille} onChange={(e) => setRole(e.target.value as Role)}>
            {rolesPossibles.map((r) => (
              <option key={r} value={r}>
                {r === "gestionnaire" ? "Gestionnaire de la plateforme" : r === "admin_compagnie" ? "Administrateur de la compagnie" : ROLES[r]}
              </option>
            ))}
          </select>
        </Champ>
        {creation && compagnies && role !== "gestionnaire" && (
          <Champ libelle="Compagnie" requis className="sm:col-span-2">
            <select className="champ" name="compagnie_id" required defaultValue={defaut?.compagnie_id ?? ""}>
              <option value="">Choisir une compagnie…</option>
              {compagnies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigle} — {c.nom}
                </option>
              ))}
            </select>
          </Champ>
        )}
      </div>

      {role === "agent" ? (
        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-sm font-medium text-encre">
              Fonctions accessibles
              <span className="ml-2 font-normal text-encre-3">
                {cochees.size} sur {PERMISSIONS.length}
              </span>
            </legend>
            <button
              type="button"
              onClick={() => setCochees(toutes ? new Set() : new Set(PERMISSIONS.map((p) => p.cle)))}
              className="cursor-pointer text-xs text-or-clair hover:underline"
            >
              {toutes ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          <p className="mb-3 text-xs text-encre-3">Tous les agents peuvent consulter les dossiers de leur compagnie. Cochez ce qu'il peut faire en plus.</p>
          <div className="space-y-3">
            {GROUPES.map((groupe) => (
              <div key={groupe}>
                <p className="surtitre mb-1.5">{groupe}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PERMISSIONS.filter((p) => p.groupe === groupe).map((p) => {
                    const cochee = cochees.has(p.cle);
                    return (
                      <label
                        key={p.cle}
                        className={cx(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition",
                          cochee ? "border-or/50 bg-or/[0.08]" : "border-trait-fort bg-black/20 hover:border-white/25",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={p.cle}
                          checked={cochee}
                          onChange={() => basculer(p.cle)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#dcb873]"
                        />
                        <span>
                          <span className="block text-sm text-encre">{p.libelle}</span>
                          <span className="block text-xs leading-snug text-encre-3">{p.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="carte-plate px-4 py-3 text-sm text-encre-2">
          {role === "gestionnaire"
            ? "Un gestionnaire de la plateforme accède à tous les dossiers de toutes les compagnies et administre les compagnies."
            : "Un administrateur a accès à toutes les fonctions pour sa compagnie et gère les comptes de ses agents."}
        </p>
      )}
    </>
  );
}
