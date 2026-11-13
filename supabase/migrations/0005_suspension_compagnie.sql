-- =====================================================================
--  AWA Sinistres — suspension d'une compagnie appliquée par la base
--
--  1. Les utilisateurs d'une compagnie suspendue perdent tout accès aux
--     données, même en appelant directement l'API avec leur session.
--  2. L'administrateur d'une compagnie peut mettre à jour ses coordonnées,
--     mais ni son nom, ni son sigle, ni son code, ni son état d'activation.
-- =====================================================================

create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role
    from public.profils p
    left join public.compagnies c on c.id = p.compagnie_id
   where p.id = (select auth.uid()) and p.actif
     and (p.compagnie_id is null or c.actif)
$$;

create or replace function public.ma_compagnie()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.compagnie_id
    from public.profils p
    join public.compagnies c on c.id = p.compagnie_id
   where p.id = (select auth.uid()) and p.actif and c.actif
$$;

create or replace function public.a_permission(variadic demandees text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.profils p
      left join public.compagnies c on c.id = p.compagnie_id
     where p.id = (select auth.uid()) and p.actif
       and (p.compagnie_id is null or c.actif)
       and (p.role in ('gestionnaire', 'admin_compagnie') or p.permissions && demandees))
$$;

-- Un utilisateur ne lit son propre profil que si son compte est utilisable ;
-- les profils de collègues passent déjà par ma_compagnie().
drop policy profils_lecture on public.profils;
create policy profils_lecture on public.profils for select to authenticated
  using (
    id = (select auth.uid())
    or public.est_gestionnaire()
    or (compagnie_id is not null and compagnie_id = public.ma_compagnie())
  );

create function public.compagnies_proteger_champs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() est nul pour le serveur (clé secrète) et les migrations.
  if (select auth.uid()) is not null and not public.est_gestionnaire() then
    new.nom   := old.nom;
    new.sigle := old.sigle;
    new.code  := old.code;
    new.actif := old.actif;
  end if;
  return new;
end $$;

create trigger compagnies_champs_reserves before update on public.compagnies
  for each row execute function public.compagnies_proteger_champs();

revoke execute on function public.compagnies_proteger_champs() from anon, public;
