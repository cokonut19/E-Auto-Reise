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

Die Website besteht aus fünf Seiten, die man der Reihe nach durchklicken kann
(Weiter-Button oder Pfeiltasten ← →, z. B. für eine Präsentation):

```
/
├── index.html                  # 1 · Start: 3D-Globus + Liniennetz der Rohstoffe
├── akku.html                   # 2 · Bestandteile der Batterie
├── nachhaltigkeit.html         # 3 · Nachhaltigkeits-Check
├── recycling.html              # 4 · Recycling: Kreislauf, Second Life, EU-Quoten
├── quellen.html                # 5 · Quellen & Methodik
├── css/
│   └── styles.css              # Designsystem, Layout, Responsive & Animationen
├── js/
│   └── app.js                  # Globus, Daten laden, Filter, Panels, Rundgang
├── data/
│   └── battery_data.json       # Rohstoff-, Lieferketten- und Quellendaten
├── assets/                     # Globus-Texturen, Sternenhimmel, Favicon
├── vendor/
│   └── globe.gl.min.js         # Lokaler Fallback, falls das CDN nicht erreichbar ist
├── AGENTS.md                   # Projektauftrag
└── README.md
```

`globe.gl` wird primär per CDN geladen. Schlägt das fehl, greift automatisch die lokale
Datei in `vendor/` – die Seite bleibt also auch ohne CDN-Verbindung funktionsfähig.
Die Globus-Texturen liegen lokal in `assets/`.

## Funktionen

- **5 Seiten statt einer langen Scroll-Seite**: Desktop-Navigation oben, auf dem Handy eine Tab-Leiste unten
- **Rundgang** mit Zurück/Weiter-Buttons und Pfeiltasten-Steuerung
- **Wenig Text**: Kernaussage + Zahl sichtbar, Details über „Mehr erfahren“ aufklappbar
- **3D-Globus** mit Nacht-Textur, animierten Lieferbögen, Filter nach Lithium, Kobalt, Nickel und Graphit
- **Detail-Panel** pro Abbaustandort mit Route, Weltanteil, Bewertung und Quellen
- **Liniennetzplan** der Routen von den Minen zur Verarbeitung in China
- **Zellquerschnitt**, der beim Überfahren der Bestandteile die passende Schicht hervorhebt
- **Nachhaltigkeits-Check** zu Ökologie, Sozialem und Ökonomie
- **Recycling-Seite** mit Kreislauf-Grafik, Kennzahlen (Second Life, Schwarzmasse, Kapazitäten) und den EU-Quoten der Batterieverordnung
- **Quellenseite** mit USGS-, IEA-, EU- und OECD-Links sowie eigenem Block für die Recycling-Quellen (EU, UBA, Fraunhofer ISI/FFB, JRC, IEA)
- **Hell- und Dunkelmodus**: folgt automatisch der Systemeinstellung, Umschalter (Sonne/Mond) oben rechts speichert die Wahl; der Globus bleibt in beiden Modi auf dunklem Hintergrund
- Tastaturbedienung, Reduced-Motion-Unterstützung und barrierefreie Datentabelle
- Alte Links wie `index.html#quellen` leiten automatisch auf die neue Seite weiter

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
