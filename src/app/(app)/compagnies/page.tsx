import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, Plus } from "lucide-react";
import { exigerRole } from "@/lib/session";
import { abrege, entier } from "@/lib/format";
import type { Compagnie, Statistiques } from "@/lib/types";
import { creerCompagnie } from "@/actions/administration";
import { Carte, Champ, EnTetePage, Pastille, Vide } from "@/components/ui";
import { FormulaireAction, Modale } from "@/components/interactif";
import { Sigle } from "@/components/metier";

export const metadata: Metadata = { title: "Compagnies" };

export default async function PageCompagnies() {
  const { supabase } = await exigerRole("gestionnaire");

  const [compagniesRes, statsRes, profilsRes] = await Promise.all([
    supabase.from("compagnies").select("*").order("actif", { ascending: false }).order("nom"),
    supabase.rpc("statistiques"),
    supabase.from("profils").select("compagnie_id").not("compagnie_id", "is", null).eq("actif", true),
  ]);
  const compagnies = (compagniesRes.data ?? []) as Compagnie[];
  const stats = statsRes.data as Statistiques | null;
  const parCompagnie = new Map(stats?.par_compagnie.map((c) => [c.compagnie_id, c]));
  const comptes = new Map<string, number>();
  for (const p of profilsRes.data ?? []) comptes.set(p.compagnie_id, (comptes.get(p.compagnie_id) ?? 0) + 1);

  return (
    <>
      <EnTetePage
        titre="Compagnies"
        description="Créez les compagnies d'assurance et leur accès administrateur. Chaque administrateur crée ensuite ses propres agents."
        actions={
          <Modale
            bouton={<><Plus size={17} /> Nouvelle compagnie</>}
            varianteBouton="primaire"
            tailleBouton="md"
            titre="Nouvelle compagnie"
            description="La compagnie est créée avec son premier administrateur."
            large
          >
            <FormulaireAction action={creerCompagnie} libelle="Créer la compagnie" libelleEnCours="Création…">
              <p className="surtitre">La compagnie</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Champ libelle="Nom" requis className="sm:col-span-2">
                  <input className="champ" name="nom" required placeholder="Ex. Teranga Assurances" />
                </Champ>
                <Champ libelle="Sigle" requis>
                  <input className="champ uppercase" name="sigle" required maxLength={10} placeholder="TERANGA" />
                </Champ>
                <Champ libelle="E-mail de contact">
                  <input className="champ" name="email" type="email" />
                </Champ>
                <Champ libelle="Téléphone">
                  <input className="champ" name="telephone" type="tel" />
                </Champ>
                <Champ libelle="Ville">
                  <input className="champ" name="ville" placeholder="Dakar" />
                </Champ>
                <Champ libelle="Adresse" className="sm:col-span-2">
                  <input className="champ" name="adresse" />
                </Champ>
                <Champ libelle="Pays">
                  <input className="champ" name="pays" defaultValue="Sénégal" />
                </Champ>
              </div>
              <p className="surtitre pt-2">Son administrateur</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ libelle="Prénom" requis>
                  <input className="champ" name="admin_prenom" required autoComplete="off" />
                </Champ>
                <Champ libelle="Nom" requis>
                  <input className="champ" name="admin_nom" required autoComplete="off" />
                </Champ>
                <Champ libelle="Adresse e-mail" requis className="sm:col-span-2" aide="Elle servira d'identifiant. Un mot de passe provisoire vous sera affiché, à lui transmettre.">
                  <input className="champ" name="admin_email" type="email" required autoComplete="off" />
                </Champ>
              </div>
            </FormulaireAction>
          </Modale>
        }
      />

      {compagnies.length === 0 ? (
        <Carte>
          <Vide
            icone={<Building2 size={22} />}
            titre="Aucune compagnie"
            description="Créez une première compagnie d'assurance pour commencer à gérer ses sinistres."
          />
        </Carte>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {compagnies.map((c) => {
            const s = parCompagnie.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/compagnies/${c.id}`} className={`carte block h-full p-5 transition hover:border-white/20 ${c.actif ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Sigle>{c.sigle}</Sigle>
                      <h2 className="mt-2.5 truncate text-lg font-medium text-encre">{c.nom}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-encre-3">
                        <MapPin size={13} /> {[c.ville, c.pays].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    {!c.actif && <Pastille ton="critique">Suspendue</Pastille>}
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-trait pt-4">
                    {[
                      ["Dossiers", entier(s?.n ?? 0)],
                      ["En cours", entier(s?.ouverts ?? 0)],
                      ["Comptes", entier(comptes.get(c.id) ?? 0)],
                    ].map(([libelle, valeur]) => (
                      <div key={libelle}>
                        <dt className="text-xs text-encre-3">{libelle}</dt>
                        <dd className="mt-0.5 text-xl font-light text-encre">{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-encre-3">
                    {abrege(s?.provisions ?? 0)} FCFA de provisions · {abrege(s?.regle ?? 0)} FCFA réglés
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
