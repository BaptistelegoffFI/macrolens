# 0003 — Constats de la Phase 3 (sources complémentaires)

Statut : appliqué. Contexte : PLAN.md §7.3, §13 Phase 3.

## 1. Raccords de monnaies (§7.3) : pas de cas d'usage réel pour l'instant

§13 Phase 3 liste « raccords de monnaies » parmi les livrables. Avant
d'implémenter `data/reference/currency_changes.yaml` et la logique de
raccord associée, vérification de si l'une des trois sources ingérées en
a réellement besoin :

- **JST** : vérifié directement — la série `gdp` (PIB nominal, France) est
  lisse et continue à travers la transition franc→euro de 1999-2002 (9190 en
  1999, 9699 en 2000, aucune rupture de niveau). JST fait déjà son propre
  raccord en interne avant publication. Toutes nos observations dérivées par
  ratio (`revenue_public_gdp`, `credit_private_gdp`, etc.) héritent de cette
  cohérence puisqu'elles divisent toujours par le `gdp` JST de la même
  année, déjà raccordé.
- **BIS (policy_rate)** : un taux d'intérêt en % n'est pas une grandeur
  monétaire — un changement de monnaie ne le déplace pas (le taux directeur
  ne "change pas de base" quand le franc devient l'euro). Aucun raccord
  possible ni nécessaire par construction.
- **Maddison (gdp_real_pc, population)** : PIB en dollars internationaux
  PPA (grandeur déjà indépendante de la monnaie nationale) et un décompte de
  population (jamais monétaire). Aucun raccord de monnaie ne s'applique.

**Décision** : `data/reference/currency_changes.yaml` n'est pas créé
maintenant. Il le sera dès qu'une source ingérée fournira des séries
nominales en monnaie locale *non pré-raccordées* par la source elle-même
(candidat plausible : une statistique nationale brute type Riksbank/Norges
Bank pour l'extension 1850-1869 des prix, si elle est ajoutée plus tard).
Construire le fichier et la logique de raccord maintenant, sans donnée réelle
à raccorder, serait de l'infrastructure spéculative — contraire à la règle
« trois lignes similaires valent mieux qu'une abstraction prématurée »
(§15, piège 6, appliqué ici à l'ETL plutôt qu'au code applicatif).

La fonction `derive.apply_splice_ratio` existe déjà (utilisée par le loader
Maddison pour le raccord de *base de prix* 1990$/2011$, §7.3 même technique
— ratio de chevauchement à l'année d'ancrage 1870) : le jour où un raccord
de monnaie est réellement nécessaire, c'est la même fonction qui s'applique,
il ne manquera que le fichier de dates/taux de conversion.
