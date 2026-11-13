import type { Metadata } from "next";
import Link from "next/link";
import { ChartNoAxesColumn, Download, FolderOpen, HandCoins, Landmark, Timer } from "lucide-react";
import { exigerPermission } from "@/lib/session";
import { couleurFamille, FAMILLES } from "@/lib/referentiel";
import { abrege, entier, fcfa, libelleMois } from "@/lib/format";
import type { Branche, CompagnieResume, Statistiques } from "@/lib/types";
import { Carte, Champ, EnTeteCarte, EnTetePage, Vide, classesBouton } from "@/components/ui";
import { Sigle } from "@/components/metier";
import { TuileChiffre } from "@/components/graphiques/figures";
import { BarresMensuelles, type PointMensuel } from "@/components/graphiques/barres-mensuelles";

export const metadata: Metadata = { title: "Rapports" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function PageRapports({ searchParams }: PageProps<"/rapports">) {
  const parametres = await searchParams;
  const { supabase, profil } = await exigerPermission("rapports.consulter");
  const estGestionnaire = profil.role === "gestionnaire";

  const lire = (cle: string, motif: RegExp) => {
    const v = parametres[cle];
    return typeof v === "string" && motif.test(v) ? v : null;
  };
  const aujourdhui = new Date();
  const debutDefaut = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
  const debut = lire("du", DATE) ?? debutDefaut;
  const fin = lire("au", DATE) ?? aujourdhui.toISOString().slice(0, 10);
  const compagnie = estGestionnaire ? lire("compagnie", UUID) : null;
  const branche = lire("branche", UUID);

  const [statsRes, branchesRes, compagniesRes] = await Promise.all([
    supabase.rpc("statistiques", { p_debut: debut, p_fin: fin, p_compagnie: compagnie, p_branche: branche }),
    supabase.from("branches").select("id, nom").order("ordre"),
    estGestionnaire ? supabase.from("compagnies").select("id, nom, sigle").order("nom") : Promise.resolve({ data: null }),
  ]);
  const stats = statsRes.data as Statistiques | null;
  const branches = (branchesRes.data ?? []) as Pick<Branche, "id" | "nom">[];
  const compagnies = compagniesRes.data as CompagnieResume[] | null;
  const t = stats?.totaux;

  // Mois couverts par la période (24 au plus, pour rester lisible).
  const cles: string[] = [];
  const curseur = new Date(`${debut.slice(0, 7)}-01T00:00:00Z`);
  const borne = new Date(`${fin.slice(0, 7)}-01T00:00:00Z`);
  while (curseur <= borne && cles.length < 36) {
    cles.push(curseur.toISOString().slice(0, 7));
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }
  const mois = cles.slice(-24);
  const points: PointMensuel[] = mois.map((cle) => ({
    cle,
    libelle: libelleMois(cle),
    libelleLong: libelleMois(cle, true),
    valeurs: Object.fromEntries(FAMILLES.map((f) => [f, stats?.par_mois.find((m) => m.mois === cle && m.famille === f)?.n ?? 0])),
  }));
  const series = FAMILLES.filter((f) => points.some((p) => p.valeurs[f] > 0)).map((f) => ({
    cle: f,
    libelle: f,
    couleur: couleurFamille(f),
  }));

  const exportParams = new URLSearchParams();
  if (compagnie) exportParams.set("compagnie", compagnie);
  if (branche) exportParams.set("branche", branche);
  const taux = (regle: number, estime: number) => (estime > 0 ? `${Math.round((regle / estime) * 100)} %` : "—");

  return (
    <>
      <EnTetePage
        titre="Rapports"
        description="Indicateurs calculés sur les sinistres déclarés pendant la période choisie."
        actions={
          <a href={`/api/export/sinistres?${exportParams.toString()}`} className={classesBouton("secondaire")}>
            <Download size={16} /> Exporter les dossiers (CSV)
          </a>
        }
      />

      {/* Filtres : une seule rangée, au-dessus de tout ce qu'ils gouvernent */}
      <form method="get" className="carte mb-4 flex flex-wrap items-end gap-3 p-4">
        <Champ libelle="Du">
          <input className="champ" type="date" name="du" defaultValue={debut} max={fin} />
        </Champ>
        <Champ libelle="Au">
          <input className="champ" type="date" name="au" defaultValue={fin} />
        </Champ>
        {compagnies && (
          <Champ libelle="Compagnie" className="min-w-52 flex-1">
            <select className="champ" name="compagnie" defaultValue={compagnie ?? ""}>
              <option value="">Toutes les compagnies</option>
              {compagnies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigle} — {c.nom}
                </option>
              ))}
            </select>
          </Champ>
        )}
        <Champ libelle="Branche" className="min-w-52 flex-1">
          <select className="champ" name="branche" defaultValue={branche ?? ""}>
            <option value="">Toutes les branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nom}
              </option>
            ))}
          </select>
        </Champ>
        <button type="submit" className={classesBouton("primaire")}>
          Appliquer
        </button>
        <Link href="/rapports" className={classesBouton("fantome")}>
          Réinitialiser
        </Link>
      </form>

      {!stats || !t || t.total === 0 ? (
        <Carte>
          <Vide
            icone={<ChartNoAxesColumn size={22} />}
            titre="Aucun sinistre sur cette période"
            description="Élargissez la période ou retirez un filtre pour afficher des indicateurs."
          />
        </Carte>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TuileChiffre
              accent
              libelle="Sinistres déclarés"
              valeur={entier(t.total)}
              icone={<FolderOpen size={18} />}
              detail={`${entier(t.ouverts)} en cours · ${entier(t.clos)} clôturés · ${entier(t.rejetes)} rejetés`}
            />
            <TuileChiffre libelle="Coût estimé" valeur={abrege(t.estime)} unite="FCFA" icone={<Landmark size={18} />} detail={`Provisions en cours : ${abrege(t.provisions)} FCFA`} />
            <TuileChiffre libelle="Indemnités réglées" valeur={abrege(t.regle)} unite="FCFA" icone={<HandCoins size={18} />} detail={`${taux(t.regle, t.estime)} du coût estimé`} />
            <TuileChiffre
              libelle="Délai moyen de règlement"
              valeur={t.delai_moyen === null ? "—" : entier(t.delai_moyen)}
              unite={t.delai_moyen === null ? undefined : "jours"}
              icone={<Timer size={18} />}
              detail="Dossiers clôturés de la période"
            />
          </div>

          <Carte className="mt-4">
            <EnTeteCarte titre="Sinistres déclarés par mois" description="Par famille de branches." />
            <div className="px-5 pb-5">
              <BarresMensuelles series={series} points={points} large />
            </div>
          </Carte>

          <div className={`mt-4 grid gap-4 ${estGestionnaire && !compagnie ? "2xl:grid-cols-2" : ""}`}>
            <Carte>
              <EnTeteCarte titre="Par branche" />
              <div className="overflow-x-auto pb-2">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Branche</th>
                      <th className="chiffre">Dossiers</th>
                      <th className="chiffre">En cours</th>
                      <th className="chiffre">Coût estimé</th>
                      <th className="chiffre">Réglé</th>
                      <th className="chiffre">Réglé / estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.par_branche.map((b) => (
                      <tr key={b.branche_id}>
                        <td>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: couleurFamille(b.famille) }} />
                            {b.nom}
                          </span>
                        </td>
                        <td className="chiffre">{entier(b.n)}</td>
                        <td className="chiffre text-encre-2">{entier(b.ouverts)}</td>
                        <td className="chiffre">{fcfa(b.estime)}</td>
                        <td className="chiffre">{fcfa(b.regle)}</td>
                        <td className="chiffre text-encre-2">{taux(b.regle, b.estime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>

            {estGestionnaire && !compagnie && (
              <Carte>
                <EnTeteCarte titre="Par compagnie" />
                <div className="overflow-x-auto pb-2">
                  <table className="tableau">
                    <thead>
                      <tr>
                        <th>Compagnie</th>
                        <th className="chiffre">Dossiers</th>
                        <th className="chiffre">En cours</th>
                        <th className="chiffre">Provisions</th>
                        <th className="chiffre">Réglé</th>
                        <th className="chiffre">Délai moyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.par_compagnie.map((c) => (
                        <tr key={c.compagnie_id}>
                          <td>
                            <Link href={`/compagnies/${c.compagnie_id}`} className="flex items-center gap-2 hover:underline">
                              <Sigle>{c.sigle}</Sigle>
                              <span className="max-w-44 truncate">{c.nom}</span>
                            </Link>
                          </td>
                          <td className="chiffre">{entier(c.n)}</td>
                          <td className="chiffre text-encre-2">{entier(c.ouverts)}</td>
                          <td className="chiffre">{fcfa(c.provisions)}</td>
                          <td className="chiffre">{fcfa(c.regle)}</td>
                          <td className="chiffre text-encre-2">{c.delai_moyen === null ? "—" : `${c.delai_moyen} j`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Carte>
            )}
          </div>
        </>
      )}
    </>
  );
}
