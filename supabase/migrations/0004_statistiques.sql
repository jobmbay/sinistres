-- =====================================================================
--  AWA Sinistres — statistiques agrégées (tableau de bord et rapports)
--  « security invoker » : la RLS s'applique, chaque utilisateur
--  n'agrège que les dossiers qu'il a le droit de voir.
-- =====================================================================

create function public.statistiques(
  p_debut date default null,
  p_fin date default null,
  p_compagnie uuid default null,
  p_branche uuid default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
with base as (
  select s.id, s.statut, s.compagnie_id, s.compagnie_adverse_id, s.branche_id,
         s.montant_estime, s.montant_provision, s.montant_regle,
         s.date_declaration, s.created_at, s.date_cloture,
         b.code as branche_code, b.nom as branche_nom, b.famille, b.ordre as branche_ordre
    from public.sinistres s
    join public.branches b on b.id = s.branche_id
   where (p_debut is null or s.date_declaration >= p_debut)
     and (p_fin is null or s.date_declaration <= p_fin)
     and (p_compagnie is null or s.compagnie_id = p_compagnie)
     and (p_branche is null or s.branche_id = p_branche)
)
select jsonb_build_object(
  'totaux', (
    select jsonb_build_object(
      'total', count(*),
      'ouverts', count(*) filter (where statut not in ('clos', 'rejete', 'sans_suite')),
      'clos', count(*) filter (where statut = 'clos'),
      'rejetes', count(*) filter (where statut in ('rejete', 'sans_suite')),
      'contentieux', count(*) filter (where statut = 'contentieux'),
      'declares_mois', count(*) filter (where date_declaration >= date_trunc('month', current_date)),
      'declares_mois_precedent', count(*) filter (
        where date_declaration >= date_trunc('month', current_date) - interval '1 month'
          and date_declaration < date_trunc('month', current_date)),
      'estime', coalesce(sum(montant_estime), 0),
      'provisions', coalesce(sum(montant_provision) filter (where statut not in ('clos', 'rejete', 'sans_suite')), 0),
      'regle', coalesce(sum(montant_regle), 0),
      'delai_moyen', round(avg(extract(epoch from (date_cloture - created_at)) / 86400)
                       filter (where statut = 'clos' and date_cloture is not null))
    ) from base),
  'par_statut', (
    select coalesce(jsonb_agg(jsonb_build_object('statut', statut, 'n', n)), '[]'::jsonb)
      from (select statut, count(*) as n from base group by statut) x),
  'par_mois', (
    select coalesce(jsonb_agg(jsonb_build_object('mois', mois, 'famille', famille, 'n', n, 'estime', estime)
                              order by mois), '[]'::jsonb)
      from (select to_char(date_declaration, 'YYYY-MM') as mois, famille,
                   count(*) as n, coalesce(sum(montant_estime), 0) as estime
              from base group by 1, 2) x),
  'par_branche', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'branche_id', branche_id, 'code', branche_code, 'nom', branche_nom, 'famille', famille,
             'n', n, 'ouverts', ouverts, 'estime', estime, 'provisions', provisions, 'regle', regle)
             order by n desc, branche_ordre), '[]'::jsonb)
      from (select branche_id, branche_code, branche_nom, famille, branche_ordre,
                   count(*) as n,
                   count(*) filter (where statut not in ('clos', 'rejete', 'sans_suite')) as ouverts,
                   coalesce(sum(montant_estime), 0) as estime,
                   coalesce(sum(montant_provision), 0) as provisions,
                   coalesce(sum(montant_regle), 0) as regle
              from base group by 1, 2, 3, 4, 5) x),
  'par_compagnie', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'compagnie_id', x.compagnie_id, 'nom', c.nom, 'sigle', c.sigle,
             'n', x.n, 'ouverts', x.ouverts, 'estime', x.estime, 'provisions', x.provisions,
             'regle', x.regle, 'delai_moyen', x.delai_moyen)
             order by x.n desc, c.nom), '[]'::jsonb)
      from (select compagnie_id,
                   count(*) as n,
                   count(*) filter (where statut not in ('clos', 'rejete', 'sans_suite')) as ouverts,
                   coalesce(sum(montant_estime), 0) as estime,
                   coalesce(sum(montant_provision), 0) as provisions,
                   coalesce(sum(montant_regle), 0) as regle,
                   round(avg(extract(epoch from (date_cloture - created_at)) / 86400)
                     filter (where statut = 'clos' and date_cloture is not null)) as delai_moyen
              from base group by 1) x
      join public.compagnies c on c.id = x.compagnie_id),
  'compagnie_branche', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'compagnie_id', compagnie_id, 'branche_id', branche_id, 'code', branche_code,
             'nom', branche_nom, 'n', n) order by n desc), '[]'::jsonb)
      from (select compagnie_id, branche_id, branche_code, branche_nom, count(*) as n
              from base group by 1, 2, 3, 4) x),
  'liens_adverses', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'compagnie_id', x.compagnie_id, 'compagnie_adverse_id', x.compagnie_adverse_id,
             'sigle', c.sigle, 'nom', c.nom, 'n', x.n) order by x.n desc), '[]'::jsonb)
      from (select compagnie_id, compagnie_adverse_id, count(*) as n
              from base where compagnie_adverse_id is not null group by 1, 2) x
      join public.compagnies c on c.id = x.compagnie_adverse_id)
)
$$;

revoke execute on function public.statistiques(date, date, uuid, uuid) from anon, public;
grant execute on function public.statistiques(date, date, uuid, uuid) to authenticated, service_role;
