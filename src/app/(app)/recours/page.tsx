import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale, ShieldAlert } from "lucide-react";
import { exigerSession } from "@/lib/session";
import { STATUTS_RECOURS } from "@/lib/referentiel";
import { date, fcfa } from "@/lib/format";
import type { CompagnieResume, Recours, SinistreAdverse } from "@/lib/types";
import { Carte, EnTeteCarte, EnTetePage, Vide } from "@/components/ui";
import { PastilleEtat, Sigle } from "@/components/metier";

export const metadata: Metadata = { title: "Recours" };

type RecoursListe = Recours & {
  emettrice: CompagnieResume | null;
  adverse: CompagnieResume | null;
  sinistre: { numero: string } | null;
};

export default async function PageRecours() {
  const { supabase, profil } = await exigerSession();
  const estGestionnaire = profil.role === "gestionnaire";

  const [recoursRes, adversesRes, compagniesRes] = await Promise.all([
    supabase
      .from("recours")
      .select(
        `*, emettrice:compagnies!recours_compagnie_emettrice_id_fkey(id, nom, sigle),
         adverse:compagnies!recours_compagnie_adverse_id_fkey(id, nom, sigle),
         sinistre:sinistres(numero)`,
      )
      .order("date_emission", { ascending: false })
      .limit(300),
    // Dossiers d'autres compagnies où la mienne est désignée comme adverse (vue restreinte).
    estGestionnaire
      ? Promise.resolve({ data: [] })
      : supabase.from("sinistres_adverses").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("compagnies").select("id, nom, sigle"),
  ]);

  const recours = (recoursRes.data ?? []) as unknown as RecoursListe[];
  const adverses = (adversesRes.data ?? []) as SinistreAdverse[];
  const compagnies = new Map(((compagniesRes.data ?? []) as CompagnieResume[]).map((c) => [c.id, c]));
  const numeros = new Map(adverses.map((s) => [s.id, s.numero]));

  const recus = recours.filter((r) => r.compagnie_adverse_id === profil.compagnie_id);
  const emis = estGestionnaire ? recours : recours.filter((r) => r.compagnie_emettrice_id === profil.compagnie_id);
  const avecRecours = new Set(recus.map((r) => r.sinistre_id));
  const sansRecours = adverses.filter((s) => !avecRecours.has(s.id));

  return (
    <>
      <EnTetePage
        titre="Recours"
        description={
          estGestionnaire
            ? "Tous les recours exercés entre compagnies."
            : "Les recours que vous exercez contre d'autres compagnies, et ceux que vous recevez."
        }
      />

      {!estGestionnaire && (
        <Carte className="mb-4">
          <EnTeteCarte
            titre="Recours reçus"
            compteur={recus.filter((r) => r.statut === "emis").length}
            description="Réclamations d'autres compagnies. Le compteur indique celles qui attendent votre réponse."
          />
          <TableauRecours recours={recus} numeros={numeros} sens="recu" />
        </Carte>
      )}

      <Carte className="mb-4">
        <EnTeteCarte titre={estGestionnaire ? "Tous les recours" : "Recours émis"} />
        <TableauRecours recours={emis} numeros={numeros} sens={estGestionnaire ? "tous" : "emis"} />
      </Carte>

      {!estGestionnaire && sansRecours.length > 0 && (
        <Carte>
          <EnTeteCarte
            titre="Sinistres vous mettant en cause"
            description="Dossiers ouverts par d'autres compagnies qui désignent la vôtre comme adverse, sans recours à ce jour. Vous en voyez uniquement les éléments utiles : ni provisions ni échanges internes."
          />
          <div className="overflow-x-auto pb-2">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Compagnie</th>
                  <th>Son assuré</th>
                  <th>Votre assuré (tiers)</th>
                  <th>Survenance</th>
                  <th>Lieu</th>
                </tr>
              </thead>
              <tbody>
                {sansRecours.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-[0.82rem] text-encre-2">{s.numero}</td>
                    <td>{compagnies.get(s.compagnie_id) && <Sigle>{compagnies.get(s.compagnie_id)!.sigle}</Sigle>}</td>
                    <td>{s.assure_nom}</td>
                    <td className="text-encre-2">
                      {s.tiers_nom ?? "—"}
                      {s.tiers_police && <span className="block font-mono text-xs text-encre-3">{s.tiers_police}</span>}
                    </td>
                    <td className="whitespace-nowrap text-encre-2">{date(s.date_survenance)}</td>
                    <td className="text-encre-2">{[s.lieu, s.ville].filter(Boolean).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
    </>
  );
}

function TableauRecours({
  recours,
  numeros,
  sens,
}: {
  recours: RecoursListe[];
  numeros: Map<string, string>;
  sens: "recu" | "emis" | "tous";
}) {
  if (recours.length === 0) {
    return (
      <Vide
        icone={sens === "recu" ? <ShieldAlert size={22} /> : <Scale size={22} />}
        titre={sens === "recu" ? "Aucun recours reçu" : "Aucun recours émis"}
        description={
          sens === "recu"
            ? "Aucune compagnie n'a exercé de recours contre la vôtre."
            : "Un recours s'émet depuis l'onglet « Recours » d'un dossier qui désigne une compagnie adverse."
        }
      />
    );
  }
  return (
    <div className="overflow-x-auto pb-2">
      <table className="tableau">
        <thead>
          <tr>
            <th>Recours</th>
            <th>Dossier</th>
            <th>{sens === "recu" ? "Émis par" : sens === "emis" ? "Contre" : "Compagnies"}</th>
            <th className="chiffre">Réclamé</th>
            <th className="chiffre">Accordé</th>
            <th>Émis le</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {recours.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/recours/${r.id}`} className="font-mono text-[0.82rem] text-or-clair hover:underline">
                  {r.numero}
                </Link>
              </td>
              <td className="font-mono text-[0.8rem] text-encre-2">{r.sinistre?.numero ?? numeros.get(r.sinistre_id) ?? "—"}</td>
              <td>
                <span className="flex items-center gap-1.5">
                  {sens !== "emis" && r.emettrice && <Sigle>{r.emettrice.sigle}</Sigle>}
                  {sens === "tous" && <ArrowRight size={12} className="text-encre-3" aria-label="contre" />}
                  {sens !== "recu" && r.adverse && <Sigle ton={sens === "tous" ? "neutre" : "rose"}>{r.adverse.sigle}</Sigle>}
                </span>
              </td>
              <td className="chiffre">{fcfa(r.montant_reclame)}</td>
              <td className="chiffre text-encre-2">{r.montant_accorde === null ? "—" : fcfa(r.montant_accorde)}</td>
              <td className="whitespace-nowrap text-encre-2">{date(r.date_emission)}</td>
              <td>
                <PastilleEtat etat={r.statut} table={STATUTS_RECOURS} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
