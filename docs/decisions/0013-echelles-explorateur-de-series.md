# ADR 0013 — Échelles d'affichage de l'explorateur de séries

Demande de l'utilisateur : les courbes de l'explorateur se ressemblent et leurs différences sont
difficiles à voir (ex. la monnaie au sens large de six pays, exprimée en monnaies courantes, de
6 000 à 4 000 000 : une seule courbe domine, les autres sont écrasées contre l'axe). Il a demandé
d'arbitrer entre changer l'échelle et appliquer une formule connue d'économétrie ou de finance,
à condition qu'elle soit explicable.

## Décision : un sélecteur à quatre modes, aucune donnée modifiée

| Mode | Formule | Ce que ça rend lisible |
|---|---|---|
| Niveau (défaut) | valeurs brutes, axe linéaire | comportement d'origine |
| Logarithmique | axe en log10 | des écarts verticaux égaux = des variations en % égales ; séries rapides et lentes comparables, histoire ancienne non écrasée |
| Base 100 | 100 × x(t) / x(t0) | croissance cumulée comparable quelle que soit l'unité ou la devise (convention de la finance pour comparer des performances) |
| Centré-réduit (z) | (x − moyenne) / écart-type, par série | forme des séries comparable quelle que soit l'amplitude |

Chaque mode affiche sa formule sous le sélecteur, en français et en anglais.

Écartés : élever au carré (la transformation n'est pas invariante d'échelle, sa lecture n'est pas
interprétable et elle amplifie les écarts de manière arbitraire) ; taux de croissance annuel (il
ressemble aux indicateurs dérivés déjà présents dans le vecteur d'état, et masque les niveaux).

## Règles

- **Affichage uniquement.** Le tableau de légende et les exports CSV, TSV et JSON gardent les
  valeurs brutes (§8.2 : aucune donnée modifiée ; une note le rappelle dès qu'un mode
  transformé est actif). Seul l'export PNG reflète le graphique affiché.
- **Base 100 à une année commune.** La base est la première année où toutes les séries
  sélectionnées ont une observation (affichée dans le badge « Base 100 = année »), pour que les
  courbes se croisent à 100 à la même date. Elle suit le filtre de période.
- **Indisponibilité explicite plutôt que valeur fausse.** Le log et la base 100 exigent des
  valeurs strictement positives ; la base 100 exige en plus une année commune. Sinon le bouton est
  désactivé avec la raison en infobulle, et si le mode était déjà actif l'affichage retombe sur
  « Niveau » avec un avertissement visible (jamais de repli silencieux).
- Un écart-type nul donne 0 (pas NaN).
- La logique est dans `src/lib/seriesScale.ts` (fonctions pures), couverte par
  `tests/seriesScale.test.ts`.

## Limites connues

Sur de très longues périodes, une série affectée d'hyperinflation (le mark allemand de 1923, en
monnaie courante avec changement d'unité) écrase toujours les autres en base 100 ; le mode
logarithmique, ou un filtre de période postérieur, est alors le bon choix. Les ticks d'axe au-delà
de 10^15 passent en notation scientifique (`formatAxisNumber`).
