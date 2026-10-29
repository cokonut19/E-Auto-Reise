# E-Auto-Reise

Interaktive Website über die globalen Wertschöpfungsketten hinter der E-Auto-Batterie.
Ein Schülerprojekt für potenzielle E-Auto-Käufer:innen – mit einem 3D-Globus, der zeigt,
woher Lithium, Kobalt, Nickel und Graphit kommen und wo sie verarbeitet werden.

## Lokal starten

Die Seite lädt die Daten per `fetch()`. Deshalb funktioniert ein Doppelklick auf
`index.html` nicht – der Browser blockiert den JSON-Zugriff über `file://`.
Bitte einen lokalen Server im Projektordner starten:

```bash
# Python 3
python -m http.server 5500

# oder mit Node.js
npx serve . -l 5500
```

Danach im Browser öffnen: **http://localhost:5500**

## Projektstruktur

```
/
├── index.html                  # Semantische Seitenstruktur
├── css/
│   └── styles.css              # Designsystem, Layout, Responsive & Animationen
├── js/
│   └── app.js                  # Globe.gl, Daten laden, Filter, Panels
├── data/
│   └── battery_data.json       # Rohstoff-, Lieferketten- und Quellendaten
├── assets/
│   ├── earth-night.jpg         # Globus-Textur (three-globe Beispiel)
│   ├── earth-topology.png      # Höhen-/Bump-Textur
│   ├── night-sky.png           # Sternenhimmel
│   └── favicon.svg
├── vendor/
│   └── globe.gl.min.js         # Lokaler Fallback, falls das CDN nicht erreichbar ist
├── AGENTS.md                   # Projektauftrag
└── README.md
```

`globe.gl` wird primär per CDN geladen. Schlägt das fehl, greift automatisch die lokale
Datei in `vendor/` – die Seite bleibt also auch ohne CDN-Verbindung funktionsfähig.
Die Globus-Texturen liegen lokal in `assets/`.

## Funktionen

- **3D-Globus** mit Nacht-Textur, Atmosphäre, automatischer Rotation und Orbit-Steuerung
- **5 Abbaustandorte** in Chile, Australien, der DR Kongo, Indonesien und China
- **Animierte Lieferbögen** von den Minen zu den Verarbeitungszentren
- **Filter** nach Lithium, Kobalt, Nickel und Graphit
- **Interaktive Punkte** mit Tooltip und Detail-Panel (Klick)
- **Anklickbare Standort-Labels** für eine direkte Auswahl der Lieferkette
- **Nachhaltigkeits-Check** zu Ökologie, Sozialem und Ökonomie
- **Quellenbereich** mit USGS- und IEA-Links
- Responsive Dark-Mode-Design, Tastaturbedienung und Reduced-Motion-Unterstützung
- Barrierefreie Datentabelle als Alternative zur 3D-Visualisierung

## Daten

Die JSON-Datei enthält pro Standort unter anderem:

`id`, `rohstoff`, `abbaugebiet`, `lat`, `lng`, `verarbeitung`,
`verarbeitung_lat`, `verarbeitung_lng` und `sozial_oeko_impact`
sowie zusätzliche Angaben zu Weltanteilen, Methode, Transport, Bewertung und Quellen.

Die Produktionsanteile beziehen sich – wenn nicht anders angegeben – auf 2024 und sind
gerundet. Zentrale Quellen:

- [USGS Mineral Commodity Summaries 2025](https://pubs.usgs.gov/periodicals/mcs2025/mcs2025.pdf)
- [IEA Global Critical Minerals Outlook 2025](https://www.iea.org/reports/global-critical-minerals-outlook-2025)
- [IEA Global EV Outlook 2025](https://www.iea.org/reports/global-ev-outlook-2025)
- [EU-Batterieverordnung 2023/1542](https://eur-lex.europa.eu/eli/reg/2023/1542/oj)

Die Karte ist eine didaktische Vereinfachung: In der Realität laufen Rohstoffe über
mehrere Häfen, Zwischenhändler und Raffinerien. Sie erhebt keinen Anspruch auf
Vollständigkeit und ist keine Kaufberatung.

## Technik

- HTML5, CSS3, Vanilla JavaScript (ES6+)
- [globe.gl](https://globe.gl) für die 3D-Visualisierung
- Keine Build-Tools, kein Framework – direkt im Browser lauffähig
