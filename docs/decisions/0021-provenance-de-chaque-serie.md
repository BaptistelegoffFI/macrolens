# ADR 0021 — Chaque série porte sa provenance

Un chiffre sans provenance ne part pas. Chaque série renvoyée par l'API porte : son **tier**, sa
**source** (ligne de `sources` : identifiant, citation, URL, licence), sa **citation de série**, son
type de mesure, ses **années de début et de fin** (globales, et par pays pour les pays de la requête),
ses avertissements (`caveat_fr`, `caveat_en`).

## Traçabilité jusqu'au fichier

`asset_observations` suit le même contrat que `observations` : `raw_file_id` (le .dta JST archivé et
son hash), `locator` (ligne et variables du fichier), `raw_value_text`, chaîne de transformation. Un
test relit 200 valeurs au `locator` dans le fichier brut et retrouve la valeur exacte (retour à la
source, §18.8). Les drapeaux d'interpolation de JST sont conservés (`is_interpolated`).

## Citation exigée par JST

JST impose de citer Jordà, Knoll, Kuvshinov, Schularick et Taylor (2019), « The Rate of Return on
Everything, 1870-2015 », *Quarterly Journal of Economics* 134(3), 1225-1298, pour toute donnée de
prix d'actifs ou de rendements. Elle figure dans la citation de chaque nouvelle série. La citation
de la ligne `sources` existante (article de 2017 seul) n'est **pas** modifiée : elle alimente
l'endpoint déjà déployé `/meta/sources`. À ajouter après la mise en ligne, sur décision.

## Licence

La source JST est déclarée CC BY-NC-SA : usage non commercial, attribution, partage à
l'identique. L'outil étant montré à des gérants de portefeuille, un usage commercial devrait être
clarifié avec les auteurs. Ce point est signalé, pas tranché ici.
