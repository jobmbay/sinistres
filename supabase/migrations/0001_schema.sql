-- =====================================================================
--  AWA Sinistres — schéma principal
--  Gestion de sinistres multi-branches et multi-compagnies
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Compagnies d'assurance
-- ---------------------------------------------------------------------
create table public.compagnies (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  sigle       text not null,
  code        text not null unique,
  email       text,
  telephone   text,
  adresse     text,
  ville       text,
  pays        text not null default 'Sénégal',
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Profils utilisateurs (1-1 avec auth.users)
--  gestionnaire     : opérateur de la plateforme, voit tout
--  admin_compagnie  : administre sa compagnie et ses agents
--  agent            : accès limité aux permissions attribuées
-- ---------------------------------------------------------------------
create table public.profils (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              text not null check (role in ('gestionnaire', 'admin_compagnie', 'agent')),
  compagnie_id      uuid references public.compagnies (id) on delete restrict,
  prenom            text not null,
  nom               text not null,
  email             text not null,
  telephone         text,
  fonction          text,
  permissions       text[] not null default '{}',
  actif             boolean not null default true,
  doit_changer_mdp  boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint profils_role_compagnie check (
    (role = 'gestionnaire' and compagnie_id is null)
    or (role <> 'gestionnaire' and compagnie_id is not null)
  )
);
create index profils_compagnie_idx on public.profils (compagnie_id);

-- ---------------------------------------------------------------------
--  Référentiel : branches et types de sinistre
-- ---------------------------------------------------------------------
create table public.branches (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  nom              text not null,
  famille          text not null,
  ordre            int not null default 100,
  pieces_requises  text[] not null default '{}',
  actif            boolean not null default true
);

create table public.types_sinistre (
  id          uuid primary key default gen_random_uuid(),
  branche_id  uuid not null references public.branches (id) on delete cascade,
  nom         text not null,
  ordre       int not null default 100,
  unique (branche_id, nom)
);
create index types_sinistre_branche_idx on public.types_sinistre (branche_id);

-- ---------------------------------------------------------------------
--  Sinistres
-- ---------------------------------------------------------------------
create sequence public.sinistres_numero_seq;
create sequence public.recours_numero_seq;

create table public.sinistres (
  id                    uuid primary key default gen_random_uuid(),
  numero                text not null unique,
  jeton_suivi           text not null unique
                          default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_'),

  compagnie_id          uuid not null references public.compagnies (id) on delete restrict,
  compagnie_adverse_id  uuid references public.compagnies (id) on delete restrict,
  branche_id            uuid not null references public.branches (id) on delete restrict,
  type_sinistre_id      uuid references public.types_sinistre (id) on delete set null,

  statut                text not null default 'declare' check (statut in (
                          'declare', 'en_instruction', 'expertise', 'evaluation',
                          'accord', 'reglement', 'clos', 'rejete', 'sans_suite', 'contentieux')),
  priorite              text not null default 'normale' check (priorite in ('basse', 'normale', 'haute', 'urgente')),

  -- Contrat
  numero_police         text not null,

  -- Assuré
  assure_nom            text not null,
  assure_telephone      text,
  assure_email          text,
  assure_adresse        text,

  -- Événement
  date_survenance       timestamptz not null,
  date_declaration      date not null default current_date,
  lieu                  text,
  ville                 text,
  circonstances         text,
  details               jsonb not null default '{}'::jsonb,

  -- Tiers / partie adverse
  tiers_nom             text,
  tiers_telephone       text,
  tiers_police          text,
  tiers_details         text,
  taux_responsabilite   int check (taux_responsabilite between 0 and 100),

  -- Montants (FCFA)
  montant_estime        numeric(16, 0) not null default 0,
  montant_provision     numeric(16, 0) not null default 0,
  montant_franchise     numeric(16, 0) not null default 0,
  montant_regle         numeric(16, 0) not null default 0,

  -- Gestion
  gestionnaire_id       uuid references public.profils (id) on delete set null,
  cree_par              uuid references public.profils (id) on delete set null,
  motif_cloture         text,
  date_cloture          timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint sinistres_adverse_differente check (compagnie_adverse_id is null or compagnie_adverse_id <> compagnie_id)
);
create index sinistres_compagnie_idx on public.sinistres (compagnie_id, statut);
create index sinistres_adverse_idx on public.sinistres (compagnie_adverse_id) where compagnie_adverse_id is not null;
create index sinistres_branche_idx on public.sinistres (branche_id);
create index sinistres_created_idx on public.sinistres (created_at desc);
create index sinistres_gestionnaire_idx on public.sinistres (gestionnaire_id);

create function public.sinistres_avant_insertion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'SIN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sinistres_numero_seq')::text, 6, '0');
  end if;
  return new;
end $$;
create trigger sinistres_numero before insert on public.sinistres
  for each row execute function public.sinistres_avant_insertion();

create function public.maj_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger sinistres_updated_at before update on public.sinistres
  for each row execute function public.maj_updated_at();

-- ---------------------------------------------------------------------
--  Pièces du dossier (demandées ou reçues)
-- ---------------------------------------------------------------------
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  sinistre_id      uuid not null references public.sinistres (id) on delete cascade,
  libelle          text not null,
  statut           text not null default 'demande' check (statut in ('demande', 'recu', 'valide', 'refuse')),
  chemin           text,
  nom_fichier      text,
  taille           bigint,
  mime             text,
  source           text not null default 'agent' check (source in ('agent', 'client', 'adverse')),
  visible_client   boolean not null default true,
  visible_adverse  boolean not null default false,
  commentaire      text,
  depose_par       uuid references public.profils (id) on delete set null,
  recu_le          timestamptz,
  created_at       timestamptz not null default now()
);
create index documents_sinistre_idx on public.documents (sinistre_id);

-- ---------------------------------------------------------------------
--  Expertises
-- ---------------------------------------------------------------------
create table public.expertises (
  id                uuid primary key default gen_random_uuid(),
  sinistre_id       uuid not null references public.sinistres (id) on delete cascade,
  nature            text not null default 'materielle' check (nature in ('materielle', 'medicale', 'contradictoire', 'contre_expertise', 'enquete')),
  expert_nom        text not null,
  expert_cabinet    text,
  expert_telephone  text,
  expert_email      text,
  statut            text not null default 'missionnee' check (statut in ('missionnee', 'en_cours', 'rapport_recu', 'annulee')),
  date_mission      date not null default current_date,
  date_visite       date,
  date_rapport      date,
  montant_evalue    numeric(16, 0),
  honoraires        numeric(16, 0),
  conclusions       text,
  created_at        timestamptz not null default now()
);
create index expertises_sinistre_idx on public.expertises (sinistre_id);

-- ---------------------------------------------------------------------
--  Offres d'indemnisation
-- ---------------------------------------------------------------------
create table public.offres (
  id               uuid primary key default gen_random_uuid(),
  sinistre_id      uuid not null references public.sinistres (id) on delete cascade,
  montant          numeric(16, 0) not null check (montant >= 0),
  detail           text,
  statut           text not null default 'envoyee' check (statut in ('brouillon', 'envoyee', 'acceptee', 'refusee', 'annulee')),
  reponse_motif    text,
  repondu_par      text,
  date_envoi       timestamptz,
  date_reponse     timestamptz,
  cree_par         uuid references public.profils (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index offres_sinistre_idx on public.offres (sinistre_id);

-- ---------------------------------------------------------------------
--  Règlements
-- ---------------------------------------------------------------------
create table public.reglements (
  id               uuid primary key default gen_random_uuid(),
  sinistre_id      uuid not null references public.sinistres (id) on delete cascade,
  beneficiaire     text not null,
  nature           text not null default 'indemnite' check (nature in ('indemnite', 'honoraires', 'frais', 'recours')),
  montant          numeric(16, 0) not null check (montant > 0),
  mode             text not null default 'virement' check (mode in ('virement', 'cheque', 'mobile_money', 'especes')),
  reference        text,
  statut           text not null default 'en_attente' check (statut in ('en_attente', 'valide', 'paye', 'annule')),
  date_reglement   date,
  cree_par         uuid references public.profils (id) on delete set null,
  valide_par       uuid references public.profils (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index reglements_sinistre_idx on public.reglements (sinistre_id);

create function public.recalculer_montant_regle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cible uuid := coalesce(new.sinistre_id, old.sinistre_id);
begin
  update public.sinistres s
     set montant_regle = coalesce((
           select sum(r.montant) from public.reglements r
            where r.sinistre_id = cible and r.statut = 'paye' and r.nature = 'indemnite'), 0)
   where s.id = cible;
  return null;
end $$;
create trigger reglements_total after insert or update or delete on public.reglements
  for each row execute function public.recalculer_montant_regle();

-- ---------------------------------------------------------------------
--  Recours inter-compagnies
-- ---------------------------------------------------------------------
create table public.recours (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text not null unique,
  sinistre_id            uuid not null references public.sinistres (id) on delete cascade,
  compagnie_emettrice_id uuid not null references public.compagnies (id) on delete restrict,
  compagnie_adverse_id   uuid not null references public.compagnies (id) on delete restrict,
  montant_reclame        numeric(16, 0) not null check (montant_reclame > 0),
  montant_accorde        numeric(16, 0),
  statut                 text not null default 'emis' check (statut in ('emis', 'accepte', 'conteste', 'regle', 'abandonne')),
  motif                  text,
  reponse                text,
  date_emission          timestamptz not null default now(),
  date_reponse           timestamptz,
  date_reglement         timestamptz,
  cree_par               uuid references public.profils (id) on delete set null,
  created_at             timestamptz not null default now()
);
create index recours_sinistre_idx on public.recours (sinistre_id);
create index recours_emettrice_idx on public.recours (compagnie_emettrice_id);
create index recours_adverse_idx on public.recours (compagnie_adverse_id);

create function public.recours_avant_insertion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.recours_numero_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create trigger recours_numero before insert on public.recours
  for each row execute function public.recours_avant_insertion();

-- ---------------------------------------------------------------------
--  Échanges (notes internes, messages client, messages inter-compagnies)
-- ---------------------------------------------------------------------
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  sinistre_id  uuid not null references public.sinistres (id) on delete cascade,
  canal        text not null check (canal in ('interne', 'client', 'adverse')),
  auteur_type  text not null default 'agent' check (auteur_type in ('agent', 'client', 'adverse')),
  auteur_id    uuid references public.profils (id) on delete set null,
  auteur_nom   text not null,
  contenu      text not null check (length(contenu) between 1 and 5000),
  created_at   timestamptz not null default now()
);
create index messages_sinistre_idx on public.messages (sinistre_id, created_at);

-- ---------------------------------------------------------------------
--  Historique du dossier
-- ---------------------------------------------------------------------
create table public.evenements (
  id              uuid primary key default gen_random_uuid(),
  sinistre_id     uuid not null references public.sinistres (id) on delete cascade,
  type            text not null,
  titre           text not null,
  description     text,
  visible_client  boolean not null default false,
  auteur_id       uuid references public.profils (id) on delete set null,
  auteur_nom      text,
  created_at      timestamptz not null default now()
);
create index evenements_sinistre_idx on public.evenements (sinistre_id, created_at desc);
