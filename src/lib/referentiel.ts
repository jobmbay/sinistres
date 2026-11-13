import type { Priorite, Profil, Role, Statut } from "./types";

export const NOM_APPLICATION = "AWA Sinistres";

/* ------------------------------------------------------------------ */
/*  Statuts du dossier                                                 */
/* ------------------------------------------------------------------ */

export type Ton = "neutre" | "info" | "violet" | "or" | "bon" | "attention" | "critique";

export const STATUTS: Record<Statut, { libelle: string; ton: Ton; etape: number; description: string }> = {
  declare: { libelle: "Déclaré", ton: "neutre", etape: 0, description: "Le sinistre a été déclaré et enregistré." },
  en_instruction: {
    libelle: "En instruction",
    ton: "info",
    etape: 1,
    description: "Vérification des garanties et collecte des pièces.",
  },
  expertise: { libelle: "En expertise", ton: "violet", etape: 2, description: "Un expert évalue les dommages." },
  evaluation: {
    libelle: "Offre en cours",
    ton: "or",
    etape: 3,
    description: "L'indemnité est chiffrée et proposée.",
  },
  accord: { libelle: "Accord obtenu", ton: "or", etape: 3, description: "L'offre d'indemnisation a été acceptée." },
  reglement: { libelle: "En règlement", ton: "info", etape: 4, description: "Le paiement de l'indemnité est en cours." },
  clos: { libelle: "Clôturé", ton: "bon", etape: 5, description: "Le dossier est réglé et clôturé." },
  rejete: { libelle: "Rejeté", ton: "critique", etape: -1, description: "La garantie n'est pas acquise." },
  sans_suite: { libelle: "Sans suite", ton: "neutre", etape: -1, description: "Le dossier a été classé sans suite." },
  contentieux: { libelle: "Contentieux", ton: "attention", etape: -1, description: "Le dossier fait l'objet d'un litige." },
};

export const STATUTS_OUVERTS: Statut[] = [
  "declare",
  "en_instruction",
  "expertise",
  "evaluation",
  "accord",
  "reglement",
  "contentieux",
];
export const STATUTS_TERMINES: Statut[] = ["clos", "rejete", "sans_suite"];

/** Étapes affichées au client et dans la frise du dossier. */
export const ETAPES = ["Déclaration", "Instruction", "Expertise", "Indemnisation", "Règlement", "Clôture"] as const;

/** Passages de statut proposés au gestionnaire depuis chaque statut. */
export const TRANSITIONS: Record<Statut, Statut[]> = {
  declare: ["en_instruction", "rejete", "sans_suite"],
  en_instruction: ["expertise", "evaluation", "contentieux", "rejete", "sans_suite"],
  expertise: ["evaluation", "en_instruction", "contentieux", "rejete", "sans_suite"],
  evaluation: ["accord", "expertise", "contentieux", "rejete", "sans_suite"],
  accord: ["reglement", "contentieux"],
  reglement: ["clos", "contentieux"],
  contentieux: ["evaluation", "reglement", "clos", "rejete"],
  clos: ["en_instruction"],
  rejete: ["en_instruction"],
  sans_suite: ["en_instruction"],
};

/** Statuts dont le passage exige un motif écrit. */
export const STATUTS_AVEC_MOTIF: Statut[] = ["rejete", "sans_suite", "contentieux", "clos"];

export const PRIORITES: Record<Priorite, { libelle: string; ton: Ton }> = {
  basse: { libelle: "Basse", ton: "neutre" },
  normale: { libelle: "Normale", ton: "neutre" },
  haute: { libelle: "Haute", ton: "attention" },
  urgente: { libelle: "Urgente", ton: "critique" },
};

/* ------------------------------------------------------------------ */
/*  Rôles et permissions                                               */
/* ------------------------------------------------------------------ */

export const ROLES: Record<Role, string> = {
  gestionnaire: "Gestionnaire",
  admin_compagnie: "Administrateur",
  agent: "Agent",
};

export const PERMISSIONS = [
  {
    cle: "sinistres.creer",
    libelle: "Déclarer un sinistre",
    description: "Ouvrir un nouveau dossier pour la compagnie.",
    groupe: "Dossiers",
  },
  {
    cle: "sinistres.modifier",
    libelle: "Instruire les dossiers",
    description: "Modifier un dossier, l'attribuer et faire avancer son statut.",
    groupe: "Dossiers",
  },
  {
    cle: "sinistres.cloturer",
    libelle: "Clôturer ou rejeter",
    description: "Clôturer, rejeter, classer sans suite ou rouvrir un dossier.",
    groupe: "Dossiers",
  },
  {
    cle: "documents.gerer",
    libelle: "Gérer les pièces",
    description: "Demander, déposer, valider ou refuser les pièces justificatives.",
    groupe: "Instruction",
  },
  {
    cle: "expertises.gerer",
    libelle: "Missionner les experts",
    description: "Créer les missions d'expertise et saisir les rapports.",
    groupe: "Instruction",
  },
  {
    cle: "communication.gerer",
    libelle: "Échanger avec l'assuré",
    description: "Répondre à l'assuré et rédiger des notes internes.",
    groupe: "Instruction",
  },
  {
    cle: "evaluation.gerer",
    libelle: "Évaluer et proposer une offre",
    description: "Fixer les provisions et émettre les offres d'indemnisation.",
    groupe: "Indemnisation",
  },
  {
    cle: "reglements.gerer",
    libelle: "Préparer les règlements",
    description: "Saisir les ordres de règlement.",
    groupe: "Indemnisation",
  },
  {
    cle: "reglements.valider",
    libelle: "Valider les règlements",
    description: "Valider un règlement et le marquer comme payé.",
    groupe: "Indemnisation",
  },
  {
    cle: "recours.gerer",
    libelle: "Gérer les recours",
    description: "Émettre des recours et répondre aux recours reçus d'autres compagnies.",
    groupe: "Recours",
  },
  {
    cle: "rapports.consulter",
    libelle: "Consulter les rapports",
    description: "Accéder aux statistiques et aux exports de la compagnie.",
    groupe: "Pilotage",
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["cle"];

/** Le gestionnaire et l'administrateur de compagnie ont toutes les permissions. */
export function peut(profil: Pick<Profil, "role" | "permissions">, ...permissions: Permission[]): boolean {
  if (profil.role === "gestionnaire" || profil.role === "admin_compagnie") return true;
  return permissions.some((p) => profil.permissions.includes(p));
}

/* ------------------------------------------------------------------ */
/*  Familles de branches (couleurs des graphiques, ordre fixe)         */
/* ------------------------------------------------------------------ */

export const FAMILLES = [
  "Automobile",
  "Dommages aux biens",
  "Santé et prévoyance",
  "Responsabilité civile",
  "Transport",
  "Vie",
] as const;

/** Couleur de série par famille : suit l'entité, jamais le rang. */
export function couleurFamille(famille: string): string {
  const index = FAMILLES.indexOf(famille as (typeof FAMILLES)[number]);
  return `var(--serie-${index >= 0 ? index + 1 : 6})`;
}

/* ------------------------------------------------------------------ */
/*  Champs spécifiques par branche (stockés dans sinistres.details)    */
/* ------------------------------------------------------------------ */

export type ChampBranche = { cle: string; libelle: string; exemple?: string };

const CHAMPS_PAR_BRANCHE: Record<string, ChampBranche[]> = {
  AUTO: [
    { cle: "immatriculation", libelle: "Immatriculation", exemple: "DK-1234-AB" },
    { cle: "vehicule", libelle: "Marque et modèle", exemple: "Toyota Corolla" },
    { cle: "conducteur", libelle: "Conducteur au moment des faits", exemple: "Nom et prénom" },
    { cle: "permis", libelle: "Numéro de permis" },
  ],
  SANTE: [
    { cle: "beneficiaire", libelle: "Bénéficiaire des soins", exemple: "Assuré, conjoint, enfant…" },
    { cle: "prestataire", libelle: "Établissement ou praticien", exemple: "Clinique, pharmacie…" },
    { cle: "nature_soins", libelle: "Nature des soins" },
  ],
  IA: [
    { cle: "victime", libelle: "Victime" },
    { cle: "nature_lesions", libelle: "Nature des lésions" },
    { cle: "etablissement", libelle: "Établissement de soins" },
  ],
  VIE: [
    { cle: "beneficiaire", libelle: "Bénéficiaire désigné" },
    { cle: "lien", libelle: "Lien avec l'assuré" },
    { cle: "capital", libelle: "Capital garanti" },
  ],
  VOY: [
    { cle: "destination", libelle: "Pays de séjour" },
    { cle: "dates_voyage", libelle: "Dates du voyage" },
  ],
  TRANS: [
    { cle: "marchandise", libelle: "Nature de la marchandise" },
    { cle: "moyen", libelle: "Moyen de transport", exemple: "Navire, camion, avion…" },
    { cle: "titre_transport", libelle: "Connaissement ou lettre de voiture" },
    { cle: "trajet", libelle: "Trajet", exemple: "Dakar – Bamako" },
  ],
  RC: [
    { cle: "activite", libelle: "Activité à l'origine du dommage" },
    { cle: "nature_prejudice", libelle: "Nature du préjudice", exemple: "Corporel, matériel, immatériel" },
  ],
  CAUT: [
    { cle: "debiteur", libelle: "Débiteur défaillant" },
    { cle: "contrat_garanti", libelle: "Contrat ou marché garanti" },
  ],
  AGRI: [
    { cle: "exploitation", libelle: "Exploitation concernée" },
    { cle: "objet", libelle: "Cheptel ou culture touché" },
  ],
};

const CHAMPS_BIENS: ChampBranche[] = [
  { cle: "adresse_risque", libelle: "Adresse du risque" },
  { cle: "biens", libelle: "Biens endommagés" },
];

export function champsDeBranche(code: string | undefined | null): ChampBranche[] {
  if (!code) return [];
  return CHAMPS_PAR_BRANCHE[code] ?? CHAMPS_BIENS;
}

/* ------------------------------------------------------------------ */
/*  Libellés divers                                                    */
/* ------------------------------------------------------------------ */

export const STATUTS_DOCUMENT: Record<string, { libelle: string; ton: Ton }> = {
  demande: { libelle: "À fournir", ton: "attention" },
  recu: { libelle: "Reçue", ton: "info" },
  valide: { libelle: "Validée", ton: "bon" },
  refuse: { libelle: "Refusée", ton: "critique" },
};

export const NATURES_EXPERTISE: Record<string, string> = {
  materielle: "Expertise matérielle",
  medicale: "Expertise médicale",
  contradictoire: "Expertise contradictoire",
  contre_expertise: "Contre-expertise",
  enquete: "Enquête",
};

export const STATUTS_EXPERTISE: Record<string, { libelle: string; ton: Ton }> = {
  missionnee: { libelle: "Missionnée", ton: "info" },
  en_cours: { libelle: "En cours", ton: "violet" },
  rapport_recu: { libelle: "Rapport reçu", ton: "bon" },
  annulee: { libelle: "Annulée", ton: "neutre" },
};

export const STATUTS_OFFRE: Record<string, { libelle: string; ton: Ton }> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" },
  envoyee: { libelle: "En attente de réponse", ton: "or" },
  acceptee: { libelle: "Acceptée", ton: "bon" },
  refusee: { libelle: "Refusée", ton: "critique" },
  annulee: { libelle: "Annulée", ton: "neutre" },
};

export const STATUTS_REGLEMENT: Record<string, { libelle: string; ton: Ton }> = {
  en_attente: { libelle: "À valider", ton: "attention" },
  valide: { libelle: "Validé, à payer", ton: "info" },
  paye: { libelle: "Payé", ton: "bon" },
  annule: { libelle: "Annulé", ton: "neutre" },
};

export const NATURES_REGLEMENT: Record<string, string> = {
  indemnite: "Indemnité",
  honoraires: "Honoraires d'expert",
  frais: "Frais annexes",
  recours: "Règlement de recours",
};

export const MODES_REGLEMENT: Record<string, string> = {
  virement: "Virement bancaire",
  cheque: "Chèque",
  mobile_money: "Mobile money",
  especes: "Espèces",
};

export const STATUTS_RECOURS: Record<string, { libelle: string; ton: Ton }> = {
  emis: { libelle: "En attente de réponse", ton: "or" },
  accepte: { libelle: "Accepté", ton: "bon" },
  conteste: { libelle: "Contesté", ton: "critique" },
  regle: { libelle: "Réglé", ton: "bon" },
  abandonne: { libelle: "Abandonné", ton: "neutre" },
};
