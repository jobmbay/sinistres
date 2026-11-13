// Jeu de données de démonstration.
//
//   npm run demo           crée 5 compagnies, leurs comptes et ~70 sinistres fictifs
//   npm run demo:purger    supprime tout ce que la démonstration a créé
//
// Tout ce qui est créé ici est reconnaissable : les compagnies ont un code
// « DEMO-… » et les comptes une adresse en « @demo.awa-sinistres.app ».
// La purge ne touche à rien d'autre.

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SECRET_KEY;
if (!url || !cle) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY manquant (lancez avec : node --env-file=.env).");
  process.exit(1);
}
const supabase = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

const DOMAINE = "demo.awa-sinistres.app";
const PREFIXE = "DEMO-";
const JOUR = 86_400_000;

/* ------------------------------------------------------------------ */
/*  Hasard reproductible                                               */
/* ------------------------------------------------------------------ */
let graine = 20261113;
const hasard = () => {
  graine = (graine * 1664525 + 1013904223) % 4294967296;
  return graine / 4294967296;
};
const entre = (min, max) => Math.floor(min + hasard() * (max - min + 1));
const parmi = (liste) => liste[Math.floor(hasard() * liste.length)];
const chance = (p) => hasard() < p;
const pondere = (paires) => {
  const total = paires.reduce((s, [, poids]) => s + poids, 0);
  let tirage = hasard() * total;
  for (const [valeur, poids] of paires) {
    tirage -= poids;
    if (tirage <= 0) return valeur;
  }
  return paires[paires.length - 1][0];
};
const arrondi = (n, pas = 5000) => Math.max(pas, Math.round(n / pas) * pas);
const ok = (resultat, contexte) => {
  if (resultat.error) throw new Error(`${contexte} : ${resultat.error.message}`);
  return resultat.data;
};

/* ------------------------------------------------------------------ */
/*  Purge                                                              */
/* ------------------------------------------------------------------ */
async function purger() {
  const compagnies = ok(await supabase.from("compagnies").select("id").like("code", `${PREFIXE}%`), "Lecture des compagnies");
  const ids = compagnies.map((c) => c.id);

  if (ids.length > 0) {
    const sinistres = ok(await supabase.from("sinistres").select("id").in("compagnie_id", ids), "Lecture des sinistres");
    // Fichiers de démonstration dans le stockage
    const pieces = ok(
      await supabase.from("documents").select("chemin").in("sinistre_id", sinistres.map((s) => s.id)).not("chemin", "is", null),
      "Lecture des pièces",
    );
    for (let i = 0; i < pieces.length; i += 100) {
      await supabase.storage.from("pieces").remove(pieces.slice(i, i + 100).map((p) => p.chemin));
    }
    ok(await supabase.from("sinistres").delete().in("compagnie_id", ids), "Suppression des sinistres");
  }

  const profils = ok(await supabase.from("profils").select("id").like("email", `%@${DOMAINE}`), "Lecture des comptes");
  for (const profil of profils) await supabase.auth.admin.deleteUser(profil.id);

  if (ids.length > 0) ok(await supabase.from("compagnies").delete().in("id", ids), "Suppression des compagnies");
  console.log(`Purge terminée : ${ids.length} compagnie(s) et ${profils.length} compte(s) de démonstration supprimés.`);
}

/* ------------------------------------------------------------------ */
/*  Données de référence fictives                                      */
/* ------------------------------------------------------------------ */
const COMPAGNIES = [
  { sigle: "TERANGA", nom: "Teranga Assurances", ville: "Dakar", telephone: "+221 33 800 10 10", poids: 30 },
  { sigle: "BAOBAB", nom: "Baobab Assurances", ville: "Dakar", telephone: "+221 33 800 20 20", poids: 24 },
  { sigle: "SAHEL", nom: "Sahel Mutuelle", ville: "Thiès", telephone: "+221 33 800 30 30", poids: 18 },
  { sigle: "KORA", nom: "Kora Assurances", ville: "Saint-Louis", telephone: "+221 33 800 40 40", poids: 16 },
  { sigle: "FLEUVE", nom: "Fleuve IARD", ville: "Kaolack", telephone: "+221 33 800 50 50", poids: 12 },
];

const PRENOMS = ["Moussa", "Fatou", "Ibrahima", "Aminata", "Cheikh", "Mariama", "Ousmane", "Khady", "Abdoulaye", "Ndeye", "Mamadou", "Aïssatou", "Babacar", "Coumba", "Pape", "Astou", "Serigne", "Dieynaba", "Alioune", "Rokhaya"];
const NOMS = ["Ndiaye", "Diop", "Fall", "Sow", "Ba", "Gueye", "Faye", "Sarr", "Diallo", "Sy", "Cissé", "Mbaye", "Thiam", "Kane", "Seck", "Diouf", "Ndour", "Camara", "Wade", "Touré"];
const ENTREPRISES = ["Sénégal Logistique SARL", "Boulangerie Keur Yaay", "Transports Ndiambour", "Pharmacie du Plateau", "Imprimerie Sandaga", "Hôtel Les Filaos", "Quincaillerie Médina", "Agro Niayes SA", "Clinique de la Paix", "Menuiserie Baol"];
const VILLES = ["Dakar", "Dakar", "Dakar", "Thiès", "Saint-Louis", "Mbour", "Kaolack", "Ziguinchor", "Touba", "Rufisque"];
const LIEUX = ["Avenue Cheikh Anta Diop", "Route de Ouakam", "VDN, à hauteur de Sacré-Cœur", "Corniche Ouest", "Autoroute à péage, sortie Pikine", "Rond-point Liberté 6", "Avenue Blaise Diagne", "Zone industrielle", "Route nationale 1", "Quartier Escale"];
const VEHICULES = ["Toyota Corolla", "Peugeot 301", "Hyundai Tucson", "Renault Duster", "Kia Picanto", "Toyota Hilux", "Mitsubishi L200", "Dacia Logan"];
const EXPERTS = [
  { nom: "Mamadou Lamine Sy", cabinet: "Expertises du Cap-Vert", telephone: "+221 77 510 22 01" },
  { nom: "Ibrahima Kane", cabinet: "Sahel Expertise Auto", telephone: "+221 77 510 22 02" },
  { nom: "Dr Aïda Mbengue", cabinet: "Cabinet médical des Almadies", telephone: "+221 77 510 22 03" },
  { nom: "Jean-Pierre Mendy", cabinet: "Bureau Technique Ndar", telephone: "+221 77 510 22 04" },
];

const BRANCHES = {
  AUTO: { poids: 40, montant: [150_000, 3_500_000], circonstances: [
    "Collision à une intersection : le véhicule adverse n'a pas respecté la priorité. Dégâts sur l'aile et la portière avant gauches.",
    "Choc arrière dans un embouteillage. Pare-chocs et hayon enfoncés, feux arrière brisés.",
    "Véhicule en stationnement heurté par un tiers lors d'une manœuvre. Rayures profondes et rétroviseur arraché.",
    "Sortie de route par temps de pluie, le véhicule a percuté un terre-plein. Train avant endommagé.",
  ] },
  SANTE: { poids: 18, montant: [25_000, 900_000], circonstances: [
    "Hospitalisation de trois jours à la suite d'une crise de paludisme sévère.",
    "Intervention chirurgicale programmée (appendicectomie) avec deux nuits d'hospitalisation.",
    "Consultations spécialisées et analyses biologiques prescrites par le médecin traitant.",
  ] },
  MRH: { poids: 10, montant: [100_000, 2_500_000], circonstances: [
    "Rupture d'une canalisation dans la salle de bains : dégât des eaux sur le plafond et les murs du séjour.",
    "Cambriolage en l'absence des occupants : porte fracturée, téléviseur, ordinateur et bijoux dérobés.",
    "Court-circuit dans la cuisine : début d'incendie maîtrisé, électroménager et mobilier endommagés.",
  ] },
  INC: { poids: 7, montant: [1_000_000, 40_000_000], circonstances: [
    "Incendie d'origine électrique dans l'entrepôt : stock de marchandises et toiture détruits en partie.",
    "Explosion d'une bouteille de gaz dans l'atelier, dégâts importants sur les équipements.",
  ] },
  TRANS: { poids: 6, montant: [500_000, 25_000_000], circonstances: [
    "Avarie constatée au déchargement du conteneur : cartons mouillés, marchandise invendable.",
    "Manquant de douze colis constaté à la livraison, réserves portées sur le bon du transporteur.",
  ] },
  RC: { poids: 5, montant: [300_000, 12_000_000], circonstances: [
    "Chute d'un client dans les locaux, sur un sol mouillé non signalé. Fracture du poignet.",
    "Dommages causés au véhicule d'un tiers lors d'une livraison sur chantier.",
  ] },
  IA: { poids: 5, montant: [200_000, 6_000_000], circonstances: [
    "Chute dans un escalier sur le lieu de travail. Entorse grave et arrêt de quatre semaines.",
    "Accident de moto : fracture de la jambe, hospitalisation et rééducation.",
  ] },
  MRP: { poids: 4, montant: [400_000, 15_000_000], circonstances: [
    "Effraction du commerce pendant la nuit : caisse fracturée, marchandises et matériel informatique volés.",
    "Infiltration d'eau après de fortes pluies : stock et faux plafond endommagés.",
  ] },
  VIE: { poids: 3, montant: [2_000_000, 20_000_000], circonstances: [
    "Décès de l'assuré des suites d'une longue maladie. Demande de versement du capital au bénéficiaire désigné.",
  ] },
  RT: { poids: 2, montant: [1_000_000, 30_000_000], circonstances: [
    "Bris du groupe électrogène principal à la suite d'une surtension. Arrêt de la production.",
  ] },
};

/** PDF minimal d'une page, pour que le téléchargement des pièces fonctionne. */
function pdfDeDemonstration(titre) {
  const texte = titre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");
  const flux = `BT /F1 16 Tf 60 760 Td (Piece de demonstration) Tj 0 -28 Td /F1 12 Tf (${texte}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const positions = objets.map((objet, i) => {
    const position = pdf.length;
    pdf += `${i + 1} 0 obj\n${objet}\nendobj\n`;
    return position;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  pdf += positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/* ------------------------------------------------------------------ */
/*  Création                                                           */
/* ------------------------------------------------------------------ */
async function creerCompte({ email, prenom, nom, role, compagnieId, fonction, permissions, motDePasse }) {
  const creation = await supabase.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (creation.error) throw new Error(`Compte ${email} : ${creation.error.message}`);
  const id = creation.data.user.id;
  ok(
    await supabase.from("profils").insert({
      id, role, compagnie_id: compagnieId ?? null, prenom, nom, email, fonction,
      permissions: permissions ?? [], doit_changer_mdp: false,
    }),
    `Profil ${email}`,
  );
  return { id, prenom, nom, email, role, compagnieId };
}

async function semer() {
  const existantes = ok(await supabase.from("compagnies").select("id").like("code", `${PREFIXE}%`), "Vérification");
  if (existantes.length > 0) {
    console.error("Des données de démonstration existent déjà. Lancez d'abord : npm run demo:purger");
    process.exit(1);
  }

  const motDePasse = `Demo-${randomBytes(6).toString("base64url")}-26`;
  const branches = ok(await supabase.from("branches").select("id, code, pieces_requises"), "Lecture des branches");
  const types = ok(await supabase.from("types_sinistre").select("id, branche_id, nom"), "Lecture des types");
  const brancheParCode = Object.fromEntries(branches.map((b) => [b.code, b]));

  /* ---------- Compagnies et comptes ---------- */
  console.log("Création des compagnies et des comptes…");
  const compagnies = ok(
    await supabase
      .from("compagnies")
      .insert(
        COMPAGNIES.map((c) => ({
          nom: c.nom, sigle: c.sigle, code: `${PREFIXE}${c.sigle}`, ville: c.ville, telephone: c.telephone,
          email: `contact@${c.sigle.toLowerCase()}.${DOMAINE}`, adresse: "Immeuble de démonstration", pays: "Sénégal",
        })),
      )
      .select("id, sigle, nom"),
    "Création des compagnies",
  ).map((c) => ({ ...c, ...COMPAGNIES.find((x) => x.sigle === c.sigle) }));

  const gestionnaire = await creerCompte({
    email: `gestionnaire@${DOMAINE}`, prenom: "Awa", nom: "Diop", role: "gestionnaire",
    fonction: "Gestionnaire de la plateforme", motDePasse,
  });

  const REDACTEUR = ["sinistres.creer", "sinistres.modifier", "documents.gerer", "expertises.gerer", "communication.gerer", "evaluation.gerer", "reglements.gerer", "recours.gerer", "rapports.consulter"];
  const ASSISTANT = ["documents.gerer", "communication.gerer"];
  const equipes = {};
  for (const compagnie of compagnies) {
    const sigle = compagnie.sigle.toLowerCase();
    equipes[compagnie.id] = [
      await creerCompte({ email: `admin.${sigle}@${DOMAINE}`, prenom: parmi(PRENOMS), nom: parmi(NOMS), role: "admin_compagnie", compagnieId: compagnie.id, fonction: "Responsable sinistres", motDePasse }),
      await creerCompte({ email: `agent1.${sigle}@${DOMAINE}`, prenom: parmi(PRENOMS), nom: parmi(NOMS), role: "agent", compagnieId: compagnie.id, fonction: "Rédacteur sinistres", permissions: REDACTEUR, motDePasse }),
      await creerCompte({ email: `agent2.${sigle}@${DOMAINE}`, prenom: parmi(PRENOMS), nom: parmi(NOMS), role: "agent", compagnieId: compagnie.id, fonction: "Assistant de gestion", permissions: ASSISTANT, motDePasse }),
    ];
  }

  /* ---------- Sinistres ---------- */
  console.log("Génération des sinistres…");
  const maintenant = Date.now();
  const lots = { sinistres: [], documents: [], expertises: [], offres: [], reglements: [], recours: [], messages: [], evenements: [] };
  const fichiers = [];

  const TOTAL = 72;
  for (let i = 0; i < TOTAL; i++) {
    const compagnie = pondere(compagnies.map((c) => [c, c.poids]));
    const code = pondere(Object.entries(BRANCHES).map(([c, b]) => [c, b.poids]));
    const gabarit = BRANCHES[code];
    const branche = brancheParCode[code];
    const equipe = equipes[compagnie.id];
    const agent = chance(0.2) ? gestionnaire : chance(0.6) ? equipe[1] : equipe[0];
    const nomAgent = `${agent.prenom} ${agent.nom}`;

    // Âge du dossier : davantage de dossiers récents, quelques-uns de près d'un an.
    const age = Math.floor(Math.pow(hasard(), 1.35) * 350) + 1;
    const declaration = maintenant - age * JOUR - entre(0, 8) * 3_600_000;
    const survenance = declaration - entre(0, 4) * JOUR - entre(1, 10) * 3_600_000;

    const statut =
      age < 10 ? pondere([["declare", 5], ["en_instruction", 5]])
      : age < 30 ? pondere([["en_instruction", 4], ["expertise", 3], ["evaluation", 3]])
      : age < 60 ? pondere([["expertise", 2], ["evaluation", 3], ["accord", 2], ["reglement", 2], ["rejete", 1]])
      : pondere([["clos", 62], ["rejete", 8], ["sans_suite", 4], ["contentieux", 5], ["reglement", 9], ["evaluation", 6], ["accord", 6]]);
    const etape = { declare: 0, en_instruction: 1, expertise: 2, evaluation: 3, accord: 4, reglement: 5, clos: 6, contentieux: 3, rejete: 1, sans_suite: 1 }[statut];

    const entreprise = ["MRP", "TRANS", "RC", "INC", "RT"].includes(code);
    const assure = entreprise ? parmi(ENTREPRISES) : `${parmi(PRENOMS)} ${parmi(NOMS)}`;
    const estime = arrondi(gabarit.montant[0] + Math.pow(hasard(), 2.2) * (gabarit.montant[1] - gabarit.montant[0]));
    const avecAdverse = code === "AUTO" ? chance(0.72) : code === "RC" || code === "TRANS" ? chance(0.3) : false;
    const adverse = avecAdverse ? parmi(compagnies.filter((c) => c.id !== compagnie.id)) : null;
    const taux = adverse ? parmi([0, 0, 0, 25, 50, 50, 100]) : null;

    const id = randomUUID();
    const details = {};
    if (code === "AUTO") {
      details.immatriculation = `DK-${entre(1000, 9999)}-${parmi(["AB", "BC", "AF", "BH", "AK"])}`;
      details.vehicule = parmi(VEHICULES);
      details.conducteur = entreprise ? `${parmi(PRENOMS)} ${parmi(NOMS)}` : assure;
    } else if (code === "SANTE") {
      details.beneficiaire = parmi(["Assuré principal", "Conjoint", "Enfant"]);
      details.prestataire = parmi(["Clinique de la Madeleine", "Hôpital Principal de Dakar", "Clinique du Cap"]);
    } else if (code === "TRANS") {
      details.marchandise = parmi(["Riz en sacs", "Matériel électronique", "Pièces détachées", "Produits pharmaceutiques"]);
      details.trajet = parmi(["Dakar – Bamako", "Port de Dakar – Thiès", "Dakar – Banjul"]);
    }

    let instant = declaration;
    const avancer = (joursMin, joursMax) => {
      instant = Math.min(maintenant - 3_600_000, instant + entre(joursMin, joursMax) * JOUR + entre(1, 9) * 3_600_000);
      return new Date(instant).toISOString();
    };
    const noter = (type, titre, description, visible, auteur = nomAgent, quand = new Date(instant).toISOString()) =>
      lots.evenements.push({ sinistre_id: id, type, titre, description: description ?? null, visible_client: visible, auteur_nom: auteur, auteur_id: auteur === nomAgent ? agent.id : null, created_at: quand });

    noter("declaration", "Sinistre déclaré", "Dossier ouvert.", true);

    /* Pièces */
    const requises = branche.pieces_requises;
    requises.forEach((libelle, k) => {
      // Plus le dossier avance, plus les pièces sont réunies.
      const recue = etape >= 2 ? chance(0.95) : etape === 1 ? chance(0.55) : chance(0.15);
      const validee = recue && (etape >= 2 || chance(0.5));
      const piece = { id: randomUUID(), sinistre_id: id, libelle, statut: recue ? (validee ? "valide" : "recu") : "demande", source: "client", visible_client: true, visible_adverse: false, commentaire: null, chemin: null, nom_fichier: null, taille: null, mime: null, recu_le: null, created_at: new Date(declaration + k).toISOString() };
      if (recue) {
        const contenu = pdfDeDemonstration(libelle);
        piece.chemin = `${id}/${randomUUID()}-piece-demo.pdf`;
        piece.nom_fichier = `${libelle.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, "-").slice(0, 40)}.pdf`;
        piece.taille = contenu.length;
        piece.mime = "application/pdf";
        piece.recu_le = new Date(declaration + entre(1, Math.max(2, Math.min(age - 1, 12))) * JOUR).toISOString();
        piece.visible_adverse = Boolean(adverse) && k < 2 && etape >= 5;
        fichiers.push({ chemin: piece.chemin, contenu });
      }
      lots.documents.push(piece);
    });

    if (etape >= 1 && statut !== "rejete" && statut !== "sans_suite") {
      avancer(1, 3);
      noter("statut", "Statut : En instruction", "Vérification des garanties et collecte des pièces.", true);
    }

    /* Expertise */
    let evalue = null;
    const besoinExpert = ["AUTO", "MRH", "INC", "MRP", "TRANS", "RT", "IA"].includes(code);
    if (etape >= 2 && besoinExpert && statut !== "rejete" && statut !== "sans_suite") {
      const expert = code === "IA" ? EXPERTS[2] : code === "AUTO" ? parmi(EXPERTS.slice(0, 2)) : EXPERTS[3];
      const mission = avancer(1, 5);
      const rapportRecu = etape >= 3;
      evalue = rapportRecu ? arrondi(estime * (0.75 + hasard() * 0.4)) : null;
      noter("expertise", `${code === "IA" ? "Expertise médicale" : "Expertise matérielle"} confiée à ${expert.nom}`, null, true);
      const rapport = rapportRecu ? avancer(4, 12) : null;
      if (rapportRecu) noter("expertise", "Rapport d'expertise reçu", `Rapport de ${expert.nom} enregistré au dossier.`, true);
      lots.expertises.push({
        sinistre_id: id, nature: code === "IA" ? "medicale" : "materielle", expert_nom: expert.nom, expert_cabinet: expert.cabinet,
        expert_telephone: expert.telephone, expert_email: null, statut: rapportRecu ? "rapport_recu" : parmi(["missionnee", "en_cours"]),
        date_mission: mission.slice(0, 10), date_visite: rapportRecu || chance(0.5) ? new Date(Date.parse(mission) + 3 * JOUR).toISOString().slice(0, 10) : null,
        date_rapport: rapport ? rapport.slice(0, 10) : null, montant_evalue: evalue, honoraires: rapportRecu ? arrondi(estime * 0.03 + 40_000) : null,
        conclusions: rapportRecu ? "Dommages constatés conformes à la déclaration. Chiffrage établi sur devis contradictoire, vétusté déduite." : null,
        created_at: mission,
      });
    }

    /* Offre */
    let accorde = null;
    if (etape >= 3 && statut !== "rejete" && statut !== "sans_suite") {
      const montantOffre = arrondi((evalue ?? estime) * (0.88 + hasard() * 0.1));
      const envoi = avancer(2, 6);
      noter("offre", "Offre d'indemnisation transmise", `Montant proposé : ${montantOffre.toLocaleString("fr-FR")} FCFA.`, true);
      const acceptee = etape >= 4;
      const refusee = statut === "contentieux";
      const reponse = acceptee || refusee ? avancer(1, 7) : null;
      if (acceptee) {
        accorde = montantOffre;
        noter("offre", "Offre acceptée par l'assuré", `Accord sur ${montantOffre.toLocaleString("fr-FR")} FCFA.`, true, `${assure} (assuré)`);
      } else if (refusee) {
        noter("offre", "Offre refusée par l'assuré", "Montant jugé insuffisant au regard du devis de réparation.", true, `${assure} (assuré)`);
        avancer(2, 6);
        noter("statut", "Statut : Contentieux", "Désaccord persistant sur le montant de l'indemnité.", true);
      }
      lots.offres.push({
        sinistre_id: id, montant: montantOffre,
        detail: "Indemnité calculée sur la base du rapport d'expertise, franchise contractuelle et vétusté déduites.",
        statut: acceptee ? "acceptee" : refusee ? "refusee" : "envoyee",
        reponse_motif: refusee ? "Montant jugé insuffisant au regard du devis de réparation." : null,
        repondu_par: reponse ? `${assure} (espace de suivi)` : null, date_envoi: envoi, date_reponse: reponse, cree_par: agent.id, created_at: envoi,
      });
    }

    /* Règlement */
    let cloture = null;
    if (etape >= 5 && accorde) {
      const preparation = avancer(1, 5);
      const paye = statut === "clos" || chance(0.3);
      noter("reglement", "Règlement préparé — Indemnité", `${accorde.toLocaleString("fr-FR")} FCFA pour ${assure}.`, false);
      let datePaiement = null;
      if (paye) {
        datePaiement = avancer(2, 8);
        noter("reglement", "Règlement effectué", `${accorde.toLocaleString("fr-FR")} FCFA — ${assure}.`, true);
      }
      lots.reglements.push({
        sinistre_id: id, beneficiaire: assure, nature: "indemnite", montant: accorde, mode: parmi(["virement", "virement", "cheque", "mobile_money"]),
        reference: paye ? `VIR-${entre(100000, 999999)}` : null, statut: paye ? "paye" : parmi(["en_attente", "valide"]),
        date_reglement: datePaiement ? datePaiement.slice(0, 10) : null, cree_par: agent.id, valide_par: paye ? equipe[0].id : null, created_at: preparation,
      });
      if (statut === "clos") {
        cloture = avancer(1, 4);
        noter("statut", "Statut : Clôturé", "Le dossier est réglé et clôturé.", true);
      }
    }

    let motif = null;
    if (statut === "rejete" || statut === "sans_suite") {
      cloture = avancer(5, 20);
      motif = statut === "rejete"
        ? parmi(["Garantie non souscrite au contrat pour ce type d'événement.", "Sinistre survenu pendant une période de suspension des garanties pour non-paiement de la prime.", "Déclaration hors délai et circonstances non établies."])
        : "Sans nouvelles de l'assuré malgré plusieurs relances ; pièces jamais transmises.";
      noter("statut", `Statut : ${statut === "rejete" ? "Rejeté" : "Sans suite"}`, motif, true);
    }
    if (statut === "contentieux") motif = "Désaccord persistant sur le montant de l'indemnité.";

    /* Recours */
    if (adverse && (taux ?? 100) <= 50 && etape >= 4 && accorde) {
      const part = 1 - (taux ?? 0) / 100;
      const reclame = arrondi(accorde * part);
      const emission = avancer(1, 6);
      const etat = statut === "clos" ? pondere([["regle", 5], ["accepte", 2], ["conteste", 2], ["emis", 2]]) : pondere([["emis", 5], ["accepte", 2], ["conteste", 2]]);
      const repondu = etat !== "emis";
      lots.recours.push({
        sinistre_id: id, compagnie_emettrice_id: compagnie.id, compagnie_adverse_id: adverse.id, montant_reclame: reclame,
        montant_accorde: etat === "accepte" || etat === "regle" ? reclame : null, statut: etat,
        motif: `Responsabilité de votre assuré engagée à ${Math.round(part * 100)} % selon le constat amiable et le rapport d'expertise.`,
        reponse: etat === "conteste" ? "Nous contestons le partage de responsabilité : notre assuré déclare que le feu était au vert." : null,
        date_emission: emission, date_reponse: repondu ? new Date(Math.min(maintenant, Date.parse(emission) + entre(3, 15) * JOUR)).toISOString() : null,
        date_reglement: etat === "regle" ? new Date(Math.min(maintenant, Date.parse(emission) + entre(18, 40) * JOUR)).toISOString() : null,
        cree_par: agent.id, created_at: emission,
      });
      noter("recours", `Recours émis contre ${adverse.nom}`, `Montant réclamé : ${reclame.toLocaleString("fr-FR")} FCFA.`, false, nomAgent, emission);
    }

    /* Échanges */
    if (chance(0.4)) {
      const question = new Date(Math.min(maintenant - 7_200_000, declaration + entre(2, Math.max(3, Math.min(age, 20))) * JOUR)).toISOString();
      lots.messages.push({ sinistre_id: id, canal: "client", auteur_type: "client", auteur_id: null, auteur_nom: assure, contenu: parmi(["Bonjour, avez-vous bien reçu les documents que j'ai envoyés ?", "Bonjour, dans quel délai puis-je espérer le règlement ?", "Bonjour, l'expert ne m'a pas encore contacté. Pouvez-vous le relancer ?", "Bonjour, j'ai une question sur la franchise appliquée à mon dossier."]), created_at: question });
      if (chance(0.7)) {
        lots.messages.push({ sinistre_id: id, canal: "client", auteur_type: "agent", auteur_id: agent.id, auteur_nom: nomAgent, contenu: parmi(["Bonjour, nous avons bien reçu vos pièces. Votre dossier suit son cours.", "Bonjour, je relance l'expert aujourd'hui et je reviens vers vous.", "Bonjour, le règlement interviendra sous dix jours après votre accord."]), created_at: new Date(Math.min(maintenant - 3_600_000, Date.parse(question) + entre(2, 30) * 3_600_000)).toISOString() });
      }
    }
    if (chance(0.3)) {
      lots.messages.push({ sinistre_id: id, canal: "interne", auteur_type: "agent", auteur_id: agent.id, auteur_nom: nomAgent, contenu: parmi(["Assuré joint par téléphone : il transmet le devis cette semaine.", "Vérification faite : prime à jour, garantie acquise.", "Attention, deuxième sinistre de l'année sur ce contrat."]), created_at: new Date(declaration + JOUR).toISOString() });
    }

    const termine = ["clos", "rejete", "sans_suite"].includes(statut);
    lots.sinistres.push({
      id, compagnie_id: compagnie.id, compagnie_adverse_id: adverse?.id ?? null, branche_id: branche.id,
      type_sinistre_id: parmi(types.filter((t) => t.branche_id === branche.id))?.id ?? null,
      statut, priorite: pondere([["normale", 70], ["haute", 18], ["urgente", 6], ["basse", 6]]),
      numero_police: `${code}-${new Date(declaration).getUTCFullYear() - entre(0, 2)}-${String(entre(1000, 99999)).padStart(6, "0")}`,
      assure_nom: assure, assure_telephone: `+221 7${parmi([0, 6, 7, 8])} ${entre(100, 999)} ${entre(10, 99)} ${entre(10, 99)}`,
      assure_email: chance(0.6) ? `${assure.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@exemple.sn` : null,
      assure_adresse: `${parmi(["Sicap Liberté", "Parcelles Assainies", "Mermoz", "Point E", "Grand Yoff", "Médina"])}, ${parmi(VILLES)}`,
      date_survenance: new Date(survenance).toISOString(), date_declaration: new Date(declaration).toISOString().slice(0, 10),
      lieu: parmi(LIEUX), ville: parmi(VILLES), circonstances: parmi(gabarit.circonstances), details,
      tiers_nom: adverse ? `${parmi(PRENOMS)} ${parmi(NOMS)}` : null, tiers_telephone: null,
      tiers_police: adverse ? `AUTO-2025-${String(entre(1000, 99999)).padStart(6, "0")}` : null,
      tiers_details: adverse && code === "AUTO" ? `${parmi(VEHICULES)} immatriculé DK-${entre(1000, 9999)}-${parmi(["AC", "BD", "AG"])}` : null,
      taux_responsabilite: taux, montant_estime: estime, montant_provision: termine ? 0 : (accorde ?? evalue ?? estime),
      montant_franchise: code === "AUTO" ? 50_000 : 0, gestionnaire_id: agent.id, cree_par: agent.id,
      motif_cloture: motif, date_cloture: termine ? cloture : null, created_at: new Date(declaration).toISOString(),
    });
  }

  /* ---------- Insertion ---------- */
  console.log(`Insertion de ${lots.sinistres.length} sinistres et de leur contenu…`);
  const inserer = async (table, lignes) => {
    for (let i = 0; i < lignes.length; i += 200) ok(await supabase.from(table).insert(lignes.slice(i, i + 200)), `Insertion ${table}`);
  };
  // Ordre chronologique : les numéros de dossier suivent la date de déclaration.
  lots.sinistres.sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const sinistre of lots.sinistres) ok(await supabase.from("sinistres").insert(sinistre), "Insertion d'un sinistre");
  for (const table of ["documents", "expertises", "offres", "reglements", "recours", "messages", "evenements"]) await inserer(table, lots[table]);

  // Le millésime du numéro suit l'année de déclaration.
  const crees = ok(await supabase.from("sinistres").select("id, numero, date_declaration").in("id", lots.sinistres.map((s) => s.id)), "Relecture");
  for (const s of crees) {
    const annee = s.date_declaration.slice(0, 4);
    if (!s.numero.startsWith(`SIN-${annee}-`)) {
      ok(await supabase.from("sinistres").update({ numero: s.numero.replace(/^SIN-\d{4}-/, `SIN-${annee}-`) }).eq("id", s.id), "Numérotation");
    }
  }

  console.log(`Dépôt de ${fichiers.length} pièces de démonstration…`);
  for (let i = 0; i < fichiers.length; i += 10) {
    await Promise.all(
      fichiers.slice(i, i + 10).map((f) =>
        supabase.storage.from("pieces").upload(f.chemin, f.contenu, { contentType: "application/pdf" }).then((r) => {
          if (r.error) throw new Error(`Dépôt ${f.chemin} : ${r.error.message}`);
        }),
      ),
    );
  }

  console.log("\nDonnées de démonstration créées.\n");
  console.log(`  Mot de passe commun des comptes de démonstration : ${motDePasse}\n`);
  console.log(`  Gestionnaire            gestionnaire@${DOMAINE}`);
  for (const c of compagnies) {
    const s = c.sigle.toLowerCase();
    console.log(`  ${c.nom.padEnd(22)}  admin.${s}@${DOMAINE} · agent1.${s}@${DOMAINE} · agent2.${s}@${DOMAINE}`);
  }
  console.log("\n  Pour tout retirer : npm run demo:purger\n");
}

try {
  if (process.argv.includes("--purger")) await purger();
  else await semer();
} catch (erreur) {
  console.error(`\nÉchec : ${erreur.message}`);
  process.exit(1);
}
