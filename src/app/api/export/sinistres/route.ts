import { NextResponse, type NextRequest } from "next/server";
import { lireSession } from "@/lib/session";
import { lireFiltres, requeteSinistres } from "@/lib/requetes";
import { peut, STATUTS } from "@/lib/referentiel";
import type { SinistreListe } from "@/lib/types";

const LOT = 1000;
const MAXIMUM = 20000;

/** Protège contre l'injection de formules dans les tableurs et échappe le CSV. */
function cellule(valeur: unknown): string {
  let texte = valeur === null || valeur === undefined ? "" : String(valeur);
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return `"${texte.replace(/"/g, '""')}"`;
}

/** Export CSV de la liste des sinistres, avec les mêmes filtres que l'écran. */
export async function GET(request: NextRequest) {
  const session = await lireSession();
  if (!session) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!peut(session.profil, "rapports.consulter")) {
    return new NextResponse("Export non autorisé.", { status: 403 });
  }

  const filtres = lireFiltres(Object.fromEntries(request.nextUrl.searchParams));
  const lignes: SinistreListe[] = [];
  for (let debut = 0; debut < MAXIMUM; debut += LOT) {
    const { requete } = await requeteSinistres(session.supabase, filtres, { utilisateurId: session.profil.id });
    const { data, error } = await requete.order("created_at", { ascending: false }).range(debut, debut + LOT - 1);
    if (error) return new NextResponse("L'export a échoué.", { status: 500 });
    lignes.push(...((data ?? []) as unknown as SinistreListe[]));
    if (!data || data.length < LOT) break;
  }

  const enTetes = [
    "Numéro", "Statut", "Compagnie", "Compagnie adverse", "Branche", "Type de sinistre", "Police",
    "Assuré", "Téléphone", "Date de survenance", "Date de déclaration", "Ville",
    "Estimation (FCFA)", "Provision (FCFA)", "Réglé (FCFA)", "Gestionnaire", "Date de clôture",
  ];
  const corps = lignes.map((s) =>
    [
      s.numero, STATUTS[s.statut].libelle, s.compagnie?.nom, s.adverse?.nom, s.branche?.nom, s.type?.nom,
      s.numero_police, s.assure_nom, s.assure_telephone, s.date_survenance.slice(0, 10), s.date_declaration,
      s.ville, s.montant_estime, s.montant_provision, s.montant_regle,
      s.gestionnaire ? `${s.gestionnaire.prenom} ${s.gestionnaire.nom}` : "", s.date_cloture?.slice(0, 10),
    ]
      .map(cellule)
      .join(";"),
  );

  // BOM UTF-8 et séparateur « ; » : ouverture directe dans Excel en français.
  const csv = `﻿${enTetes.map(cellule).join(";")}\r\n${corps.join("\r\n")}\r\n`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sinistres-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
