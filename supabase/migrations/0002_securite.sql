-- =====================================================================
--  AWA Sinistres — sécurité (RLS)
--  Le cloisonnement entre compagnies est garanti par la base elle-même.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Fonctions d'aide (security definer : lisent profils/sinistres sans RLS)
-- ---------------------------------------------------------------------
create function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profils p where p.id = (select auth.uid()) and p.actif
$$;

create function public.ma_compagnie()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.compagnie_id from public.profils p where p.id = (select auth.uid()) and p.actif
$$;

create function public.est_gestionnaire()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profils p
     where p.id = (select auth.uid()) and p.actif and p.role = 'gestionnaire')
$$;

-- Vrai si l'utilisateur possède au moins une des permissions demandées.
-- Le gestionnaire et l'administrateur de compagnie ont toutes les permissions.
create function public.a_permission(variadic demandees text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profils p
     where p.id = (select auth.uid()) and p.actif
       and (p.role in ('gestionnaire', 'admin_compagnie') or p.permissions && demandees))
$$;

-- Le dossier appartient à ma compagnie (ou je suis gestionnaire).
create function public.peut_voir_sinistre(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sinistres s
     where s.id = sid
       and (public.est_gestionnaire() or s.compagnie_id = public.ma_compagnie()))
$$;

-- Ma compagnie est la compagnie adverse du dossier.
create function public.est_adverse_sinistre(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sinistres s
     where s.id = sid and s.compagnie_adverse_id = public.ma_compagnie())
$$;

-- ---------------------------------------------------------------------
--  Activation RLS
-- ---------------------------------------------------------------------
alter table public.compagnies     enable row level security;
alter table public.profils        enable row level security;
alter table public.branches       enable row level security;
alter table public.types_sinistre enable row level security;
alter table public.sinistres      enable row level security;
alter table public.documents      enable row level security;
alter table public.expertises     enable row level security;
alter table public.offres         enable row level security;
alter table public.reglements     enable row level security;
alter table public.recours        enable row level security;
alter table public.messages       enable row level security;
alter table public.evenements     enable row level security;

-- ---------------------------------------------------------------------
--  Compagnies : visibles par tout utilisateur actif (annuaire),
--  modifiables par le gestionnaire.
-- ---------------------------------------------------------------------
create policy compagnies_lecture on public.compagnies for select to authenticated
  using (public.mon_role() is not null);
create policy compagnies_creation on public.compagnies for insert to authenticated
  with check (public.est_gestionnaire());
create policy compagnies_modification on public.compagnies for update to authenticated
  using (public.est_gestionnaire() or (id = public.ma_compagnie() and public.mon_role() = 'admin_compagnie'))
  with check (public.est_gestionnaire() or (id = public.ma_compagnie() and public.mon_role() = 'admin_compagnie'));
create policy compagnies_suppression on public.compagnies for delete to authenticated
  using (public.est_gestionnaire());

-- ---------------------------------------------------------------------
--  Profils : lecture de soi, de sa compagnie, ou de tous (gestionnaire).
--  Aucune écriture directe : la création et la modification des comptes
--  passent par le serveur (clé secrète) après contrôle des droits.
-- ---------------------------------------------------------------------
create policy profils_lecture on public.profils for select to authenticated
  using (
    id = (select auth.uid())
    or public.est_gestionnaire()
    or (compagnie_id is not null and compagnie_id = public.ma_compagnie())
  );

-- ---------------------------------------------------------------------
--  Référentiel
-- ---------------------------------------------------------------------
create policy branches_lecture on public.branches for select to authenticated
  using (public.mon_role() is not null);
create policy branches_ecriture on public.branches for all to authenticated
  using (public.est_gestionnaire()) with check (public.est_gestionnaire());

create policy types_lecture on public.types_sinistre for select to authenticated
  using (public.mon_role() is not null);
create policy types_ecriture on public.types_sinistre for all to authenticated
  using (public.est_gestionnaire()) with check (public.est_gestionnaire());

-- ---------------------------------------------------------------------
--  Sinistres
-- ---------------------------------------------------------------------
create policy sinistres_lecture on public.sinistres for select to authenticated
  using (public.est_gestionnaire() or compagnie_id = public.ma_compagnie());

create policy sinistres_creation on public.sinistres for insert to authenticated
  with check (
    public.est_gestionnaire()
    or (compagnie_id = public.ma_compagnie() and public.a_permission('sinistres.creer'))
  );

create policy sinistres_modification on public.sinistres for update to authenticated
  using (
    public.est_gestionnaire()
    or (compagnie_id = public.ma_compagnie() and public.a_permission(
          'sinistres.modifier', 'sinistres.cloturer', 'evaluation.gerer', 'expertises.gerer', 'reglements.gerer'))
  )
  with check (public.est_gestionnaire() or compagnie_id = public.ma_compagnie());

create policy sinistres_suppression on public.sinistres for delete to authenticated
  using (public.est_gestionnaire());

-- ---------------------------------------------------------------------
--  Pièces
-- ---------------------------------------------------------------------
create policy documents_lecture on public.documents for select to authenticated
  using (
    public.peut_voir_sinistre(sinistre_id)
    or (visible_adverse and public.est_adverse_sinistre(sinistre_id))
  );
create policy documents_creation on public.documents for insert to authenticated
  with check (
    (public.peut_voir_sinistre(sinistre_id) and public.a_permission('documents.gerer'))
    or (source = 'adverse' and visible_adverse and public.est_adverse_sinistre(sinistre_id)
        and public.a_permission('recours.gerer'))
  );
create policy documents_modification on public.documents for update to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('documents.gerer'))
  with check (public.peut_voir_sinistre(sinistre_id));
create policy documents_suppression on public.documents for delete to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('documents.gerer'));

-- ---------------------------------------------------------------------
--  Expertises
-- ---------------------------------------------------------------------
create policy expertises_lecture on public.expertises for select to authenticated
  using (public.peut_voir_sinistre(sinistre_id));
create policy expertises_ecriture on public.expertises for all to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('expertises.gerer'))
  with check (public.peut_voir_sinistre(sinistre_id) and public.a_permission('expertises.gerer'));

-- ---------------------------------------------------------------------
--  Offres
-- ---------------------------------------------------------------------
create policy offres_lecture on public.offres for select to authenticated
  using (public.peut_voir_sinistre(sinistre_id));
create policy offres_ecriture on public.offres for all to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('evaluation.gerer'))
  with check (public.peut_voir_sinistre(sinistre_id) and public.a_permission('evaluation.gerer'));

-- ---------------------------------------------------------------------
--  Règlements
-- ---------------------------------------------------------------------
create policy reglements_lecture on public.reglements for select to authenticated
  using (public.peut_voir_sinistre(sinistre_id));
create policy reglements_creation on public.reglements for insert to authenticated
  with check (public.peut_voir_sinistre(sinistre_id) and public.a_permission('reglements.gerer'));
create policy reglements_modification on public.reglements for update to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('reglements.gerer', 'reglements.valider'))
  with check (public.peut_voir_sinistre(sinistre_id));
create policy reglements_suppression on public.reglements for delete to authenticated
  using (public.peut_voir_sinistre(sinistre_id) and public.a_permission('reglements.gerer'));

-- ---------------------------------------------------------------------
--  Recours : visibles par les deux compagnies concernées
-- ---------------------------------------------------------------------
create policy recours_lecture on public.recours for select to authenticated
  using (
    public.est_gestionnaire()
    or compagnie_emettrice_id = public.ma_compagnie()
    or compagnie_adverse_id = public.ma_compagnie()
  );
create policy recours_creation on public.recours for insert to authenticated
  with check (public.peut_voir_sinistre(sinistre_id) and public.a_permission('recours.gerer'));
create policy recours_modification on public.recours for update to authenticated
  using (
    public.a_permission('recours.gerer') and (
      public.est_gestionnaire()
      or compagnie_emettrice_id = public.ma_compagnie()
      or compagnie_adverse_id = public.ma_compagnie())
  )
  with check (
    public.est_gestionnaire()
    or compagnie_emettrice_id = public.ma_compagnie()
    or compagnie_adverse_id = public.ma_compagnie()
  );

-- ---------------------------------------------------------------------
--  Messages : le canal « adverse » est partagé entre les deux compagnies
-- ---------------------------------------------------------------------
create policy messages_lecture on public.messages for select to authenticated
  using (
    public.peut_voir_sinistre(sinistre_id)
    or (canal = 'adverse' and public.est_adverse_sinistre(sinistre_id))
  );
create policy messages_creation on public.messages for insert to authenticated
  with check (
    auteur_id = (select auth.uid()) and (
      (public.peut_voir_sinistre(sinistre_id) and auteur_type = 'agent'
        and public.a_permission('communication.gerer', 'recours.gerer', 'sinistres.modifier'))
      or (canal = 'adverse' and auteur_type = 'adverse'
        and public.est_adverse_sinistre(sinistre_id) and public.a_permission('recours.gerer'))
    )
  );

-- ---------------------------------------------------------------------
--  Historique
-- ---------------------------------------------------------------------
create policy evenements_lecture on public.evenements for select to authenticated
  using (public.peut_voir_sinistre(sinistre_id));
create policy evenements_creation on public.evenements for insert to authenticated
  with check (public.peut_voir_sinistre(sinistre_id));

-- ---------------------------------------------------------------------
--  Vue restreinte pour la compagnie adverse.
--  Elle expose uniquement les informations utiles à l'instruction du
--  recours : ni provisions, ni offres, ni règlements, ni notes internes.
--  (Vue volontairement « security definer » : le filtre est dans la vue.)
-- ---------------------------------------------------------------------
create view public.sinistres_adverses as
  select s.id, s.numero, s.compagnie_id, s.compagnie_adverse_id, s.branche_id, s.type_sinistre_id,
         s.statut, s.date_survenance, s.date_declaration, s.lieu, s.ville, s.circonstances,
         s.assure_nom, s.tiers_nom, s.tiers_police, s.tiers_details, s.taux_responsabilite,
         s.created_at
    from public.sinistres s
   where s.compagnie_adverse_id = public.ma_compagnie();

-- ---------------------------------------------------------------------
--  Privilèges : rien pour les visiteurs anonymes.
--  Le suivi client public passe exclusivement par le serveur.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.sinistres_adverses from authenticated;
grant select on public.sinistres_adverses to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------
--  Stockage des pièces : compartiment privé, aucun accès direct.
--  Dépôts et téléchargements passent par le serveur après contrôle.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('pieces', 'pieces', false, 15728640)
on conflict (id) do nothing;
