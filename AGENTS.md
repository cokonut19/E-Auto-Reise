# Projekt: E-Auto-Reise (Interactive Web Application)

## Ziel
Erstelle eine moderne, responsive Website für potenzielle E-Auto-Käufer. Die Seite erklärt die Bestandteile von Elektroauto-Akkus, deren Nachhaltigkeitsaspekte (Gegenwart) und stellt die globale Lieferkette auf einem interaktiven 3D-Globus dar.

## Tech-Stack & Architektur
- **HTML5 & CSS3:** Modernes, cleanes Design (Dark Mode präferiert für Globus-Kontrast), mobile-first und voll responsiv.
- **JavaScript (Vanilla ES6+):** Einbindung von `globe.gl` via CDN für die 3D-Visualisierung.
- **Datenbasis:** JSON-Datei (`data/battery_data.json`).

## Projektstruktur
/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   └── battery_data.json
└── README.md

## Aufgaben für den Agenten

### 1. Datenstruktur (`data/battery_data.json`)
Anlegen der JSON-Datei mit Daten für die Rohstoffe (Lithium, Kobalt, Nickel, Graphit). Jedes Objekt muss enthalten:
- `id`, `rohstoff`, `abbaugebiet`, `lat`, `lng`, `verarbeitung`, `verarbeitung_lat`, `verarbeitung_lng`, `sozial_oeko_impact` (Kurztext für Popups).

### 2. HTML & CSS Aufbau (`index.html` & `css/styles.css`)
- **Header:** Titel "E-Auto-Reise", Untertitel und Navigation.
- **Sektion 1 (Bestandteile):** Übersicht der Akku-Komponenten (Kathode, Anode, Elektrolyt, Gehäuse) in Karten-Layout.
- **Sektion 2 (Interaktiver Globus):** Container `#globeViz` zur Darstellung des 3D-Globus mit Legendenelementen.
- **Sektion 3 (Nachhaltigkeits-Check):** Drei Spalten für Ökologie (CO2, Wasser), Soziales (Arbeitsbedingungen, Rechte) und Ökonomie (Recycling).

### 3. Globus-Logik (`js/app.js`)
- Initialisiere `Globe()` aus der `globe.gl`-Bibliothek im Container `#globeViz`.
- Lade `data/battery_data.json` dynamisch per `fetch()`.
- Zeichne Punkte für Abbaugebiete und Bögen (Arcs) vom Abbaugebiet zum Verarbeitungszentrum (z.B. China).
- Füge ein interaktives Popup/HTML-Tooltip hinzu, das bei Klick/Hover die Nachhaltigkeitsdaten anzuzeigen.

### 4. Verifikation & Test
- Prüfe die Syntax aller JS-, CSS- und HTML-Dateien.
- Starte einen lokalen Testserver (z. B. `npx serve .` oder `python3 -m http.server`), um das Ergebnis zu prüfen.
