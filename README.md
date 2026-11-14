# Avant-Première

**Les marchés publics, avant tout le monde.**

Avant-Première est une plateforme de veille commerciale pour les entreprises qui vendent au secteur public. Des agents IA lisent en direct les données publiques officielles et montrent **qui va acheter quoi, où et quand**, avant la publication de l'appel d'offres.

Projet réalisé pour le hackathon Hémicycle × The Nest du 14 novembre 2026.

## Ce que fait le produit

Trois profils, mêmes données, trois angles :

| Profil | Question posée | Ce que l'agent produit |
| --- | --- | --- |
| **Entreprise** | « Quels marchés publics puis-je gagner ? » | Achats annoncés avant appel d'offres (APProch), renouvellements prédits des marchés attribués (date de notification + durée), concurrents, score de chance de gain, mail d'approche rédigé par l'IA |
| **Collectivité** | « Mes achats sont-ils assez mis en concurrence ? » | Taux de marchés à une seule offre comparé au département, fournisseurs, finances (OFGL), projets subventionnés (DETR, DSIL), recommandations |
| **État** | « Où l'argent public est-il le moins mis en concurrence ? » | Carte nationale des marchés à offre unique, titulaires dominants, achats annoncés, note de synthèse |

Ajouts :
- **Agent prospecteur live** : chaque étape correspond à un vrai appel de données, affiché avec sa source officielle, son temps de réponse, l'heure de lecture et son coût en crédits.
- **Chat agentique** : le modèle choisit lui-même les jeux de données à interroger (appel d'outils), corrige ses requêtes en cas d'erreur et cite ses sources.
- **Carte 3D cinématique** (MapLibre) : vue de France puis zoom sur la commune ou le département analysé.
- Pages **Modèle économique** et **Feuille de route**.
- Site public, sans compte, responsive du téléphone au grand écran.

## Données utilisées (via l'API / MCP Hémicycle)

- `projets_achats_publics` : achats annoncés par l'État et les hôpitaux avant l'appel d'offres (APProch)
- `marches_publics` : marchés attribués (DECP) avec titulaire, montant, durée et nombre d'offres reçues
- `sirene_etablissements` et la recherche d'entreprises : identité, activité (NAF), établissements
- `comptes_communes` : finances des communes (OFGL)
- `dotations_investissement_2025` : projets subventionnés (DETR, DSIL, DSID, DPV)
- Amendements et textes du Parlement (recherche plein texte)
- API Géo de l'État (geo.api.gouv.fr) pour localiser les communes

Toutes les données sont lues en direct, sans cache. Les prédictions sont indicatives.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- MapLibre GL (fond de carte CARTO / OpenStreetMap)
- LLM via Featherless (Kimi K3), avec appels d'outils
- Streaming Server-Sent Events pour l'effet live
- Déploiement sur Vercel

## Lancer en local

```bash
cp .env.example .env.local   # puis renseigner les deux clés
npm install
npm run dev
```

Variables d'environnement (côté serveur uniquement) :

| Variable | Rôle |
| --- | --- |
| `HEMICYCLE_API_KEY` | Clé de l'API Hémicycle (hemicycle.ai/compte-api) |
| `FEATHERLESS_API_KEY` | Clé Featherless pour le LLM |
| `LLM_MODEL` | Optionnel, `moonshotai/Kimi-K3` par défaut |

## Modifier le contenu

Tous les textes, profils, exemples, prix, hypothèses de marché et la feuille de route sont regroupés dans `src/config/site.ts`.

## Structure

```
src/
  app/
    api/analyse/   flux SSE de l'agent prospecteur (3 profils)
    api/chat/      chat agentique avec appel d'outils
    modele/        page Modèle économique
    feuille-de-route/
  components/      Tableau (dashboard), Carte, Chat, Compteur
  config/          site.ts (contenu éditable), jeux.ts (catalogue pour l'agent)
  lib/             clients Hémicycle et LLM, pipelines d'analyse
```

## Licence des données

Données publiques officielles sous Licence Ouverte / Open Licence, servies par Hémicycle.
