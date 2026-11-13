import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { exigerSession } from "@/lib/session";
import { FAMILLES, PERMISSIONS, ROLES } from "@/lib/referentiel";
import type { Branche, Compagnie, TypeSinistre } from "@/lib/types";
import { changerMotDePasse } from "@/actions/auth";
import { ajouterBranche, modifierBranche, modifierCompagnie, modifierMonProfil } from "@/actions/administration";
import { Carte, Champ, EnTeteCarte, EnTetePage, Pastille } from "@/components/ui";
import { FormulaireAction, Modale } from "@/components/interactif";

export const metadata: Metadata = { title: "Paramètres" };

export default async function PageParametres() {
  const { supabase, profil } = await exigerSession();
  const estGestionnaire = profil.role === "gestionnaire";
  const estAdmin = profil.role === "admin_compagnie";

  const [compagnieRes, branchesRes, typesRes] = await Promise.all([
    estAdmin && profil.compagnie_id
      ? supabase.from("compagnies").select("*").eq("id", profil.compagnie_id).maybeSingle()
      : Promise.resolve({ data: null }),
    estGestionnaire ? supabase.from("branches").select("*").order("ordre") : Promise.resolve({ data: null }),
    estGestionnaire ? supabase.from("types_sinistre").select("*").order("ordre") : Promise.resolve({ data: null }),
  ]);
  const compagnie = compagnieRes.data as Compagnie | null;
  const branches = (branchesRes.data ?? []) as Branche[];
  const types = (typesRes.data ?? []) as TypeSinistre[];

  return (
    <>
      <EnTetePage titre="Paramètres" description="Votre compte, votre mot de passe et les réglages auxquels votre rôle donne accès." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Carte>
          <EnTeteCarte titre="Mon profil" description={`${profil.email} · ${ROLES[profil.role]}${profil.compagnie ? ` · ${profil.compagnie.nom}` : ""}`} />
          <div className="px-5 pb-5">
            <FormulaireAction action={modifierMonProfil}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ libelle="Prénom" requis>
                  <input className="champ" name="prenom" required defaultValue={profil.prenom} />
                </Champ>
                <Champ libelle="Nom" requis>
                  <input className="champ" name="nom" required defaultValue={profil.nom} />
                </Champ>
                <Champ libelle="Téléphone">
                  <input className="champ" name="telephone" type="tel" defaultValue={profil.telephone ?? ""} />
                </Champ>
                <Champ libelle="Fonction">
                  <input className="champ" name="fonction" defaultValue={profil.fonction ?? ""} />
                </Champ>
              </div>
            </FormulaireAction>
          </div>
        </Carte>

        <Carte>
          <EnTeteCarte titre="Mot de passe" description="Au moins 10 caractères, avec des lettres et des chiffres." />
          <div className="px-5 pb-5">
            <FormulaireAction action={changerMotDePasse} libelle="Changer le mot de passe" variante="secondaire" reinitialiser>
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ libelle="Nouveau mot de passe">
                  <input className="champ" type="password" name="nouveau" autoComplete="new-password" minLength={10} required />
                </Champ>
                <Champ libelle="Confirmation">
                  <input className="champ" type="password" name="confirmation" autoComplete="new-password" minLength={10} required />
                </Champ>
              </div>
            </FormulaireAction>
          </div>
        </Carte>

        {profil.role === "agent" && (
          <Carte className="xl:col-span-2">
            <EnTeteCarte titre="Mes accès" description="Fonctions que l'administrateur de votre compagnie vous a ouvertes. Vous pouvez toujours consulter les dossiers." />
            <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              {PERMISSIONS.map((p) => {
                const ouverte = profil.permissions.includes(p.cle);
                return (
                  <li key={p.cle} className={`carte-plate flex items-start justify-between gap-3 px-3.5 py-3 ${ouverte ? "" : "opacity-50"}`}>
                    <span>
                      <span className="block text-sm text-encre">{p.libelle}</span>
                      <span className="block text-xs text-encre-3">{p.description}</span>
                    </span>
                    <Pastille ton={ouverte ? "bon" : "neutre"} point={false}>
                      {ouverte ? "Oui" : "Non"}
                    </Pastille>
                  </li>
                );
              })}
            </ul>
          </Carte>
        )}

        {compagnie && (
          <Carte className="xl:col-span-2">
            <EnTeteCarte titre="Ma compagnie" description="Coordonnées communiquées aux assurés dans leur espace de suivi." />
            <div className="px-5 pb-5">
              <FormulaireAction action={modifierCompagnie.bind(null, compagnie.id)}>
                <input type="hidden" name="nom" value={compagnie.nom} />
                <input type="hidden" name="sigle" value={compagnie.sigle} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Champ libelle="E-mail de contact">
                    <input className="champ" name="email" type="email" defaultValue={compagnie.email ?? ""} />
                  </Champ>
                  <Champ libelle="Téléphone">
                    <input className="champ" name="telephone" type="tel" defaultValue={compagnie.telephone ?? ""} />
                  </Champ>
                  <Champ libelle="Ville">
                    <input className="champ" name="ville" defaultValue={compagnie.ville ?? ""} />
                  </Champ>
                  <Champ libelle="Pays">
                    <input className="champ" name="pays" defaultValue={compagnie.pays} />
                  </Champ>
                  <Champ libelle="Adresse" className="sm:col-span-2 lg:col-span-4">
                    <input className="champ" name="adresse" defaultValue={compagnie.adresse ?? ""} />
                  </Champ>
                </div>
              </FormulaireAction>
            </div>
          </Carte>
        )}

        {estGestionnaire && (
          <Carte className="xl:col-span-2">
            <EnTeteCarte
              titre="Branches d'assurance"
              description="Pour chaque branche : les types de sinistre proposés à la déclaration et les pièces demandées d'office à l'assuré."
              action={
                <Modale bouton={<><Plus size={15} /> Ajouter une branche</>} titre="Nouvelle branche">
                  <FormulaireAction action={ajouterBranche} libelle="Ajouter">
                    <Champ libelle="Nom" requis>
                      <input className="champ" name="nom" required placeholder="Ex. Protection juridique" />
                    </Champ>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Champ libelle="Code" requis aide="Court et unique, en majuscules.">
                        <input className="champ uppercase" name="code" required maxLength={8} placeholder="PJ" />
                      </Champ>
                      <Champ libelle="Famille" requis aide="Sert au regroupement dans les graphiques.">
                        <select className="champ" name="famille" required defaultValue="">
                          <option value="" disabled>
                            Choisir…
                          </option>
                          {FAMILLES.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Champ>
                    </div>
                  </FormulaireAction>
                </Modale>
              }
            />
            <ul className="divide-y divide-white/5 px-2 pb-2">
              {branches.map((b) => {
                const typesDeBranche = types.filter((t) => t.branche_id === b.id);
                return (
                  <li key={b.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 ${b.actif ? "" : "opacity-55"}`}>
                    <span className="w-14 shrink-0 font-mono text-xs text-encre-3">{b.code}</span>
                    <span className="min-w-48 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-[0.95rem] text-encre">
                        {b.nom}
                        {!b.actif && <Pastille point={false}>Masquée</Pastille>}
                      </span>
                      <span className="block text-xs text-encre-3">
                        {b.famille} · {typesDeBranche.length} type{typesDeBranche.length > 1 ? "s" : ""} de sinistre · {b.pieces_requises.length} pièce
                        {b.pieces_requises.length > 1 ? "s" : ""} demandée{b.pieces_requises.length > 1 ? "s" : ""}
                      </span>
                    </span>
                    <Modale bouton="Configurer" titre={b.nom} description="Une ligne par élément." large>
                      <FormulaireAction action={modifierBranche.bind(null, b.id)}>
                        <Champ libelle="Types de sinistre" aide="Proposés à l'étape « Contrat » de la déclaration.">
                          <textarea className="champ" name="types" rows={6} defaultValue={typesDeBranche.map((t) => t.nom).join("\n")} />
                        </Champ>
                        <Champ libelle="Pièces demandées d'office" aide="Créées automatiquement comme « à fournir » à chaque nouveau dossier de cette branche.">
                          <textarea className="champ" name="pieces_requises" rows={6} defaultValue={b.pieces_requises.join("\n")} />
                        </Champ>
                        <label className="flex items-center gap-2.5 text-sm text-encre-2">
                          <input type="checkbox" name="actif" defaultChecked={b.actif} className="h-4 w-4 accent-[#dcb873]" />
                          Proposer cette branche à la déclaration
                        </label>
                      </FormulaireAction>
                    </Modale>
                  </li>
                );
              })}
            </ul>
          </Carte>
        )}
      </div>
    </>
  );
}
