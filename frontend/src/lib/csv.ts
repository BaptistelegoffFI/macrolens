/** Export CSV/TSV minimal (§11.4, §18.6) — pas de dépendance tierce. */
export function toDelimited(rows: (string | number | null)[][], delimiter: "," | "\t"): string {
  const escape = (v: string | number | null): string => {
    if (v === null) return "";
    const s = String(v);
    if (delimiter === "," && /[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((row) => row.map(escape).join(delimiter)).join("\n");
}

export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** §11.4/§18.6 : export PNG d'un graphique — data URL déjà produite par
 * ECharts (EChart.getDataUrl()), on ne fait que déclencher le téléchargement. */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
