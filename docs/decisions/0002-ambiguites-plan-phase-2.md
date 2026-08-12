# 0002 — Ambiguïtés et constats de la Phase 2 (ingestion JST)

Statut : à valider avec l'utilisateur (contrairement à 0001, ces points
touchent directement les critères d'acceptation §13 Phase 2). Contexte :
PLAN.md §3, §5.1, §13 Phase 2.

## 1. « ≥ 250 000 observations » n'est pas atteignable avec JST seul

Le dataset JST R6, une fois filtré aux 17 pays du pool (§2.1, l'Irlande
exclue — voir point 3), contient 2 718 lignes (pays, année). Notre mapping
(`etl/mappings/jst.yaml`) en tire 19 indicateurs directs/dérivés + 2 indices
chaînés (actions) = 21 codes au maximum par ligne. Plafond théorique :
2 718 × 21 ≈ 57 000 observations, en supposant zéro valeur manquante — ce qui
n'est jamais le cas sur 155 ans d'historique. **Mesuré : 54 737
observations**, cohérent avec ce plafond.

Le chiffre « ~250 000 lignes » vient de §3 (architecture), qui décrit la
table `observations` en fin de projet, une fois Maddison, BIS (×3), IMF
(×3), OCDE, Eurostat, Riksbank, Norges Bank et BoE ajoutés (Phase 3+) — et
surtout une fois la couche mensuelle post-1955 activée (§2.3 : IPC, taux,
actions, chômage, change en fréquence mensuelle multiplient chaque série par
~12 sur 65 ans). Ce chiffre a été copié tel quel dans le critère
d'acceptation Phase 2 sans être recalculé pour une ingestion JST seule —
même nature d'incohérence que les points 1 et 2 de 0001-ambiguites-plan-phase-1.md
(un total de fin de section copié dans une case à cocher de phase).

**Recommandation** : traiter « ≥ 250 000 observations » comme un jalon de
fin de Phase 3 (ou au-delà), pas de Phase 2. Le critère mesurable pour
Phase 2 est la complétude par indicateur (point 2 ci-dessous) et la
reproductibilité du pipeline (validée : `macrolens etl run-all` rejoué de
zéro, hash de fichier identique, comptes identiques).

## 2. Finlande × dette publique/PIB : 68,3 % de complétude, sous la barre des 90 %

`reports/coverage.md` montre une seule case sous 90 % : `debtgdp` pour la
Finlande, à 68,3 %. Vérifié directement dans le fichier `.dta` : JST ne
contient **aucune** donnée de dette publique finlandaise avant 1914 (44
années consécutives, 1870-1913). Ce n'est pas un trou d'ingestion — c'est
l'absence réelle de statistiques de dette publique finlandaise en tant
qu'État souverain avant l'indépendance de 1917 (la Finlande était un
Grand-Duché autonome de l'Empire russe). Les 5 autres pays cœur et les 5
autres indicateurs clés sont tous à 88,5 % ou plus, la plupart à 100 %.

**Ce n'est pas fabricable sans une source complémentaire** (IMF Historical
Public Debt Database ou une statistique nationale finlandaise pré-1914,
toutes deux prévues en Phase 3, pas en Phase 2). Le remplir maintenant
reviendrait à anticiper une source non encore ingérée pour satisfaire un
chiffre — exactement ce que la règle 2 (CLAUDE.md) interdit dans l'autre
sens (ingérer sans vérifier).

**Recommandation** : documenter l'exception (fait, ici) plutôt que la
masquer ou la fabriquer ; la combler en Phase 3 quand `imf_ghd` sera ingéré.

## 3. Irlande exclue du pool malgré sa présence dans JST R6

JST R6 couvre 18 pays (l'Irlande a été ajoutée dans cette version). Le
plan liste explicitement 17 pays en §2.1 sans l'Irlande. Décision : filtrer
`IRL` à la lecture (`jst.py::_load_known_countries`), pas l'ajouter à
`countries.yaml` — le plan est explicite sur les 17 pays, ce n'est pas un
oubli à corriger mais un pays hors périmètre v1 assumé.
