/** Dernier filet : affiché si l'application entière échoue au rendu. N'utilise ni contexte de
 * langue ni feuille de style (ils peuvent être la cause de l'échec), donc bilingue et en ligne. */
export function RootFallback() {
  return (
    <div
      role="alert"
      style={{
        maxWidth: 520,
        margin: "15vh auto 0",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 8px" }}>
        MacroLens n'a pas pu s'afficher / MacroLens could not be displayed
      </p>
      <p style={{ margin: "0 0 12px" }}>
        Une erreur inattendue est survenue. Rechargez la page ; si le problème persiste, réessayez dans
        une minute.
        <br />
        An unexpected error occurred. Reload the page; if it persists, try again in a minute.
      </p>
      <button type="button" onClick={() => window.location.reload()}>
        Recharger / Reload
      </button>
    </div>
  );
}
