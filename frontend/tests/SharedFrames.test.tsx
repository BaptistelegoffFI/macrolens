import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartFrame } from "../src/components/charts/ChartFrame";
import { ChartLightbox } from "../src/components/charts/ChartLightbox";
import { Kbd } from "../src/components/shell/Kbd";
import { Section } from "../src/components/shell/Section";
import { LanguageProvider } from "../src/i18n/LanguageContext";

const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>);

describe("composants partagés (ADR 0030)", () => {
  it("Section : un titre de groupe est un h2, un titre de bloc un h3", () => {
    wrap(
      <Section level="group" title="Groupe" meta="méta">
        <Section level="block" title="Bloc">
          contenu
        </Section>
      </Section>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Groupe" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Bloc" })).toBeInTheDocument();
    expect(screen.getByText("méta")).toBeInTheDocument();
  });

  it("ChartFrame : titre, unité, pied et export dans le même cadre", async () => {
    const onExport = vi.fn();
    wrap(
      <ChartFrame title="Prix" unit="indice" footnote="jst · build abc" onExport={onExport}>
        <div>graphique</div>
      </ChartFrame>,
    );
    expect(screen.getByText("Prix").closest("figure")).toContainElement(screen.getByText("graphique"));
    expect(screen.getByText("indice")).toBeInTheDocument();
    expect(screen.getByText("jst · build abc")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exporter PNG" }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("ChartFrame : sans export ni pied, aucun pied n'est dessiné", () => {
    wrap(
      <ChartFrame title="Seul">
        <div>g</div>
      </ChartFrame>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Kbd : un raccourci est un élément <kbd>", () => {
    wrap(<Kbd>F5</Kbd>);
    expect(screen.getByText("F5").tagName).toBe("KBD");
  });

  it("plein écran : Échap, le bouton Fermer et un clic hors du cadre ferment", async () => {
    const onClose = vi.fn();
    wrap(
      <ChartLightbox onClose={onClose}>
        <div>grand graphique</div>
      </ChartLightbox>,
    );
    expect(screen.getByRole("dialog")).toContainElement(screen.getByText("grand graphique"));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("plein écran : un clic dans le cadre ne ferme pas", async () => {
    const onClose = vi.fn();
    wrap(
      <ChartLightbox onClose={onClose}>
        <div>contenu</div>
      </ChartLightbox>,
    );
    await userEvent.click(screen.getByText("contenu"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
