// Contrôle du cloisonnement des données (RLS) avec de vraies sessions.
//
//   npm run test:cloisonnement -- <mot de passe des comptes de démonstration>
//
// À relancer après toute modification des règles de sécurité
// (supabase/migrations). Nécessite le jeu de démonstration (npm run demo).
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret = process.env.SUPABASE_SECRET_KEY;
const MDP = process.argv[2];
const admin = createClient(url, secret, { auth: { persistSession: false } });
let echecs = 0;
const verifier = (nom, condition, detail = "") => { console.log(`${condition ? "  OK  " : "ÉCHEC "} ${nom} ${detail}`); if (!condition) echecs++; };
async function session(email) {
  const c = createClient(url, pub, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
const { data: cies } = await admin.from("compagnies").select("id, sigle");
const id = Object.fromEntries(cies.map((c) => [c.sigle, c.id]));
const { count: total } = await admin.from("sinistres").select("id", { count: "exact", head: true });
const { count: totalTeranga } = await admin.from("sinistres").select("id", { count: "exact", head: true }).eq("compagnie_id", id.TERANGA);

// --- Anonyme
const anon = createClient(url, pub, { auth: { persistSession: false } });
const a1 = await anon.from("sinistres").select("id").limit(5);
verifier("anonyme : aucun sinistre lisible", (a1.data ?? []).length === 0, a1.error ? `(${a1.error.code})` : "");
const a2 = await anon.from("compagnies").select("id").limit(5);
verifier("anonyme : aucune compagnie lisible", (a2.data ?? []).length === 0, a2.error ? `(${a2.error.code})` : "");
const a3 = await anon.rpc("statistiques");
verifier("anonyme : statistiques refusées", Boolean(a3.error), a3.error ? `(${a3.error.code})` : "");
const a4 = await anon.storage.from("pieces").list();
verifier("anonyme : stockage non listable", (a4.data ?? []).length === 0);

// --- Gestionnaire
const g = await session("gestionnaire@demo.awa-sinistres.app");
const g1 = await g.from("sinistres").select("id", { count: "exact", head: true });
verifier("gestionnaire : voit tous les sinistres", g1.count === total, `(${g1.count}/${total})`);

// --- Admin TERANGA
const t = await session("admin.teranga@demo.awa-sinistres.app");
const t1 = await t.from("sinistres").select("id, compagnie_id");
verifier("admin TERANGA : ne voit que ses sinistres", t1.data.length === totalTeranga && t1.data.every((s) => s.compagnie_id === id.TERANGA), `(${t1.data.length}/${totalTeranga})`);
const { data: unBaobab } = await admin.from("sinistres").select("id, numero").eq("compagnie_id", id.BAOBAB).limit(1).single();
const t2 = await t.from("sinistres").select("id").eq("id", unBaobab.id);
verifier("admin TERANGA : dossier BAOBAB invisible", t2.data.length === 0);
const t3 = await t.from("sinistres").update({ assure_nom: "PIRATE" }).eq("id", unBaobab.id).select("id");
verifier("admin TERANGA : ne peut pas modifier un dossier BAOBAB", (t3.data ?? []).length === 0);
const t4 = await t.from("documents").select("id").eq("sinistre_id", unBaobab.id);
verifier("admin TERANGA : pièces BAOBAB invisibles", t4.data.length === 0);
const t5 = await t.from("reglements").select("id").eq("sinistre_id", unBaobab.id);
verifier("admin TERANGA : règlements BAOBAB invisibles", t5.data.length === 0);
const t6 = await t.from("profils").select("id, compagnie_id");
verifier("admin TERANGA : ne voit que les profils de sa compagnie", t6.data.every((p) => p.compagnie_id === id.TERANGA), `(${t6.data.length} profils)`);
const t7 = await t.from("profils").update({ role: "gestionnaire", compagnie_id: null }).eq("email", "admin.teranga@demo.awa-sinistres.app").select("id");
verifier("admin TERANGA : ne peut pas s'auto-promouvoir gestionnaire", (t7.data ?? []).length === 0, t7.error ? `(${t7.error.code})` : "");
const t8 = await t.from("compagnies").insert({ nom: "Pirate", sigle: "PIR", code: "PIR" }).select("id");
verifier("admin TERANGA : ne peut pas créer de compagnie", Boolean(t8.error), t8.error ? `(${t8.error.code})` : "");
const t9 = await t.from("sinistres").insert({ compagnie_id: id.BAOBAB, branche_id: (await admin.from("branches").select("id").limit(1).single()).data.id, numero_police: "X", assure_nom: "X", date_survenance: new Date().toISOString() }).select("id");
verifier("admin TERANGA : ne peut pas créer un dossier pour BAOBAB", Boolean(t9.error), t9.error ? `(${t9.error.code})` : "");
const t10 = await t.rpc("statistiques");
verifier("admin TERANGA : statistiques limitées à sa compagnie", t10.data?.totaux.total === totalTeranga, `(${t10.data?.totaux.total})`);

// Vue adverse : colonnes restreintes
const tv = await t.from("sinistres_adverses").select("*");
const colonnes = tv.data[0] ? Object.keys(tv.data[0]) : [];
verifier("vue adverse : accessible, sans montants ni jeton", tv.data.every((s) => s.compagnie_adverse_id === id.TERANGA) && !colonnes.some((c) => /montant|jeton|assure_telephone|assure_email/.test(c)), `(${tv.data.length} dossiers, ${colonnes.length} colonnes)`);
const tr = await t.from("recours").select("id, compagnie_emettrice_id, compagnie_adverse_id");
verifier("admin TERANGA : ne voit que les recours qui le concernent", tr.data.every((r) => r.compagnie_emettrice_id === id.TERANGA || r.compagnie_adverse_id === id.TERANGA), `(${tr.data.length})`);
// Messages internes d'un dossier où TERANGA est adverse
if (tv.data[0]) {
  const tm = await t.from("messages").select("canal").eq("sinistre_id", tv.data[0].id);
  verifier("compagnie adverse : aucun message interne ou client visible", tm.data.every((m) => m.canal === "adverse"), `(${tm.data.length})`);
  const te = await t.from("evenements").select("id").eq("sinistre_id", tv.data[0].id);
  verifier("compagnie adverse : historique du dossier invisible", te.data.length === 0);
  const tdoc = await t.from("documents").select("visible_adverse").eq("sinistre_id", tv.data[0].id);
  verifier("compagnie adverse : seules les pièces partagées sont visibles", tdoc.data.every((d) => d.visible_adverse), `(${tdoc.data.length})`);
}

// --- Champs réservés et suspension d'une compagnie
const telephoneInitial = (await admin.from("compagnies").select("telephone").eq("id", id.TERANGA).single()).data.telephone;
const t11 = await t.from("compagnies").update({ nom: "Renommée", telephone: "+221 33 000 00 00" }).eq("id", id.TERANGA).select("nom, telephone");
verifier("admin TERANGA : peut changer ses coordonnées mais pas son nom", t11.data?.[0]?.nom !== "Renommée" && t11.data?.[0]?.telephone === "+221 33 000 00 00");
await admin.from("compagnies").update({ telephone: telephoneInitial }).eq("id", id.TERANGA); // remise en état
await admin.from("compagnies").update({ actif: false }).eq("id", id.TERANGA);
const t12 = await t.from("sinistres").select("id").limit(5);
verifier("compagnie suspendue : plus aucun sinistre lisible", (t12.data ?? []).length === 0);
const t13 = await t.from("compagnies").update({ actif: true }).eq("id", id.TERANGA).select("actif");
const { data: etat } = await admin.from("compagnies").select("actif").eq("id", id.TERANGA).single();
verifier("compagnie suspendue : son administrateur ne peut pas la réactiver", etat.actif === false, `(${(t13.data ?? []).length} ligne modifiée)`);
await admin.from("compagnies").update({ actif: true }).eq("id", id.TERANGA);
const t14 = await t.from("sinistres").select("id", { count: "exact", head: true });
verifier("compagnie rétablie : accès retrouvé", t14.count === totalTeranga, `(${t14.count})`);

// --- Agent limité (assistant : pièces + communication)
const ag = await session("agent2.teranga@demo.awa-sinistres.app");
const { data: unTeranga } = await admin.from("sinistres").select("id, assure_nom").eq("compagnie_id", id.TERANGA).limit(1).single();
const ag1 = await ag.from("sinistres").select("id").eq("id", unTeranga.id);
verifier("agent limité : peut consulter un dossier de sa compagnie", ag1.data.length === 1);
const ag2 = await ag.from("sinistres").update({ statut: "clos" }).eq("id", unTeranga.id).select("id");
verifier("agent limité : ne peut pas modifier le dossier", (ag2.data ?? []).length === 0);
const ag3 = await ag.from("reglements").insert({ sinistre_id: unTeranga.id, beneficiaire: "Moi", montant: 1000 }).select("id");
verifier("agent limité : ne peut pas créer de règlement", Boolean(ag3.error), ag3.error ? `(${ag3.error.code})` : "");
const ag4 = await ag.from("offres").insert({ sinistre_id: unTeranga.id, montant: 1000 }).select("id");
verifier("agent limité : ne peut pas émettre d'offre", Boolean(ag4.error), ag4.error ? `(${ag4.error.code})` : "");
const ag5 = await ag.from("documents").insert({ sinistre_id: unTeranga.id, libelle: "Pièce de test RLS" }).select("id");
verifier("agent limité : peut demander une pièce (permission accordée)", !ag5.error && ag5.data.length === 1, ag5.error ? `(${ag5.error.message})` : "");
if (ag5.data?.[0]) await admin.from("documents").delete().eq("id", ag5.data[0].id);
const ag6 = await ag.from("profils").update({ permissions: ["reglements.valider"] }).eq("email", "agent2.teranga@demo.awa-sinistres.app").select("id");
verifier("agent limité : ne peut pas s'accorder de permissions", (ag6.data ?? []).length === 0);

console.log(echecs === 0 ? "\nTous les contrôles de cloisonnement passent." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
