import type { Metadata } from "next";
import Link from "next/link";
import {
  FolderOpen,
  FilePlus2,
  Landmark,
  HandCoins,
  Timer,
  FileCheck2,
  MessageSquareText,
  Scale,
  CircleDollarSign,
  ArrowUpRight,
  Plus,
  Inbox,
} from "lucide-react";
import { exigerSession } from "@/lib/session";
import { SELECTION_SINISTRE } from "@/lib/requetes";
import { couleurFamille, FAMILLES, peut } from "@/lib/referentiel";
import { abrege, date, dateEnLettres, entier, fcfa, libelleMois } from "@/lib/format";
import type { SinistreListe, Statistiques } from "@/lib/types";
import { Carte, EnTeteCarte, EnTetePage, LienBouton, Vide } from "@/components/ui";
import { PastilleStatut, Sigle } from "@/components/metier";
import { BarreGraduee, JaugeRepartition, TendancePoints, TuileChiffre } from "@/components/graphiques/figures";
import { BarresMensuelles, type PointMensuel } from "@/components/graphiques/barres-mensuelles";
import { Constellation, type LienCroise, type NoeudPrincipal } from "@/components/graphiques/constellation";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord() {
  const { supabase, profil } = await exigerSession();
  const estGestionnaire = profil.role === "gestionnaire";

  const [statsRes, recentsRes, piecesRes, reglementsRes, offresRes, messagesRes, recoursRes] = await Promise.all([
    supabase.rpc("statistiques"),
    supabase.from("sinistres").select(SELECTION_SINISTRE).order("created_at", { ascending: false }).limit(6),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("statut", "recu"),
    supabase.from("reglements").select("id", { count: "exact", head: true }).in("statut", ["en_attente", "valide"]),
    supabase.from("offres").select("id", { count: "exact", head: true }).eq("statut", "envoyee"),
    supabase
      .from("messages")
      .select("id, contenu, auteur_nom, created_at, sinistre:sinistres(id, numero)")
      .eq("auteur_type", "client")
      .order("created_at", { ascending: false })
      .limit(3),
    profil.compagnie_id
      ? supabase
          .from("recours")
          .select("id", { count: "exact", head: true })
          .eq("compagnie_adverse_id", profil.compagnie_id)
          .eq("statut", "emis")
      : supabase.from("recours").select("id", { count: "exact", head: true }).eq("statut", "emis"),
  ]);

  const stats = statsRes.data as Statistiques | null;
  const recents = (recentsRes.data ?? []) as unknown as SinistreListe[];
  const messages = (messagesRes.data ?? []) as unknown as {
    id: string;
    contenu: string;
    auteur_nom: string;
    created_at: string;
    sinistre: { id: string; numero: string } | null;
  }[];

  const enTete = (
    <EnTetePage
      titre={`Bonjour, ${profil.prenom}`}
      description={
        estGestionnaire
          ? "Vue d'ensemble de tous les sinistres, toutes compagnies et toutes branches confondues."
          : `Vue d'ensemble des sinistres de ${profil.compagnie?.nom ?? "votre compagnie"}.`
      }
      actions={
        peut(profil, "sinistres.creer") && (
          <LienBouton href="/sinistres/nouveau" variante="primaire">
            <Plus size={17} /> Déclarer un sinistre
          </LienBouton>
        )
      }
    />
  );

  if (!stats || stats.totaux.total === 0) {
    return (
      <>
        {enTete}
        <Carte>
          <Vide
            icone={<FolderOpen size={22} />}
            titre="Aucun sinistre pour le moment"
            description="Dès qu'un premier dossier sera déclaré, vos indicateurs et la cartographie du portefeuille apparaîtront ici."
            action={
              peut(profil, "sinistres.creer") && (
                <LienBouton href="/sinistres/nouveau" variante="primaire">
                  <Plus size={17} /> Déclarer un sinistre
                </LienBouton>
              )
            }
          />
        </Carte>
      </>
    );
  }

  const t = stats.totaux;

  /* ---------- 12 derniers mois ---------- */
  const maintenant = new Date();
  const cles = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11 + i, 1));
    return d.toISOString().slice(0, 7);
  });
  const points: PointMensuel[] = cles.map((cle) => ({
    cle,
    libelle: libelleMois(cle),
    libelleLong: libelleMois(cle, true),
    valeurs: Object.fromEntries(
      FAMILLES.map((f) => [f, stats.par_mois.find((m) => m.mois === cle && m.famille === f)?.n ?? 0]),
    ),
  }));
  const famillesPresentes = FAMILLES.filter((f) => points.some((p) => p.valeurs[f] > 0));
  const series = famillesPresentes.map((f) => ({ cle: f, libelle: f, couleur: couleurFamille(f) }));
  const tendance = points.map((p) => Object.values(p.valeurs).reduce((s, v) => s + v, 0));

  /* ---------- Cartographie ---------- */
  const part = (n: number) => Math.round((n / t.total) * 100);
  let principaux: NoeudPrincipal[];
  let croises: LienCroise[] = [];
  if (estGestionnaire) {
    const retenues = stats.par_compagnie.slice(0, 8);
    const ids = new Set(retenues.map((c) => c.compagnie_id));
    principaux = retenues.map((c) => ({
      id: c.compagnie_id,
      libelle: c.nom,
      valeur: c.n,
      part: part(c.n),
      type: "compagnie",
      detail: `${c.ouverts} en cours · ${abrege(c.provisions)} FCFA de provisions`,
      href: `/sinistres?compagnie=${c.compagnie_id}`,
      enfants: stats.compagnie_branche
        .filter((cb) => cb.compagnie_id === c.compagnie_id)
        .slice(0, 4)
        .map((cb) => ({
          id: `${cb.compagnie_id}-${cb.branche_id}`,
          libelle: cb.nom,
          valeur: cb.n,
          href: `/sinistres?compagnie=${cb.compagnie_id}&branche=${cb.branche_id}`,
        })),
    }));
    // Une relation adverse A↔B n'est tracée qu'une fois.
    const paires = new Map<string, LienCroise>();
    for (const l of stats.liens_adverses) {
      if (!ids.has(l.compagnie_id) || !ids.has(l.compagnie_adverse_id)) continue;
      const cle = [l.compagnie_id, l.compagnie_adverse_id].sort().join("|");
      const existante = paires.get(cle);
      if (existante) existante.valeur += l.n;
      else paires.set(cle, { de: l.compagnie_id, vers: l.compagnie_adverse_id, valeur: l.n });
    }
    croises = [...paires.values()];
  } else {
    const adverses = new Map<string, { nom: string; n: number }>();
    for (const l of stats.liens_adverses) {
      const a = adverses.get(l.compagnie_adverse_id) ?? { nom: l.nom, n: 0 };
      a.n += l.n;
      adverses.set(l.compagnie_adverse_id, a);
    }
    principaux = [
      ...stats.par_branche.slice(0, 6).map(
        (b): NoeudPrincipal => ({
          id: b.branche_id,
          libelle: b.nom,
          valeur: b.n,
          part: part(b.n),
          type: "branche",
          detail: `${b.ouverts} en cours · ${abrege(b.estime)} FCFA estimés`,
          href: `/sinistres?branche=${b.branche_id}`,
          enfants: [],
        }),
      ),
      ...[...adverses.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .slice(0, 3)
        .map(
          ([id, a]): NoeudPrincipal => ({
            id: `adverse-${id}`,
            libelle: a.nom,
            valeur: a.n,
            part: part(a.n),
            type: "compagnie",
            indirect: true,
            detail: "Compagnie adverse sur ces dossiers",
            href: `/sinistres?adverse=${id}`,
            enfants: [],
          }),
        ),
    ];
  }

  /* ---------- Répartition ---------- */
  const partsJauge = [
    { cle: "ouverts", libelle: "En cours", valeur: t.ouverts, couleur: "#dcb873" },
    { cle: "clos", libelle: "Clôturés", valeur: t.clos, couleur: "#2fb8a8" },
    { cle: "rejetes", libelle: "Rejetés", valeur: t.rejetes, couleur: "#e77a9d" },
  ];
  const tauxCloture = Math.round(((t.clos + t.rejetes) / t.total) * 100);

  const taches = [
    {
      icone: FileCheck2,
      libelle: "Pièces reçues à contrôler",
      n: piecesRes.count ?? 0,
      href: "/sinistres?attente=pieces",
    },
    {
      icone: CircleDollarSign,
      libelle: "Règlements à valider ou à payer",
      n: reglementsRes.count ?? 0,
      href: "/sinistres?attente=reglements",
    },
    {
      icone: HandCoins,
      libelle: "Offres en attente de réponse",
      n: offresRes.count ?? 0,
      href: "/sinistres?attente=offres",
    },
    {
      icone: Scale,
      libelle: estGestionnaire ? "Recours sans réponse" : "Recours reçus à traiter",
      n: recoursRes.count ?? 0,
      href: "/recours",
    },
  ];

  return (
    <>
      {enTete}

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <TuileChiffre
          accent
          libelle="Dossiers en cours"
          valeur={entier(t.ouverts)}
          icone={<FolderOpen size={18} />}
          detail={`${entier(t.total)} dossiers au total · ${t.contentieux} en contentieux`}
        />
        <TuileChiffre
          libelle="Déclarés ce mois"
          valeur={entier(t.declares_mois)}
          icone={<FilePlus2 size={18} />}
          variation={{ valeur: t.declares_mois - t.declares_mois_precedent, periode: "par rapport au mois dernier" }}
        />
        <TuileChiffre
          libelle="Provisions en cours"
          valeur={abrege(t.provisions)}
          unite="FCFA"
          icone={<Landmark size={18} />}
          detail={`Sur ${entier(t.ouverts)} dossiers ouverts`}
        />
        <TuileChiffre
          libelle="Indemnités réglées"
          valeur={abrege(t.regle)}
          unite="FCFA"
          icone={<HandCoins size={18} />}
          detail={`${entier(t.clos)} dossiers clôturés`}
        />
        <TuileChiffre
          libelle="Délai moyen de règlement"
          valeur={t.delai_moyen === null ? "—" : entier(t.delai_moyen)}
          unite={t.delai_moyen === null ? undefined : "jours"}
          icone={<Timer size={18} />}
          detail="De la déclaration à la clôture"
        />
      </div>

      {/* Cartographie + à traiter */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Carte className="flex flex-col overflow-hidden xl:col-span-2">
          <EnTeteCarte
            titre="Cartographie du portefeuille"
            description={
              estGestionnaire
                ? "Chaque compagnie, ses branches les plus touchées et les liens entre compagnies adverses."
                : "Vos branches les plus touchées et les compagnies adverses rencontrées."
            }
          />
          <div className="flex flex-1 flex-col justify-center px-2 pb-5 sm:px-4">
            <Constellation
              centre={{
                libelle: estGestionnaire ? "Tous les sinistres" : (profil.compagnie?.sigle ?? "Portefeuille"),
                valeur: t.total,
                unite: "dossiers",
              }}
              principaux={principaux}
              croises={croises}
              libelleEnfants="Branches principales"
              legende={
                estGestionnaire
                  ? [
                      { type: "centre", libelle: "Portefeuille" },
                      { type: "compagnie", libelle: "Compagnies", valeur: stats.par_compagnie.length },
                      { type: "enfant", libelle: "Branches (nombre de dossiers)" },
                      { type: "croise", libelle: "Dossiers entre compagnies adverses" },
                    ]
                  : [
                      { type: "centre", libelle: "Votre portefeuille" },
                      { type: "branche", libelle: "Branches", valeur: stats.par_branche.length },
                      { type: "compagnie", libelle: "Compagnies adverses" },
                    ]
              }
            />
          </div>
        </Carte>

        <div className="grid min-w-0 content-start gap-4">
          <Carte>
            <EnTeteCarte titre="À traiter" description="Les actions qui attendent une intervention." />
            <ul className="px-3 pb-3">
              {taches.map(({ icone: Icone, libelle, n, href }) => (
                <li key={libelle}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.05]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-trait bg-white/[0.04] text-encre-2">
                      <Icone size={17} strokeWidth={1.7} />
                    </span>
                    <span className="flex-1 text-sm text-encre-2 group-hover:text-encre">{libelle}</span>
                    <span
                      className={
                        n > 0
                          ? "grid h-7 min-w-7 place-items-center rounded-full bg-or/20 px-2 text-sm font-semibold text-or-clair"
                          : "grid h-7 min-w-7 place-items-center rounded-full bg-white/[0.06] px-2 text-sm text-encre-3"
                      }
                    >
                      {n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Carte>

          <Carte>
            <EnTeteCarte titre="Derniers messages des assurés" />
            {messages.length === 0 ? (
              <Vide icone={<Inbox size={20} />} titre="Aucun message" description="Les messages envoyés depuis l'espace de suivi apparaîtront ici." />
            ) : (
              <ul className="px-3 pb-3">
                {messages.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={m.sinistre ? `/sinistres/${m.sinistre.id}#echanges` : "/sinistres"}
                      className="flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.05]"
                    >
                      <span className="mt-0.5 text-encre-3">
                        <MessageSquareText size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-encre">{m.auteur_nom}</span>
                          <span className="shrink-0 text-[0.7rem] text-encre-3">{date(m.created_at)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-encre-3">{m.contenu}</span>
                        {m.sinistre && <span className="mt-1 block font-mono text-[0.68rem] text-encre-3">{m.sinistre.numero}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      </div>

      {/* Évolution + répartition */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Carte className="xl:col-span-2">
          <EnTeteCarte
            titre="Sinistres déclarés par mois"
            description="Nombre de dossiers ouverts sur les douze derniers mois, par famille de branches."
          />
          <div className="px-5 pb-5">
            <BarresMensuelles series={series} points={points} />
          </div>
        </Carte>

        <Carte>
          <EnTeteCarte titre="État du portefeuille" />
          <div className="px-5 pb-5">
            <JaugeRepartition parts={partsJauge} libelleTotal="Dossiers" />
            <div className="mt-5 border-t border-trait pt-4">
              <div className="mb-2 flex items-end justify-between">
                <span className="text-sm text-encre-2">Dossiers terminés</span>
                <span className="text-2xl font-light text-encre">{tauxCloture}%</span>
              </div>
              <BarreGraduee taux={tauxCloture} libelle="Part des dossiers terminés" />
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-xs leading-relaxed text-encre-3">
                  Déclarations des 12 derniers mois,
                  <br />
                  le mois en cours en doré
                </span>
                <TendancePoints valeurs={tendance} libelle="Déclarations mensuelles sur douze mois" />
              </div>
            </div>
          </div>
        </Carte>
      </div>

      {/* Derniers dossiers */}
      <Carte className="mt-4">
        <EnTeteCarte
          titre="Derniers dossiers ouverts"
          action={
            <LienBouton href="/sinistres" taille="sm">
              Tous les sinistres <ArrowUpRight size={15} />
            </LienBouton>
          }
        />
        <div className="overflow-x-auto pb-2">
          <table className="tableau">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Assuré</th>
                {estGestionnaire && <th>Compagnie</th>}
                <th>Branche</th>
                <th>Survenance</th>
                <th className="chiffre">Estimation</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {recents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/sinistres/${s.id}`} className="font-mono text-[0.82rem] whitespace-nowrap text-or-clair hover:underline">
                      {s.numero}
                    </Link>
                  </td>
                  <td className="max-w-52 truncate">{s.assure_nom}</td>
                  {estGestionnaire && <td>{s.compagnie && <Sigle>{s.compagnie.sigle}</Sigle>}</td>}
                  <td className="text-encre-2">{s.branche?.nom}</td>
                  <td className="whitespace-nowrap text-encre-2">{date(s.date_survenance)}</td>
                  <td className="chiffre">{fcfa(s.montant_estime)}</td>
                  <td>
                    <PastilleStatut statut={s.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>

      <p className="mt-6 text-center text-xs text-encre-3">Données à jour au {dateEnLettres(maintenant.toISOString())}.</p>
    </>
  );
}
