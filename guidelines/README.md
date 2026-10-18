# Designguide

Dieser Guide legt fest, wie Ansichten in unseren Webanwendungen aussehen und sich verhalten: Shell, Dashboard, Liste, Kanban und Detail- bzw. Belegansicht. Er gilt für jedes Projekt. Was ein Projekt eigen macht, also Markenfarbe, Logo und Fachbegriffe, steht in einem **Profil** und in einer kurzen Projektnotiz, nicht in eigenen Regeln.

Grundlage ist der ERP Designguide v3 (`designguidelines/`). Version 4 löst ihn von der ERP-Plattform, trennt Marke und Basis und schliesst die Kontrastlücken, die beim Einsatz in BANDspirit aufgefallen sind. Die Änderungen stehen unter [Änderungen gegenüber v3](#änderungen-gegenüber-v3).

## Inhalt

| Datei | Zweck |
|---|---|
| `tokens.json` | Einzige Quelle aller Werte: Basisfarben, Markenrollen, Profile, Kontrastpaare, Schrift, Abstände, Radien, Grössen. |
| `css/tokens.css` | Basis-Tokens als CSS-Variablen (`--ds-*`), Hell und Dunkel. Generiert. |
| `css/profiles/<profil>.css` | Markenfarben eines Profils, Hell und Dunkel. Generiert. |
| `css/tailwind-theme.css` | Einbindung in Tailwind CSS 4: Farbklassen, Radien, Dunkel-Variante, Basisstile. |
| `css/shadcn-bridge.css` | Setzt die shadcn/ui-Variablen auf die Guide-Tokens. |
| `css/components.css` | Komponenten-Styles ohne Framework (Präfix `ds-`), Referenz für Masse und Zustände. |
| `scripts/build-tokens.mjs` | Erzeugt die CSS-Dateien aus `tokens.json` und prüft alle Kontraste. |

Tokens nie in den CSS-Dateien ändern, sondern in `tokens.json`, dann:

```bash
node guidelines/scripts/build-tokens.mjs           # CSS schreiben und Kontraste prüfen
node guidelines/scripts/build-tokens.mjs --check   # nur prüfen (Exit-Code 1 bei Verstoss)
```

## Schnellstart

**Tailwind CSS 4** (empfohlen):

```css
@import 'tailwindcss';
@import '../guidelines/css/tokens.css';
@import '../guidelines/css/profiles/standard.css';   /* oder das Profil des Projekts */
@import '../guidelines/css/tailwind-theme.css';
@import '../guidelines/css/shadcn-bridge.css';       /* nur mit shadcn/ui */
```

**Ohne Framework:** `tokens.css`, ein Profil und `components.css` einbinden, den Inhalt in `<div class="ds">` setzen und die Klassen aus `components.css` verwenden (`ds-btn`, `ds-panel`, `ds-table` …).

**Theme:** `<html data-theme="light">` oder `"dark"`. Ohne Attribut folgt die Seite der Systemeinstellung. Mit next-themes: `attribute="data-theme"`, `enableSystem`.

## Grundsätze

- **Ruhig und neutral als Basis.** Seitengrund `page`, Flächen `surface`, Rahmen `border`. Farbe trägt Bedeutung: `primary` für Navigation und Auswahl, `action` für die eine wichtigste Aktion, Statusfarben nur für Zustände.
- **Eine Primäraktion pro Ansicht.** Nur ein Button in `action`. Alles andere ist ein Sekundär-Button.
- **Rahmen statt Schatten.** Panels, Kacheln und Karten trennen sich durch 1px `border`. Schatten gibt es nur für verschiebbare Karten beim Hover (`shadow-card-hover`) und für schwebende Ebenen (Menüs, Popover, Dialoge).
- **Zusammenhänge sichtbar machen.** Ein Objekt nennt, woraus es entstanden ist und was daraus folgt, als Links in `primary` (z. B. «Aus Spannung S-2026-014 · Arbeitsauftrag A-2026-031»).
- **Startseite = Arbeitsvorrat.** Die Startseite zeigt, was die Person heute erledigen muss. Übersichten und Diagramme gehören in die Dashboards der Bereiche.
- **Das Backend ist massgebend.** Berechnete Werte, Berechtigungen und erlaubte Statuswechsel kommen von der API. Die Oberfläche zeigt nur Aktionen, die im aktuellen Zustand zulässig sind.

## Sprache und Inhalte

- Oberfläche auf Deutsch, Anrede **Sie**, Schweizer Schreibweise mit «ss».
- Buttons sagen genau, was passiert: «Spannung erfassen», «Zahlung erfassen», «Per E-Mail senden», «Filter als Ansicht speichern». Kein «OK», kein «Absenden».
- Untertitel nennen Umfang und Kontext in einem Satz: «Spannungen aus allen Kreisen, in denen Sie mitwirken.»
- Nummern von Objekten folgen einem festen Muster (Präfix, Jahr, laufende Nummer, z. B. `RE-2026-0947`). Sie stehen in `body-medium` und `primary` und sind Links. Das Projekt legt die Präfixe fest.
- Automatisierte Akteure werden benannt («n8n Automatisierung», «System»), im Verlauf mit eigenem Marker.
- Status heissen wie im Fachprozess des Projekts. Jeder Status hat genau eine Statusfarbe (siehe Farbe).
- **Gebietsschema de-CH.** Zahlen, Beträge und Daten werden über `Intl.NumberFormat('de-CH')` / `Intl.DateTimeFormat('de-CH')` bzw. `CultureInfo("de-CH")` formatiert, nie von Hand.
  - Beträge `CHF 48’750.00`: Währungscode vorne, Apostroph als Tausendertrenner, zwei Nachkommastellen; in Kacheln ohne Rappen `CHF 284’560`.
  - Prozent ohne Leerzeichen `12.4%`. Datum `16.10.2026`, Uhrzeit `09:14`, ausgeschrieben «Freitag, 16. Oktober 2026». Relative Zeit nur in Feeds («vor 12 Min.»).
  - Schweizer Begriffe: MWST, UID-Nummer, IBAN `CH…`, QR-Rechnung.
- Ziffern in Tabellen, Kacheln und Summen immer `tabular-nums`. Einheiten stehen beim Wert: «12 Stk.», «16 Std.».

## Farbe

Die Farben sind in drei Gruppen geteilt:

| Gruppe | Tokens | Wo festgelegt |
|---|---|---|
| **Basis** | `page`, `surface`, `ink`, `ink-secondary`, `muted`, `subtle`, `border`, `input`, `divider`, Statusfarben, Avatar-Farben | `tokens.json` › `color.base`, für alle Projekte gleich |
| **Marke** | `primary`, `on-primary`, `sidebar-bg`, `sidebar-border`, `sidebar-marker`, `marker`, `action`, `action-hover`, `on-action` | im Profil |
| **Abgeleitet** | `focus-ring`, `primary-tint-03` … `primary-tint-20`, `marker-tint` | per `color-mix()` aus der Marke berechnet |

- **Text:** `ink` für Inhalt, `ink-secondary` für Fliesstext und Werte in Steuerelementen, `muted` für Labels, Untertitel und Zeitstempel. `subtle` nur für Dinge, die man nicht lesen muss (Chevrons, Achsen, Platzhalter-Icons).
- **Auswahl:** `primary` markiert aktiven Tab, gedrücktes Segment, gesetzte Checkbox, Links. Die Tints sind für ausgewählte Zeilen, Chips, Icon-Kacheln und Badges reserviert.
- **Orange in zwei Rollen:** `action` ist die Fläche mit Schrift (Primär-Button, Zähler-Badge, Logo-Platzhalter). `marker` ist der Akzent ohne Schrift (Benachrichtigungspunkt, hervorgehobener Diagrammwert).
- **Status:** `success-strong` / `success-bg` (aktiv, erledigt), `info` / `info-bg` (in Bearbeitung, gesendet), `warning-strong` / `warning-bg` (offen, überfällig), `danger` / `danger-bg` (kritisch, destruktiv), `attention` / `attention-bg` (Frist läuft ab). Neutral: `ink-tertiary` auf `divider` (Entwurf). `success` und `warning` ohne «-strong» nur für Punkte und Balken ohne Text.
- **Rahmen:** `border` aussen und unter Köpfen, `divider` zwischen Zeilen, `input` für Eingabefelder, Selects und Checkboxen, `border-strong` für Hover von Karten.
- **Diagramme:** aktuelle Serie `primary`, Vergleichsserie `chart-previous`, hervorgehobener Wert `marker`, Gitter gestrichelt in `divider`, Achsenbeschriftung `micro` in `subtle`.
- Ein Status pro Objekt erhält Farbe. Ein zweites Badge nur für eine unabhängige Dimension.
- Komponenten verwenden ausschliesslich Tokens, nie Hex-Werte oder Tailwind-Standardfarben. Dann funktionieren beide Themes ohne Zusatzaufwand.

### Profile

| Profil | Marke | Einsatz |
|---|---|---|
| `standard` | Marineblau `#1e3a5f` / dunkel `#8fb3e0` | Ausgangsprofil, ERP-Plattform |
| `bandspirit` | Petrol `#2a6b64` / dunkel `#7cc4ba` | BANDspirit |

**Neues Profil anlegen:**

1. In `tokens.json` unter `profiles` einen Eintrag mit `light` und `dark` anlegen, alle Markenrollen ausfüllen.
2. `primary` muss auf `surface` und `page` 4.5:1 erreichen. Ist die Markenfarbe heller, eine dunklere Stufe als `primary` nehmen und die helle Originalfarbe nur für Logo und Illustrationen verwenden.
3. `sidebar-bg` so dunkel wählen, dass 70 % Weiss (`sidebar-ink-muted`) 4.5:1 erreicht. Bei mittelhellen Marken heisst das: dunkler als `primary` (BANDspirit: Sidebar `#1c4d48`, Primary `#2a6b64`).
4. `sidebar-marker` muss auf dem aktiven Eintrag 3:1 erreichen; auf Grün- und Blautönen funktioniert ein helles Orange.
5. `node guidelines/scripts/build-tokens.mjs` ausführen. Das Skript prüft 27 Paare je Theme und bricht bei einem Verstoss ab.

## Typografie

- Eine Familie: **Inter** (400/500/600/700), Ersatz `system-ui`. Für Code eine Monospace-Schrift.
- Pro Seite ein `page-title` (24px). Panels im Hauptbereich mit `section-title` (16px), Panels in der rechten Spalte und Karten mit `card-title` (14px).
- Fliesstext `body` 14px. In dichten Tabellen ist 13px zulässig. Namen, Nummern, Buttons und Tabs in `body-medium`. Zweite Zeilen in `small` (12px) und `muted`.
- Spaltenköpfe, KPI-Labels und Gruppenüberschriften in `caption-caps`: 11px, 500, Laufweite 0.06em, Grossbuchstaben.
- Grosse Zahlen: `kpi-value` 28px, `figure` 20px. Titel und KPI-Werte mit Laufweite −0.02em.
- 10px (`micro`) nur für Achsen und Initialen in kleinen Avataren.

## Abstände und Raster

- Tailwind-Schritte, die Namen folgen den Klassen: `space-2` = 8px, `space-3-5` = 14px.
- Seitenrand `space-8` seitlich, `space-7` oben. Sektionen `space-6`, Kacheln und Spalten im Raster `space-5`, Kanban-Spalten `space-4`.
- Innenabstand: Panels im Hauptbereich `space-6`, Panels in der rechten Spalte und KPI-Kacheln `space-5`, Karten `space-3-5`, Tabellenzellen `space-3`, mit `space-6` an erster und letzter Spalte.
- Höhen: `control-lg` 36px Standard, `control-md` 32px in Panel-Köpfen und Pagination, `control-sm` 28px für Segmente und Zeilen-Icons. Klickflächen nie unter 24 × 24px (WCAG 2.5.8).
- Layout: Sidebar `sidebar-width` (248px), Topbar `topbar-height` (64px). Inhalt im 12-Spalten-Raster: Hauptbereich 8, rechte Spalte («Rail») 4. Unter 1280px eine Spalte, unter 1024px wird die Sidebar zur Schublade.

## Formen und Zustände

- Radien: `radius-lg` 8px für Panels, Kacheln, Karten. `radius-md` 6px für Buttons, Felder, Navigation. `radius-sm` 4px für Checkboxen, Segmente, Tags. `radius-full` für Badges, Chips, Avatare. `radius-xs` 2px für Diagrammbalken.
- Hover: Sekundär-Buttons und Tabellenzeilen `page`, Icon-Buttons `divider`, Primär-Button `action-hover`, Links unterstrichen.
- Auswahl: Zeile `primary-tint-03` plus gesetzte Checkbox; bei aktiver Auswahl erscheint die Massenaktionsleiste über der Tabelle.
- Fokus: jedes Bedienelement bei `:focus-visible` mit 2px-Umriss in `focus-ring`, 2px Abstand.
- Deaktiviert: Deckkraft 50 %, `cursor: not-allowed`, Grund in einem Tooltip oder Hinweis.
- Berechnete, nicht editierbare Felder haben den Grund `page` und rechts eine Notiz in `muted` («in 30 Tagen»).

## Ikonografie

- Eine Icon-Bibliothek pro Projekt, Linien- oder Vollstil durchgehend. Empfohlen: **Lucide** (React) oder **Font Awesome 6** (*solid*/*regular*). Keine Emoji als Icons.
- Grössen: 16px in Navigation und Kacheln, 12–14px in Buttons und Feldern, 10–11px in Badges und Chips.
- Icons in Sekundär-Buttons in `muted`, in Primär-Buttons in `on-action`.
- Icon-Kacheln (32px, `radius-md`) in `primary-tint-08` / `primary`; Akzentvariante `marker-tint` mit Icon in `attention`.
- Icons ohne Text brauchen ein `aria-label`; dekorative Icons `aria-hidden="true"`.
- **Logo:** Das eigene Logo eines Projekts gibt es in zwei Dateien, hell und dunkel (z. B. `logo.png` und `logo-dark.png`); im dunklen Theme werden dunkle Schrift und Bildmarke hell (`ink` des dunklen Themes), farbige Elemente bleiben. Umgeschaltet wird mit `dark:hidden` / `hidden dark:block`. Von Benutzern hochgeladene Logos haben keine dunkle Variante: Sie stehen immer auf `logo-bg` (weiss), höchstens 28px hoch und 160px breit. Ohne Logo zeigt die Sidebar die Initialen des Produkts auf `action`.

## Seitentypen

**Shell.** Sidebar mit Produktname, Navigation (flach, Gruppen mit `caption-caps`-Label) und Benutzerkarte. Topbar mit Pfadangabe, globaler Suche, Benachrichtigungen und Benutzermenü. Das Benutzermenü enthält Name, E-Mail, **Darstellung (Hell, Dunkel, System)** und Abmelden.

**Dashboard.** `PageHeader` mit Datum oder Zeitraum, höchstens eine Primäraktion. Darunter höchstens vier `KpiTile`. Im Hauptbereich ein Diagramm- oder Listen-Panel, in der Rail «Heute fällig» und Aktivitäten.

**Liste.** `PageHeader` mit Export als Sekundär- und «Neu …» als Primäraktion. Darunter `Tabs` für gespeicherte Ansichten mit Zählern, eine Werkzeugleiste (Suche, aktive Filter als Chips, Sortierung) und die Tabelle mit Pagination.

**Kanban.** `PageHeader` mit Ansichtsumschalter (Kanban, Liste). Eine Spalte pro Status. Das Verschieben einer Karte löst den Statuswechsel über die API aus; nicht erlaubte Ziele nehmen keine Karte an. Statuswechsel sind auch per Tastatur möglich (Menü «Verschieben nach …»).

**Detail / Beleg.** Aktionsleiste mit Primäraktion, Sekundäraktionen, Trenner, destruktiver Aktion als Ghost-Button in `danger`, rechts ein schreibgeschützter `StatusStepper`. Hauptbereich mit Kopf (Nummer, Status), zweispaltigem Formular, Tabs und Positionen; Rail mit Status, Anhängen und Verlauf.

## Reduktion

1. **Startseite = Arbeitsvorrat.** «Heute fällig», offene Freigaben, höchstens vier Kennzahlen.
2. **Eine Aussage pro KPI-Kachel:** Wert plus eine Kontextzeile (Trend oder Anteil).
3. **Zähler nur bei Handlungsbedarf.** Die Sidebar zählt, was jemand erledigen muss, keine Bestände.
4. **Tabellen mit höchstens sechs Datenspalten.** Kontaktwege und Zeilenaktionen beim Hover, im Fokus oder in der Detailansicht.
5. **Filterspalte standardmässig eingeklappt;** aktive Filter als Chips.
6. **Karten ohne Status-Badge,** wenn die Spalte den Status nennt.
7. **Rail mit höchstens drei Panels.** Reine Hinweise wandern in den Verlauf.
8. **Kein Status-Footer.** Version und Systemstatus unter Einstellungen; eine Störung als Banner über dem Inhalt.
9. **Höchstens drei Header-Aktionen,** weitere unter «Mehr».
10. **Keine dekorativen Effekte:** keine Glas-Flächen, keine Verläufe auf Bedienelementen, keine Einblendanimationen für Inhalte, die sofort lesbar sein sollen.

## Barrierefreiheit

Ziel ist **WCAG 2.1 AA in beiden Themes**. Die Tokens erfüllen die Kontraste bereits; `build-tokens.mjs` prüft sie für jedes Profil:

| Anforderung | Umsetzung |
|---|---|
| Text 4.5:1 (1.4.3) | `ink`, `ink-secondary`, `muted`, `primary`, Statustexte auf ihren Gründen; `on-action` auf `action` |
| Bedienelemente und Icons 3:1 (1.4.11) | `input` für Feld- und Checkbox-Rahmen, `marker`, `sidebar-marker`, `focus-ring` |
| Fokus sichtbar (2.4.7) | 2px `focus-ring`, 2px Abstand, an allen Bedienelementen |
| Blöcke überspringen (2.4.1) | Sprunglink «Zum Inhalt springen» als erstes Element, Ziel `<main id="inhalt" tabindex="-1">` |
| Orientierung (2.4.8, 4.1.2) | aktive Navigation mit `aria-current="page"`, Navigation als `<nav aria-label>`, aufklappbare Gruppen mit `aria-expanded` |
| Nicht nur Farbe (1.4.1) | Badges tragen ein Wort, Trends einen Pfeil, Statuspunkte stehen neben einem Label |
| Bewegung (2.3.3) | `prefers-reduced-motion` schaltet Animationen und Übergänge ab |
| Darstellung wählbar | Benutzermenü «Darstellung: Hell, Dunkel, System», gespeichert pro Person bzw. Browser |
| Zielgrösse (2.5.8, AA in 2.2) | Klickflächen mindestens 24 × 24px, Standard 36px |
| Tastatur (2.1.1) | alles per Tastatur erreichbar, Drag-and-drop mit Alternative |

## Umsetzung mit Tailwind CSS 4

- Klassen heissen wie die Tokens: `bg-surface`, `text-muted`, `border-input`, `bg-action text-on-action`, `bg-primary-tint-10`. Keine Tailwind-Standardfarben (`slate-500`, `orange-500`) und keine Hex-Werte in Klassen (`bg-[#1e3a5f]`).
- Dunkel braucht keine `dark:`-Varianten, weil die Tokens umschalten. `dark:` nur für echte Ausnahmen (Bilder, Illustrationen); die Variante greift bei `data-theme="dark"`.
- Abstände folgen der Tailwind-Skala (`space-3-5` = `p-3.5`).
- Wiederkehrende Bausteine (Button, Badge, Panel, KpiTile, PageHeader) als React-Komponenten mit Varianten (`cva`) bauen, nicht als Klassenketten kopieren. `components.css` dient als Referenz für Masse und Zustände.
- Mit shadcn/ui: `shadcn-bridge.css` einbinden. Achtung, shadcn `muted` und `accent` sind Flächen, nicht Text- bzw. Akzentfarben (Details in der Datei). Button-Variante `action` für die Primäraktion ergänzen, Schatten und `active:scale` entfernen.
- Für Klassen aus Datenbankwerten (z. B. Kategoriefarben) `@source inline(...)` statt der früheren `safelist` verwenden.

## Projektnotiz

Jedes Projekt hält in seiner eigenen Dokumentation (z. B. `CLAUDE.md` oder `STYLE_GUIDE.md`) fest:

- welches Profil es nutzt,
- die Präfixe seiner Objektnummern und die Namen seiner Status,
- bewusste Abweichungen vom Guide mit Grund.

**BANDspirit:** Profil `bandspirit`. Das Frontend (`frontend/app/tokens.css`) setzt die shadcn-Variablen als HSL-Kanäle, weil die Kreisansicht Farben mit `hsl(var(--x) / α)` mischt. Die Werte entsprechen dem Profil; die Umstellung auf die `--ds-*`-Dateien dieses Ordners ist offen. Icons: Lucide.

## Änderungen gegenüber v3

| Bereich | v3 (ERP) | v4 |
|---|---|---|
| Geltung | ERP-Plattform | jedes Projekt; Marke im Profil |
| Variablen | `--primary`, `--muted` … | Präfix `--ds-`, keine Kollision mit shadcn |
| Tints | feste Hex-Werte mit Alpha | `color-mix()` aus `primary` |
| `muted` | `#64748b`, auf `divider` 4.3:1 | `#5b6b80` hell, `#97a3b5` dunkel, überall ≥ 4.5:1 |
| Feldrahmen | `border`, 1.2:1 | neues Token `input`, ≥ 3:1 |
| `marker` (v3 `accent`) | `#e67e22`, auf Weiss 2.85:1 | `#d9731c`, 3.3:1 |
| Sidebar | Labels 55 % Weiss | Text 80 %, Labels 70 % Weiss; Sidebar bei Bedarf dunkler als `primary` |
| Fliesstext | 13px | 14px, 13px nur in dichten Tabellen |
| Icons | Font Awesome 6.5.1 | Lucide oder Font Awesome, eine Bibliothek pro Projekt |
| Schatten | nur Kanban-Hover | zusätzlich schwebende Ebenen |
| Theme ohne Attribut | Systemeinstellung | unverändert; Auswahl im Benutzermenü ist Pflicht |
| Barrierefreiheit | Kontrastkorrekturen | zusätzlich Sprunglink, `aria-current`, reduzierte Bewegung, Zielgrössen, Prüfskript |

## Noch offen

- Druck- bzw. PDF-Vorlage für Belege (QR-Rechnung, Logo, Briefkopf).
- Diagramm-Palette für mehr als zwei Serien.
