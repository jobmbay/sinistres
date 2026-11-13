# AWA Sinistres

Plateforme de gestion des sinistres d'assurance, toutes branches et toutes compagnies :
de la déclaration au règlement, avec un lien de suivi pour l'assuré et les recours entre compagnies.

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage).

## Démarrer

```bash
npm install
npm run db:migrer      # crée ou met à jour le schéma de la base (idempotent)
npm run dev            # http://localhost:3000
```

Le fichier `.env` doit contenir :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (navigateur et serveur) |
| `SUPABASE_SECRET_KEY` | Clé secrète, **serveur uniquement** |
| `SUPABASE_DB_PASSWORD` | Mot de passe Postgres, utilisé seulement par `npm run db:migrer` |

Les deux dernières ne doivent jamais porter le préfixe `NEXT_PUBLIC_` : Next.js exposerait leur valeur au navigateur.

### Premier compte

```bash
npm run compte:gestionnaire -- vous@exemple.com Prénom Nom
```

Le mot de passe provisoire s'affiche une fois ; il est remplacé à la première connexion.
Le gestionnaire crée ensuite les compagnies (menu **Compagnies**), chacune avec son administrateur.

### Jeu de démonstration

```bash
npm run demo           # 5 compagnies fictives, 16 comptes, 72 sinistres
npm run demo:purger    # retire tout ce que la démonstration a créé, et rien d'autre
```

Les données de démonstration sont reconnaissables : compagnies au code `DEMO-…`, comptes en `@demo.awa-sinistres.app`.

## Qui fait quoi

| Rôle | Périmètre |
| --- | --- |
| **Gestionnaire** | Opérateur de la plateforme. Voit et gère tous les sinistres de toutes les compagnies, crée les compagnies et leurs administrateurs, configure les branches. |
| **Administrateur de compagnie** | Toutes les fonctions sur les dossiers de sa compagnie. Crée ses agents et choisit leurs accès. |
| **Agent** | Consulte les dossiers de sa compagnie ; agit selon les fonctions que son administrateur lui a ouvertes (11 permissions, voir `src/lib/referentiel.ts`). |
| **Compagnie adverse** | Ne voit pas le dossier. Voit les recours qui la visent, les pièces partagées et une vue restreinte du sinistre (ni montants, ni notes, ni coordonnées de l'assuré). |
| **Assuré** | Pas de compte : un lien personnel (`/suivi/<jeton>`) pour suivre son dossier, déposer ses pièces, écrire à son gestionnaire et répondre à l'offre. |

## Cycle d'un sinistre

`Déclaré → En instruction → En expertise → Offre en cours → Accord obtenu → En règlement → Clôturé`,
avec trois sorties possibles : `Rejeté`, `Sans suite`, `Contentieux`.

Le statut avance de lui-même quand l'action correspondante est faite (missionner un expert, émettre une offre,
acceptation de l'offre, préparation du règlement). Chaque action est consignée dans l'historique du dossier ;
celles qui concernent l'assuré apparaissent dans son espace de suivi.

## Sécurité

Le cloisonnement est appliqué **par la base de données** (Row Level Security), pas seulement par l'interface :

- `supabase/migrations/0002_securite.sql` : règles par table ; `0005_suspension_compagnie.sql` : suspension d'une compagnie.
- Les pages et les actions serveur utilisent la session de l'utilisateur ; elles ne voient donc que ce que la base autorise.
- La clé secrète ne sert qu'à trois choses, toujours après contrôle des droits : gérer les comptes, servir l'espace de suivi (accès par jeton), lire et écrire les fichiers.
- Les pièces sont dans un compartiment privé ; chaque téléchargement passe par le serveur, qui délivre un lien valable 60 secondes.

À relancer après toute modification des règles :

```bash
npm run test:cloisonnement -- <mot de passe des comptes de démonstration>
```

## Organisation du code

```
supabase/migrations/     schéma, sécurité, référentiel des branches, statistiques
scripts/                 migration, compte gestionnaire, démonstration, contrôle du cloisonnement
src/proxy.ts             rafraîchit la session, renvoie à la connexion si besoin
src/lib/                 session, clients Supabase, référentiel métier, formats
src/actions/             actions serveur (toute écriture passe par ici)
src/components/          interface, graphiques, composants métier
src/app/(app)/           application authentifiée
src/app/suivi/[jeton]/   espace de suivi de l'assuré (public)
```

Conventions :

- Les heures sont saisies et affichées en temps universel (GMT, l'heure de Dakar).
- Les montants sont en francs CFA, sans décimales.
- Chaque dossier de route a son `loading.tsx` : c'est ce qui rend la navigation instantanée avec les Cache Components.
- Avant de modifier du code Next.js, lire `AGENTS.md` : cette version diffère sensiblement des précédentes.

## Limites connues

- **Envoi du lien de suivi** : il se fait depuis l'appareil de l'agent (WhatsApp, e-mail ou SMS préremplis). Un envoi automatique par le serveur demande un fournisseur d'e-mail ou de SMS, non configuré.
- **Mot de passe oublié** : réinitialisé par l'administrateur (menu **Équipe**), pas par e-mail.
- **Pas de mise à jour en direct** : un écran ouvert se met à jour au rechargement ou à l'action suivante.
- **Permissions fines** : la base garantit le cloisonnement entre compagnies et les grandes familles de droits ; la distinction la plus fine entre deux permissions d'une même compagnie est faite par les actions serveur.
