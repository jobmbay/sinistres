export type Role = "gestionnaire" | "admin_compagnie" | "agent";

export type Statut =
  | "declare"
  | "en_instruction"
  | "expertise"
  | "evaluation"
  | "accord"
  | "reglement"
  | "clos"
  | "rejete"
  | "sans_suite"
  | "contentieux";

export type Priorite = "basse" | "normale" | "haute" | "urgente";

export type Compagnie = {
  id: string;
  nom: string;
  sigle: string;
  code: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  actif: boolean;
  created_at: string;
};

export type CompagnieResume = Pick<Compagnie, "id" | "nom" | "sigle">;

export type Profil = {
  id: string;
  role: Role;
  compagnie_id: string | null;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  fonction: string | null;
  permissions: string[];
  actif: boolean;
  doit_changer_mdp: boolean;
  created_at: string;
  compagnie?: CompagnieResume | null;
};

export type Branche = {
  id: string;
  code: string;
  nom: string;
  famille: string;
  ordre: number;
  pieces_requises: string[];
  actif: boolean;
};

export type TypeSinistre = { id: string; branche_id: string; nom: string; ordre: number };

export type Sinistre = {
  id: string;
  numero: string;
  jeton_suivi: string;
  compagnie_id: string;
  compagnie_adverse_id: string | null;
  branche_id: string;
  type_sinistre_id: string | null;
  statut: Statut;
  priorite: Priorite;
  numero_police: string;
  assure_nom: string;
  assure_telephone: string | null;
  assure_email: string | null;
  assure_adresse: string | null;
  date_survenance: string;
  date_declaration: string;
  lieu: string | null;
  ville: string | null;
  circonstances: string | null;
  details: Record<string, string>;
  tiers_nom: string | null;
  tiers_telephone: string | null;
  tiers_police: string | null;
  tiers_details: string | null;
  taux_responsabilite: number | null;
  montant_estime: number;
  montant_provision: number;
  montant_franchise: number;
  montant_regle: number;
  gestionnaire_id: string | null;
  cree_par: string | null;
  motif_cloture: string | null;
  date_cloture: string | null;
  created_at: string;
  updated_at: string;
};

export type SinistreListe = Sinistre & {
  compagnie: CompagnieResume | null;
  adverse: CompagnieResume | null;
  branche: Pick<Branche, "code" | "nom" | "famille"> | null;
  type: { nom: string } | null;
  gestionnaire: { prenom: string; nom: string } | null;
};

export type SinistreDetail = Omit<SinistreListe, "branche"> & {
  branche: Pick<Branche, "id" | "code" | "nom" | "famille" | "pieces_requises"> | null;
};

export type DocumentPiece = {
  id: string;
  sinistre_id: string;
  libelle: string;
  statut: "demande" | "recu" | "valide" | "refuse";
  chemin: string | null;
  nom_fichier: string | null;
  taille: number | null;
  mime: string | null;
  source: "agent" | "client" | "adverse";
  visible_client: boolean;
  visible_adverse: boolean;
  commentaire: string | null;
  recu_le: string | null;
  created_at: string;
};

export type Expertise = {
  id: string;
  sinistre_id: string;
  nature: "materielle" | "medicale" | "contradictoire" | "contre_expertise" | "enquete";
  expert_nom: string;
  expert_cabinet: string | null;
  expert_telephone: string | null;
  expert_email: string | null;
  statut: "missionnee" | "en_cours" | "rapport_recu" | "annulee";
  date_mission: string;
  date_visite: string | null;
  date_rapport: string | null;
  montant_evalue: number | null;
  honoraires: number | null;
  conclusions: string | null;
  created_at: string;
};

export type Offre = {
  id: string;
  sinistre_id: string;
  montant: number;
  detail: string | null;
  statut: "brouillon" | "envoyee" | "acceptee" | "refusee" | "annulee";
  reponse_motif: string | null;
  repondu_par: string | null;
  date_envoi: string | null;
  date_reponse: string | null;
  created_at: string;
};

export type Reglement = {
  id: string;
  sinistre_id: string;
  beneficiaire: string;
  nature: "indemnite" | "honoraires" | "frais" | "recours";
  montant: number;
  mode: "virement" | "cheque" | "mobile_money" | "especes";
  reference: string | null;
  statut: "en_attente" | "valide" | "paye" | "annule";
  date_reglement: string | null;
  created_at: string;
};

export type Recours = {
  id: string;
  numero: string;
  sinistre_id: string;
  compagnie_emettrice_id: string;
  compagnie_adverse_id: string;
  montant_reclame: number;
  montant_accorde: number | null;
  statut: "emis" | "accepte" | "conteste" | "regle" | "abandonne";
  motif: string | null;
  reponse: string | null;
  date_emission: string;
  date_reponse: string | null;
  date_reglement: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  sinistre_id: string;
  canal: "interne" | "client" | "adverse";
  auteur_type: "agent" | "client" | "adverse";
  auteur_id: string | null;
  auteur_nom: string;
  contenu: string;
  created_at: string;
};

export type Evenement = {
  id: string;
  sinistre_id: string;
  type: string;
  titre: string;
  description: string | null;
  visible_client: boolean;
  auteur_nom: string | null;
  created_at: string;
};

export type SinistreAdverse = {
  id: string;
  numero: string;
  compagnie_id: string;
  compagnie_adverse_id: string;
  branche_id: string;
  type_sinistre_id: string | null;
  statut: Statut;
  date_survenance: string;
  date_declaration: string;
  lieu: string | null;
  ville: string | null;
  circonstances: string | null;
  assure_nom: string;
  tiers_nom: string | null;
  tiers_police: string | null;
  tiers_details: string | null;
  taux_responsabilite: number | null;
  created_at: string;
};

/** Résultat renvoyé par les actions serveur aux formulaires. */
export type EtatAction = { ok: boolean; message?: string; donnees?: Record<string, string> } | null;

export type Statistiques = {
  totaux: {
    total: number;
    ouverts: number;
    clos: number;
    rejetes: number;
    contentieux: number;
    declares_mois: number;
    declares_mois_precedent: number;
    estime: number;
    provisions: number;
    regle: number;
    delai_moyen: number | null;
  };
  par_statut: { statut: Statut; n: number }[];
  par_mois: { mois: string; famille: string; n: number; estime: number }[];
  par_branche: {
    branche_id: string;
    code: string;
    nom: string;
    famille: string;
    n: number;
    ouverts: number;
    estime: number;
    provisions: number;
    regle: number;
  }[];
  par_compagnie: {
    compagnie_id: string;
    nom: string;
    sigle: string;
    n: number;
    ouverts: number;
    estime: number;
    provisions: number;
    regle: number;
    delai_moyen: number | null;
  }[];
  compagnie_branche: { compagnie_id: string; branche_id: string; code: string; nom: string; n: number }[];
  liens_adverses: { compagnie_id: string; compagnie_adverse_id: string; sigle: string; nom: string; n: number }[];
};
