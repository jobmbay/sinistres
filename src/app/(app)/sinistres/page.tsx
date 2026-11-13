import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FolderSearch, Plus, ArrowRight, X } from "lucide-react";
import { exigerSession } from "@/lib/session";
import { LIBELLES_ATTENTE, lireFiltres, requeteSinistres } from "@/lib/requetes";
import { peut, STATUTS } from "@/lib/referentiel";
import { date, entier, fcfa, initiales } from "@/lib/format";
import type { Branche, CompagnieResume, SinistreListe, Statut } from "@/lib/types";
import { Avatar, Carte, EnTetePage, LienBouton, Vide, classesBouton } from "@/components/ui";
import { PastillePriorite, PastilleStatut, Sigle } from "@/components/metier";
import { BarreFiltres } from "./filtres";

export const metadata: Metadata = { title: "Sinistres" };

const PAR_PAGE = 25;

export default async function PageSinistres({ searchParams }: PageProps<"/sinistres">) {
  const parametres = await searchParams;
  const { supabase, profil } = await exigerSession();
  const estGestionnaire = profil.role === "gestionnaire";
  const filtres = lireFiltres(parametres);
  const page = Math.max(1, Number(Array.isArray(parametres.page) ? parametres.page[0] : parametres.page) || 1);

  const { requete } = await requeteSinistres(supabase, filtres, { compter: true, utilisateurId: profil.id });
  const [liste, branchesRes, compagniesRes] = await Promise.all([
    requete.order("created_at", { ascending: false }).range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
    supabase.from("branches").select("id, nom").order("ordre"),
    estGestionnaire ? supabase.from("compagnies").select("id, nom, sigle").order("nom") : Promise.resolve({ data: null }),
  ]);

  const sinistres = (liste.data ?? []) as unknown as SinistreListe[];
  const total = liste.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const branches = (branchesRes.data ?? []) as Pick<Branche, "id" | "nom">[];
  const compagnies = compagniesRes.data as CompagnieResume[] | null;

  const lienPage = (n: number) => {
    const suivants = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(parametres)) {
      const v = Array.isArray(valeur) ? valeur[0] : valeur;
      if (v && cle !== "page") suivants.set(cle, v);
    }
    if (n > 1) suivants.set("page", String(n));
    const chaine = suivants.toString();
    return chaine ? `/sinistres?${chaine}` : "/sinistres";
  };
  const lienExport = lienPage(1).replace("/sinistres", "/api/export/sinistres");

  return (
    <>
      <EnTetePage
        titre="Sinistres"
        description={
          estGestionnaire
            ? "Tous les dossiers, toutes compagnies et toutes branches."
            : `Les dossiers de ${profil.compagnie?.nom ?? "votre compagnie"}.`
        }
        actions={
          <>
            {peut(profil, "rapports.consulter") && total > 0 && (
              <a href={lienExport} className={classesBouton("secondaire")}>
                <Download size={16} /> Exporter
              </a>
            )}
            {peut(profil, "sinistres.creer") && (
              <LienBouton href="/sinistres/nouveau" variante="primaire">
                <Plus size={17} /> Déclarer un sinistre
              </LienBouton>
            )}
          </>
        }
      />

      <BarreFiltres
        statuts={[
          { valeur: "ouverts", libelle: "En cours (tous)" },
          { valeur: "termines", libelle: "Terminés (tous)" },
          ...(Object.keys(STATUTS) as Statut[]).map((s) => ({ valeur: s, libelle: STATUTS[s].libelle })),
        ]}
        branches={branches.map((b) => ({ valeur: b.id, libelle: b.nom }))}
        compagnies={compagnies?.map((c) => ({ valeur: c.id, libelle: `${c.sigle} — ${c.nom}` }))}
      />

      {(filtres.attente || filtres.adverse) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filtres.attente && (
            <Link href="/sinistres" className="inline-flex items-center gap-1.5 rounded-full border border-or/40 bg-or/10 px-3 py-1 text-xs text-or-clair hover:bg-or/20">
              {LIBELLES_ATTENTE[filtres.attente]} <X size={13} />
            </Link>
          )}
          {filtres.adverse && (
            <Link href="/sinistres" className="inline-flex items-center gap-1.5 rounded-full border border-or/40 bg-or/10 px-3 py-1 text-xs text-or-clair hover:bg-or/20">
              Filtré sur une compagnie adverse <X size={13} />
            </Link>
          )}
        </div>
      )}

      <p className="mt-5 mb-2.5 text-sm text-encre-3" aria-live="polite">
        {total === 0 ? "Aucun dossier" : `${entier(total)} dossier${total > 1 ? "s" : ""}`}
        {pages > 1 && ` · page ${page} sur ${pages}`}
      </p>

      <Carte className="overflow-hidden">
        {sinistres.length === 0 ? (
          <Vide
            icone={<FolderSearch size={22} />}
            titre="Aucun dossier ne correspond"
            description="Modifiez vos filtres ou votre recherche pour retrouver un dossier."
          />
        ) : (
          <>
            {/* Tableau (écrans larges) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="tableau">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Assuré</th>
                    {estGestionnaire && <th>Compagnie</th>}
                    <th>Branche</th>
                    <th>Survenance</th>
                    <th className="chiffre">Estimation</th>
                    <th>Suivi par</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sinistres.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/sinistres/${s.id}`} className="font-mono text-[0.82rem] whitespace-nowrap text-or-clair hover:underline">
                          {s.numero}
                        </Link>
                        <span className="mt-1 block empty:hidden">
                          <PastillePriorite priorite={s.priorite} />
                        </span>
                      </td>
                      <td>
                        <Link href={`/sinistres/${s.id}`} className="block max-w-56 truncate font-medium text-encre hover:underline">
                          {s.assure_nom}
                        </Link>
                        <span className="block text-xs text-encre-3">Police {s.numero_police}</span>
                      </td>
                      {estGestionnaire && (
                        <td>
                          <span className="flex items-center gap-1.5">
                            {s.compagnie && <Sigle>{s.compagnie.sigle}</Sigle>}
                            {s.adverse && (
                              <>
                                <ArrowRight size={12} className="text-encre-3" aria-label="contre" />
                                <Sigle ton="neutre">{s.adverse.sigle}</Sigle>
                              </>
                            )}
                          </span>
                        </td>
                      )}
                      <td>
                        <span className="block max-w-52 truncate text-encre-2" title={s.branche?.nom}>{s.branche?.nom}</span>
                        {s.type && <span className="block max-w-52 truncate text-xs text-encre-3" title={s.type.nom}>{s.type.nom}</span>}
                      </td>
                      <td className="whitespace-nowrap text-encre-2">{date(s.date_survenance)}</td>
                      <td className="chiffre">{fcfa(s.montant_estime)}</td>
                      <td>
                        {s.gestionnaire ? (
                          <span className="flex items-center gap-2 text-sm text-encre-2" title={`${s.gestionnaire.prenom} ${s.gestionnaire.nom}`}>
                            <Avatar taille="sm" texte={initiales(s.gestionnaire.prenom, s.gestionnaire.nom)} />
                            <span className="sr-only 2xl:not-sr-only 2xl:max-w-28 2xl:truncate">
                              {s.gestionnaire.prenom} {s.gestionnaire.nom}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-encre-3">Non attribué</span>
                        )}
                      </td>
                      <td>
                        <PastilleStatut statut={s.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fiches (mobile) */}
            <ul className="divide-y divide-white/5 md:hidden">
              {sinistres.map((s) => (
                <li key={s.id}>
                  <Link href={`/sinistres/${s.id}`} className="block px-4 py-3.5 active:bg-white/[0.04]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[0.8rem] text-or-clair">{s.numero}</span>
                      <PastilleStatut statut={s.statut} />
                    </span>
                    <span className="mt-1.5 block font-medium text-encre">{s.assure_nom}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-encre-3">
                      {estGestionnaire && s.compagnie && <span>{s.compagnie.sigle}</span>}
                      <span>{s.branche?.nom}</span>
                      <span>{date(s.date_survenance)}</span>
                      <span className="text-encre-2">{fcfa(s.montant_estime)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Carte>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <LienBouton href={lienPage(page - 1)} taille="sm">
              <ChevronLeft size={15} /> Précédente
            </LienBouton>
          ) : (
            <span />
          )}
          <span className="text-sm text-encre-3">
            Page {page} sur {pages}
          </span>
          {page < pages ? (
            <LienBouton href={lienPage(page + 1)} taille="sm">
              Suivante <ChevronRight size={15} />
            </LienBouton>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
