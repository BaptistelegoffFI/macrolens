import { useEffect, useState } from "react";

import { meta } from "../api/endpoints";
import type { SourceOut } from "../api/types";
import { EmptyState } from "../components/shell/EmptyState";
import styles from "./SourcesView.module.css";

/** §11.3 Vue Sources & méthode (F8). La page méthodologie complète (§8
 * intégralement décrit) est un livrable de Phase 7 — cette vue donne déjà
 * les sources réelles et un résumé fidèle des formules effectivement
 * implémentées, pas un texte de remplissage. */
export function SourcesView() {
  const [sources, setSources] = useState<SourceOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    meta
      .sources()
      .then((s) => {
        setSources(s);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Sources ({sources.length})</div>
        {loading && <EmptyState>Chargement…</EmptyState>}
        {error && <EmptyState>{error}</EmptyState>}
        {sources
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((s) => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardTitle}>{s.full_name}</div>
              <div className={styles.cardMeta}>
                {s.url} · priorité {s.priority} · récupéré le {s.retrieved_at}
                {s.file_sha256 && ` · sha256 ${s.file_sha256.slice(0, 12)}…`}
              </div>
              <div className={styles.cardCitation}>{s.citation}</div>
              <div className={styles.cardMeta}>{s.licence}</div>
            </div>
          ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Méthode — résumé</div>
        <div className={styles.body}>
          <p>
            <strong>Vecteur d'état (§8.1).</strong> Chaque observation (pays, année) est réduite à 14
            features réparties en 7 familles (prix, activité, taux, dette, crédit, marchés, externe). Les
            features de « niveau » (ex. inflation, dette/PIB) et de « variation » (ex. accélération de
            l'inflation, Δ dette 5 ans) sont normalisées différemment.
          </p>

          <p>
            <strong>Normalisation inter-époque (§8.2).</strong> Une feature de niveau est convertie en
            rang percentile sur une fenêtre glissante de 30 ans, strictement rétrospective (l'année
            courante est exclue, minimum 20 observations valides pour produire un rang) — c'est ce qui
            rend le moteur anti-anticipation (« zéro extrapolation silencieuse », règle 3).
          </p>
          <div className={styles.formula}>rank_level(t) = percentile_rank(valeur(t), fenêtre [t-30, t-1])</div>
          <p>
            Une feature de variation est d'abord mise à l'échelle par son écart absolu médian local
            (MAD × 1,4826, estimateur robuste de l'écart-type), puis convertie en rang percentile de la
            même façon.
          </p>
          <div className={styles.formula}>rank_variation(t) = percentile_rank(Δ(t) / (MAD × 1,4826), fenêtre)</div>

          <p>
            <strong>Distance pondérée (§8.3).</strong> La proximité entre deux états est une distance
            euclidienne sur les rangs, pondérée par famille (poids par défaut uniformes, renormalisés à
            somme 1).
          </p>
          <div className={styles.formula}>d(a, b) = √( Σ w_f · (rang_a,f − rang_b,f)² )</div>
          <p>La similarité affichée est 100 × (1 − d), donc 100 pour un point identique à lui-même.</p>

          <p>
            <strong>Réalisations (§9).</strong> Pour chaque horizon (1, 3, 5, 10 ans), les analogues
            retenus donnent une distribution empirique — médiane, quartiles, part de cas négatifs — jamais
            une moyenne isolée ni un intervalle de confiance paramétrique (règle 5). MacroLens ne prédit
            rien : il rapporte ce qui a historiquement suivi les situations les plus proches (règle 4).
          </p>
        </div>
      </div>
    </div>
  );
}
