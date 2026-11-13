import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, HandCoins, Landmark, Timer, Users } from "lucide-react";
import { exigerRole } from "@/lib/session";
import { ROLES } from "@/lib/referentiel";
import { abrege, entier, initiales } from "@/lib/format";
import type { Compagnie, Profil, Statistiques } from "@/lib/types";
import { activerCompagnie, modifierCompagnie } from "@/actions/administration";
import { Avatar, Carte, Champ, EnTeteCarte, EnTetePage, LienBouton, Pastille, Vide } from "@/components/ui";
import { BoutonAction, FormulaireAction } from "@/components/interactif";
import { TuileChiffre } from "@/components/graphiques/figures";

export const metadata: Metadata = { title: "Compagnie" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageCompagnie({ params }: PageProps<"/compagnies/[id]">) {
  const { id } = await params;
  const { supabase } = await exigerRole("gestionnaire");
  if (!UUID.test(id)) notFound();

  const [compagnieRes, statsRes, equipeRes] = await Promise.all([
    supabase.from("compagnies").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("statistiques", { p_compagnie: id }),
    supabase.from("profils").select("*").eq("compagnie_id", id).order("role").order("prenom"),
  ]);
  const compagnie = compagnieRes.data as Compagnie | null;
  if (!compagnie) notFound();
  const t = (statsRes.data as Statistiques | null)?.totaux;
  const equipe = (equipeRes.data ?? []) as Profil[];

  return (
    <>
      <EnTetePage
        titre={compagnie.nom}
        description={`${compagnie.sigle} · code ${compagnie.code}`}
        retour={{ href: "/compagnies", libelle: "Compagnies" }}
        actions={
          <>
            {!compagnie.actif && <Pastille ton="critique">Compagnie suspendue</Pastille>}
            <LienBouton href={`/sinistres?compagnie=${compagnie.id}`}>
              <FolderOpen size={16} /> Voir ses sinistres
            </LienBouton>
            <BoutonAction
              action={activerCompagnie.bind(null, compagnie.id, !compagnie.actif)}
              variante={compagnie.actif ? "danger" : "primaire"}
              taille="md"
              confirmation={
                compagnie.actif
                  ? `Suspendre ${compagnie.nom} ? Ses utilisateurs ne pourront plus se connecter. Ses dossiers sont conservés.`
                  : undefined
              }
            >
              {compagnie.actif ? "Suspendre l'accès" : "Rétablir l'accès"}
            </BoutonAction>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TuileChiffre accent libelle="Dossiers en cours" valeur={entier(t?.ouverts ?? 0)} icone={<FolderOpen size={18} />} detail={`${entier(t?.total ?? 0)} dossiers au total`} />
        <TuileChiffre libelle="Provisions en cours" valeur={abrege(t?.provisions ?? 0)} unite="FCFA" icone={<Landmark size={18} />} />
        <TuileChiffre libelle="Indemnités réglées" valeur={abrege(t?.regle ?? 0)} unite="FCFA" icone={<HandCoins size={18} />} />
        <TuileChiffre
          libelle="Délai moyen de règlement"
          valeur={t?.delai_moyen == null ? "—" : entier(t.delai_moyen)}
          unite={t?.delai_moyen == null ? undefined : "jours"}
          icone={<Timer size={18} />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Carte>
          <EnTeteCarte titre="Informations" />
          <div className="px-5 pb-5">
            <FormulaireAction action={modifierCompagnie.bind(null, compagnie.id)} messageSucces="Informations enregistrées.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Champ libelle="Nom" requis className="sm:col-span-2">
                  <input className="champ" name="nom" required defaultValue={compagnie.nom} />
                </Champ>
                <Champ libelle="Sigle" requis>
                  <input className="champ uppercase" name="sigle" required maxLength={10} defaultValue={compagnie.sigle} />
                </Champ>
                <Champ libelle="E-mail de contact">
                  <input className="champ" name="email" type="email" defaultValue={compagnie.email ?? ""} />
                </Champ>
                <Champ libelle="Téléphone">
                  <input className="champ" name="telephone" type="tel" defaultValue={compagnie.telephone ?? ""} />
                </Champ>
                <Champ libelle="Ville">
                  <input className="champ" name="ville" defaultValue={compagnie.ville ?? ""} />
                </Champ>
                <Champ libelle="Adresse" className="sm:col-span-2">
                  <input className="champ" name="adresse" defaultValue={compagnie.adresse ?? ""} />
                </Champ>
                <Champ libelle="Pays">
                  <input className="champ" name="pays" defaultValue={compagnie.pays} />
                </Champ>
              </div>
            </FormulaireAction>
          </div>
        </Carte>

        <Carte>
          <EnTeteCarte
            titre="Comptes de la compagnie"
            compteur={equipe.length}
            action={
              <LienBouton href={`/equipe?compagnie=${compagnie.id}`} taille="sm">
                <Users size={15} /> Gérer les comptes
              </LienBouton>
            }
          />
          {equipe.length === 0 ? (
            <Vide icone={<Users size={22} />} titre="Aucun compte" description="Cette compagnie n'a encore aucun utilisateur." />
          ) : (
            <ul className="divide-y divide-white/5 px-2 pb-2">
              {equipe.map((membre) => (
                <li key={membre.id} className={`flex items-center gap-3 px-3 py-3 ${membre.actif ? "" : "opacity-55"}`}>
                  <Avatar texte={initiales(membre.prenom, membre.nom)} ton={membre.role === "agent" ? "sarcelle" : "or"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-encre">
                      {membre.prenom} {membre.nom}
                    </span>
                    <span className="block truncate text-xs text-encre-3">{membre.email}</span>
                  </span>
                  <Pastille ton={membre.role === "agent" ? "neutre" : "or"} point={false}>
                    {ROLES[membre.role]}
                  </Pastille>
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 pb-5 text-xs leading-relaxed text-encre-3">
            L'administrateur de la compagnie crée lui-même ses agents et leur attribue leurs accès depuis son menu{" "}
            <Link href={`/equipe?compagnie=${compagnie.id}`} className="text-or-clair hover:underline">
              Équipe
            </Link>
            .
          </p>
        </Carte>
      </div>
    </>
  );
}
