import { Component } from "react";
import type { ReactNode } from "react";

export interface FailSafeProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Garde-fou d'erreur de rendu : isole une fonctionnalité additive (rendements
 * d'actifs, ADR 0024). Sans lui, une exception de rendu dans un bloc démonte tout
 * l'arbre React et laisse une page blanche. Avec lui, seul le bloc fautif est
 * remplacé par `fallback`, le reste de l'application continue de fonctionner. */
export class FailSafe extends Component<FailSafeProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("FailSafe : bloc isolé après une erreur de rendu", error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
