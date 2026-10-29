/* =========================================================
   E-Auto-Reise – application logic
   Vanilla ES6+, globe.gl, fetch-based data
   ========================================================= */

(() => {
  'use strict';

  const DATA_URL = 'data/battery_data.json';
  const GLOBE_CDN = 'https://unpkg.com/globe.gl@2.46.2/dist/globe.gl.min.js';
  const LOCAL_GLOBE = 'vendor/globe.gl.min.js';
  const PALETTE = ['#22d3ee', '#818cf8', '#f59e0b', '#a3e635'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GROUP_NOTES = {
    Lithium: 'Chile und Australien liefern zusammen über die Hälfte des weltweit geförderten Lithiums. Die Raffination konzentriert sich stark auf China.',
    Kobalt: 'Der Kongo ist mit Abstand der wichtigste Kobaltproduzent. Die Verarbeitung findet überwiegend in China statt.',
    Nickel: 'Indonesien ist der größte Nickelproduzent. Ein Teil wird vor Ort verarbeitet, ein großer Teil geht zur Weiterverarbeitung nach China.',
    Graphit: 'China dominiert sowohl den Abbau als auch die Verarbeitung von Batteriegraphit – die Lieferkette ist besonders stark konzentriert.'
  };

  const state = {
    materials: [],
    groups: [],
    filter: 'all',
    selectedId: null,
    globe: null,
    controls: null,
    points: [],
    arcs: [],
    rings: [],
    htmlLabels: [],
    globeReady: false,
    userInteracted: false,
    resizeObserver: null,
    readyTimer: null
  };

  const dom = {};

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));

  const escapeAttr = (value) => escapeHtml(value);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const clampPercent = (value) => clamp(Number(value) || 0, 0, 100);

  function trimText(value, maxLength) {
    const text = String(value ?? '');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
  }

  function isValidHexColor(value) {
    return /^#[0-9a-f]{3}$/i.test(String(value)) || /^#[0-9a-f]{6}$/i.test(String(value));
  }

  function colorWithAlpha(hex, alpha) {
    let normalized = String(hex || '').replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map((character) => character + character).join('');
    }
    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
      return `rgba(34, 211, 238, ${alpha})`;
    }
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value), window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function levelClass(value) {
    const map = {
      kritisch: 'critical',
      hoch: 'high',
      mittel: 'medium',
      niedrig: 'low'
    };
    return map[String(value || '').toLowerCase()] || 'medium';
  }

  function getGlobeConstructor() {
    if (typeof window.Globe === 'function') return window.Globe;
    if (window.globe && typeof window.globe.Globe === 'function') return window.globe.Globe;
    if (typeof window.GlobeGL === 'function') return window.GlobeGL;
    return null;
  }

  function supportsWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (error) {
      return false;
    }
  }

  async function loadScript(source) {
    return new Promise((resolve, reject) => {
      const absoluteSource = new URL(source, window.location.href).href;
      const existing = Array.from(document.scripts).find((script) => script.src === absoluteSource);

      if (existing) {
        if (getGlobeConstructor()) {
          resolve(true);
          return;
        }
        // The deferred script tag has already had its chance. Remove a failed
        // element so a fresh request cannot hang on a stale load event.
        existing.remove();
      }

      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Konnte ${source} nicht laden.`));
      document.head.appendChild(script);
    });
  }

  function waitForGlobe(timeout = 2200) {
    return new Promise((resolve) => {
      const started = performance.now();
      const tick = () => {
        if (getGlobeConstructor()) {
          resolve(true);
          return;
        }
        if (performance.now() - started >= timeout) {
          resolve(false);
          return;
        }
        window.setTimeout(tick, 100);
      };
      tick();
    });
  }

  async function ensureGlobeLibrary() {
    if (getGlobeConstructor()) return true;
    if (await waitForGlobe(1800)) return true;

    for (const source of [GLOBE_CDN, LOCAL_GLOBE]) {
      try {
        await loadScript(source);
      } catch (error) {
        console.warn(error.message);
      }
      if (getGlobeConstructor()) return true;
    }

    return false;
  }

  function cacheDom() {
    dom.header = document.querySelector('.site-header');
    dom.navToggle = document.querySelector('#navToggle');
    dom.siteNav = document.querySelector('#siteNav');
    dom.materialFilters = document.querySelector('#materialFilters');
    dom.globeStage = document.querySelector('#globeStage');
    dom.globeViz = document.querySelector('#globeViz');
    dom.globeLoading = document.querySelector('#globeLoading');
    dom.globeFallback = document.querySelector('#globeFallback');
    dom.globeFallbackTitle = document.querySelector('#globeFallbackTitle');
    dom.globeFallbackText = document.querySelector('#globeFallbackText');
    dom.globeStatus = document.querySelector('#globeStatus');
    dom.globeStatusText = document.querySelector('#globeStatusText');
    dom.globeCorner = document.querySelector('#globeCorner');
    dom.panel = document.querySelector('#detailPanel');
    dom.dataTable = document.querySelector('#globeDataTable');
    dom.year = document.querySelector('#year');
  }

  function setStatus(text, status = 'ready') {
    if (!dom.globeStatus || !dom.globeStatusText) return;
    dom.globeStatus.dataset.state = status;
    dom.globeStatusText.textContent = text;
  }

  function setupHeader() {
    if (!dom.header) return;
    const updateHeader = () => dom.header.classList.toggle('is-scrolled', window.scrollY > 8);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  function closeNav() {
    document.body.classList.remove('nav-open');
    if (dom.navToggle) {
      dom.navToggle.setAttribute('aria-expanded', 'false');
      dom.navToggle.setAttribute('aria-label', 'Menü öffnen');
    }
  }

  function openNav() {
    document.body.classList.add('nav-open');
    if (dom.navToggle) {
      dom.navToggle.setAttribute('aria-expanded', 'true');
      dom.navToggle.setAttribute('aria-label', 'Menü schließen');
    }
  }

  function setupNavigation() {
    if (!dom.navToggle) return;

    dom.navToggle.addEventListener('click', () => {
      if (document.body.classList.contains('nav-open')) closeNav();
      else openNav();
    });

    document.querySelectorAll('.site-nav a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });

    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('nav-open')) return;
      if (event.target.closest('#siteNav') || event.target.closest('#navToggle')) return;
      closeNav();
    });
  }

  function revealAll() {
    document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
  }

  function setupReveal() {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!elements.length) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    document.body.classList.add('reveal-ready');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach((element, index) => {
      element.style.setProperty('--reveal-delay', `${Math.min(index, 6) * 60}ms`);
      observer.observe(element);
    });
  }

  function normalizeMaterial(item, index) {
    const color = isValidHexColor(item.farbe) ? item.farbe : PALETTE[index % PALETTE.length];

    return {
      ...item,
      lat: Number(item.lat),
      lng: Number(item.lng),
      verarbeitung_lat: Number(item.verarbeitung_lat),
      verarbeitung_lng: Number(item.verarbeitung_lng),
      farbe: color,
      land: item.land || 'unbekannt',
      region: item.region || 'unbekannt',
      verarbeitung_land: item.verarbeitung_land || 'unbekannt',
      verarbeitung_region: item.verarbeitung_region || 'unbekannt',
      weltanteil_abbau: item.weltanteil_abbau || 'k. A.',
      weltanteil_verarbeitung: item.weltanteil_verarbeitung || 'k. A.',
      anteil_abbau_prozent: clampPercent(item.anteil_abbau_prozent),
      anteil_verarbeitung_prozent: clampPercent(item.anteil_verarbeitung_prozent),
      bewertung: {
        oekologie: item.bewertung?.oekologie || 'mittel',
        sozial: item.bewertung?.sozial || 'mittel',
        oekonomie: item.bewertung?.oekonomie || 'mittel'
      },
      quellen: Array.isArray(item.quellen) ? item.quellen : []
    };
  }

  async function loadMaterials() {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} beim Laden von ${DATA_URL}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.rohstoffe;
    if (!Array.isArray(items) || !items.length) {
      throw new Error('Die JSON-Datei enthält keine Rohstoffdaten.');
    }

    const requiredFields = [
      'id',
      'rohstoff',
      'abbaugebiet',
      'lat',
      'lng',
      'verarbeitung',
      'verarbeitung_lat',
      'verarbeitung_lng',
      'sozial_oeko_impact'
    ];

    const ids = new Set();
    const normalized = items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Ungültiger Datensatz an Position ${index + 1}.`);
      }

      requiredFields.forEach((field) => {
        if (item[field] === undefined || item[field] === null || item[field] === '') {
          throw new Error(`Feld "${field}" fehlt im Datensatz ${item.id || index + 1}.`);
        }
      });

      if (ids.has(item.id)) {
        throw new Error(`Doppelte ID: ${item.id}`);
      }
      ids.add(item.id);

      const coordinates = [
        Number(item.lat),
        Number(item.lng),
        Number(item.verarbeitung_lat),
        Number(item.verarbeitung_lng)
      ];
      if (!coordinates.every(Number.isFinite)) {
        throw new Error(`Ungültige Koordinaten im Datensatz ${item.id}.`);
      }

      return normalizeMaterial(item, index);
    });

    return normalized;
  }

  function groupMaterials() {
    const map = new Map();
    state.materials.forEach((material) => {
      if (!map.has(material.rohstoff)) map.set(material.rohstoff, []);
      map.get(material.rohstoff).push(material);
    });
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
      color: items[0].farbe
    }));
  }

  function renderStats() {
    const sites = state.materials.length;
    const materials = state.groups.length;
    const continents = new Set(state.materials.map((material) => material.region)).size;

    const values = {
      sites: String(sites).padStart(2, '0'),
      materials: String(materials).padStart(2, '0'),
      continents: String(continents).padStart(2, '0')
    };

    Object.entries(values).forEach(([key, value]) => {
      const element = document.querySelector(`[data-stat="${key}"]`);
      if (element) element.textContent = value;
    });

    if (dom.globeCorner) {
      dom.globeCorner.textContent = `${sites} Standorte · ${materials} Rohstoffe`;
    }
  }

  function renderFilters() {
    if (!dom.materialFilters) return;

    dom.materialFilters.innerHTML = [
      `<button class="filter-btn is-active" type="button" data-filter="all" aria-pressed="true"><span class="filter-dot filter-dot--all"></span>Alle</button>`,
      ...state.groups.map((group) => (
        `<button class="filter-btn" type="button" data-filter="${escapeAttr(group.name)}" aria-pressed="false" style="--dot:${group.color}"><span class="filter-dot"></span>${escapeHtml(group.name)}</button>`
      ))
    ].join('');
  }

  function updateFilterButtons() {
    if (!dom.materialFilters) return;
    dom.materialFilters.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderTable() {
    if (!dom.dataTable) return;
    const tbody = dom.dataTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = state.materials.map((material) => `
      <tr>
        <th scope="row">${escapeHtml(material.rohstoff)}</th>
        <td>${escapeHtml(material.abbaugebiet)}, ${escapeHtml(material.land)}</td>
        <td>${escapeHtml(material.verarbeitung)}, ${escapeHtml(material.verarbeitung_land)}</td>
        <td>${escapeHtml(material.weltanteil_abbau)}</td>
        <td>${escapeHtml(material.sozial_oeko_impact)}</td>
      </tr>
    `).join('');
  }

  function renderOverview() {
    if (!dom.panel) return;

    dom.panel.innerHTML = `
      <div class="panel-content">
        <p class="panel-kicker">Lieferketten im Überblick</p>
        <h3 class="panel-title">Fünf Abbaustandorte. Ein Verarbeitungs-Schwerpunkt.</h3>
        <p class="panel-lead">
          Wähle einen Rohstoff oder klicke direkt auf einen Punkt im Globus.
          Hier erscheinen Herkunft, Verarbeitungsweg und die wichtigsten Auswirkungen.
        </p>
        <div class="overview-list">
          ${state.groups.map((group) => `
            <button class="overview-item" type="button" data-group="${escapeAttr(group.name)}" style="--dot:${group.color}">
              <span class="overview-dot" aria-hidden="true"></span>
              <span class="overview-copy">
                <strong>${escapeHtml(group.name)}</strong>
                <small>${group.items.map((item) => escapeHtml(item.land)).join(' · ')}</small>
              </span>
              <span class="overview-arrow" aria-hidden="true">→</span>
            </button>
          `).join('')}
        </div>
        <div class="panel-callout">
          <span>Nadelöhr China</span>
          <p>China verarbeitet je nach Rohstoff etwa 35–92 % der globalen Raffination. Diese Konzentration ist ein zentrales Risiko der Batterielieferkette.</p>
        </div>
      </div>
    `;
  }

  function renderGroup(name) {
    if (!dom.panel) return;
    const group = state.groups.find((entry) => entry.name === name);
    if (!group) {
      renderOverview();
      return;
    }

    const countries = group.items.map((item) => item.land).join(' und ');

    dom.panel.innerHTML = `
      <button class="panel-back" type="button" data-action="back">← Alle Rohstoffe</button>
      <div class="panel-content">
        <p class="panel-kicker" style="color:${group.color}">${escapeHtml(group.name)}</p>
        <h3 class="panel-title">${group.items.length} Abbaustandorte im Vergleich</h3>
        <p class="panel-lead">${escapeHtml(GROUP_NOTES[group.name] || `${countries} sind wichtige Quellen für ${group.name}.`)}</p>
        <div class="site-list">
          ${group.items.map((material) => `
            <button class="site-item" type="button" data-material-id="${escapeAttr(material.id)}" style="--dot:${material.farbe}">
              <span class="site-dot" aria-hidden="true"></span>
              <span class="site-copy">
                <strong>${escapeHtml(material.abbaugebiet)}</strong>
                <small>${escapeHtml(material.land)} · ${escapeHtml(material.weltanteil_abbau)} Weltanteil</small>
              </span>
              <span class="site-arrow" aria-hidden="true">→</span>
            </button>
          `).join('')}
        </div>
        <p class="panel-note">Klicke auf einen Standort oder direkt auf den Globus, um die Route und die Auswirkungen zu sehen.</p>
      </div>
    `;
  }

  function renderDetail(material) {
    if (!dom.panel) return;

    const ratings = [
      ['oekologie', 'Ökologie'],
      ['sozial', 'Soziales'],
      ['oekonomie', 'Ökonomie']
    ];

    const badges = ratings.map(([key, label]) => {
      const value = material.bewertung?.[key];
      if (!value) return '';
      return `<span class="level level--${levelClass(value)}">${label}: ${escapeHtml(value)}</span>`;
    }).join('');

    const sourceLinks = material.quellen
      .map((source) => {
        const url = safeUrl(source.url);
        if (!url) return '';
        return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(source.titel)} <span aria-hidden="true">↗</span></a>`;
      })
      .filter(Boolean)
      .join('');

    const tags = [material.methode, material.transport]
      .filter(Boolean)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join('');

    const share = clampPercent(material.anteil_abbau_prozent);

    dom.panel.innerHTML = `
      <button class="panel-back" type="button" data-action="back">← Alle Rohstoffe</button>
      <div class="panel-content">
        <div class="panel-top">
          <p class="panel-kicker" style="color:${material.farbe}">${escapeHtml(material.rohstoff)}</p>
          <span class="panel-badge">${escapeHtml(material.region)}</span>
        </div>
        <h3 class="panel-title">${escapeHtml(material.abbaugebiet)}</h3>
        <p class="panel-lead">${escapeHtml(material.sozial_oeko_impact)}</p>

        <div class="route-viz" style="--dot:${material.farbe}">
          <div class="route-step">
            <span class="route-marker route-marker--mine" aria-hidden="true"></span>
            <div>
              <span>Abbau</span>
              <strong>${escapeHtml(material.abbaugebiet)}, ${escapeHtml(material.land)}</strong>
            </div>
          </div>
          <div class="route-connector" aria-hidden="true"></div>
          <div class="route-step">
            <span class="route-marker route-marker--process" aria-hidden="true"></span>
            <div>
              <span>Verarbeitung</span>
              <strong>${escapeHtml(material.verarbeitung)}, ${escapeHtml(material.verarbeitung_land)}</strong>
            </div>
          </div>
        </div>

        <div class="share-meter" style="--dot:${material.farbe}">
          <div class="share-meter-head">
            <span>Weltanteil Abbau</span>
            <strong>${escapeHtml(material.weltanteil_abbau)}</strong>
          </div>
          <div class="share-meter-track" role="img" aria-label="Weltanteil Abbau: ${escapeHtml(material.weltanteil_abbau)}">
            <span class="share-meter-fill" style="width:${share}%"></span>
          </div>
        </div>

        <div class="data-grid">
          <div class="data-item">
            <span>Verarbeitung in</span>
            <strong>${escapeHtml(material.verarbeitung_land)}</strong>
          </div>
          <div class="data-item">
            <span>China-Anteil Raffination</span>
            <strong>${escapeHtml(material.weltanteil_verarbeitung)}</strong>
          </div>
        </div>
        <p class="panel-note">${escapeHtml(material.verarbeitung_hinweis || '')}</p>

        <div class="detail-block">
          <h4>Was bedeutet das?</h4>
          <p>${escapeHtml(material.beschreibung || material.sozial_oeko_impact)}</p>
        </div>
        <div class="detail-block">
          <h4>Im Akku</h4>
          <p>${escapeHtml(material.hauptverwendung || 'Bestandteil der Lithium-Ionen-Zelle.')}</p>
        </div>

        <div class="badge-row">${badges}</div>
        <div class="panel-tags">${tags}</div>

        <div class="panel-sources">
          <span>Quellen</span>
          ${sourceLinks || '<span>Keine Quellen hinterlegt.</span>'}
        </div>
      </div>
    `;
  }

  function flyOverview() {
    if (!state.globe) return;
    state.globe.pointOfView({ lat: 12, lng: 75, altitude: 2.35 }, reducedMotion ? 0 : 1200);
  }

  function flyToMaterial(material) {
    if (!state.globe) return;
    const midpoint = greatCircleMidpoint(
      material.lat,
      material.lng,
      material.verarbeitung_lat,
      material.verarbeitung_lng
    );
    const distance = angularDistance(
      material.lat,
      material.lng,
      material.verarbeitung_lat,
      material.verarbeitung_lng
    );
    const altitude = clamp(1.55 + distance / 155, 1.65, 2.55);

    state.globe.pointOfView({
      lat: midpoint.lat,
      lng: midpoint.lng,
      altitude
    }, reducedMotion ? 0 : 1400);
  }

  function flyToGroup(group) {
    if (!state.globe) return;
    const points = [];
    group.items.forEach((material) => {
      points.push({ lat: material.lat, lng: material.lng });
      points.push({ lat: material.verarbeitung_lat, lng: material.verarbeitung_lng });
    });
    const center = averageLatLng(points);
    state.globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: 2.3 }, reducedMotion ? 0 : 1400);
  }

  function angularDistance(lat1, lng1, lat2, lng2) {
    const toRad = Math.PI / 180;
    const deltaLat = (lat2 - lat1) * toRad;
    const deltaLng = (lng2 - lng1) * toRad;
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(deltaLng / 2) ** 2;
    return 2 * Math.asin(Math.sqrt(a)) * 180 / Math.PI;
  }

  function greatCircleMidpoint(lat1, lng1, lat2, lng2) {
    return averageLatLng([
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 }
    ]);
  }

  function averageLatLng(points) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    let x = 0;
    let y = 0;
    let z = 0;

    points.forEach(({ lat, lng }) => {
      const latitude = lat * toRad;
      const longitude = lng * toRad;
      x += Math.cos(latitude) * Math.cos(longitude);
      y += Math.cos(latitude) * Math.sin(longitude);
      z += Math.sin(latitude);
    });

    const length = Math.hypot(x, y, z) || 1;
    return {
      lat: Math.atan2(z / length, Math.hypot(x / length, y / length)) * toDeg,
      lng: Math.atan2(y / length, x / length) * toDeg
    };
  }

  function getVisibleMaterials() {
    if (state.filter === 'all') return state.materials;
    return state.materials.filter((material) => material.rohstoff === state.filter);
  }

  function buildGlobeData() {
    const points = [];
    const arcs = [];
    const rings = [];
    const htmlLabels = [];

    const shortCountry = {
      'Demokratische Republik Kongo': 'DR Kongo',
      'Demokratische Republik Kongo (DRC)': 'DR Kongo'
    };

    state.materials.forEach((material) => {
      points.push({
        id: `${material.id}-mine`,
        materialId: material.id,
        type: 'mine',
        materialName: material.rohstoff,
        name: material.abbaugebiet,
        country: material.land,
        lat: material.lat,
        lng: material.lng,
        color: material.farbe,
        radius: material.anteil_abbau_prozent >= 60 ? 0.68 : 0.58,
        altitude: 0.012,
        impact: material.sozial_oeko_impact
      });

      points.push({
        id: `${material.id}-process`,
        materialId: material.id,
        type: 'process',
        materialName: material.rohstoff,
        name: material.verarbeitung,
        country: material.verarbeitung_land,
        lat: material.verarbeitung_lat,
        lng: material.verarbeitung_lng,
        color: material.farbe,
        radius: 0.4,
        altitude: 0.008
      });

      arcs.push({
        id: material.id,
        materialId: material.id,
        startLat: material.lat,
        startLng: material.lng,
        endLat: material.verarbeitung_lat,
        endLng: material.verarbeitung_lng,
        colors: [colorWithAlpha(material.farbe, 0.16), material.farbe],
        stroke: 0.9,
        dashLength: 0.42,
        dashGap: 0.16,
        dashAnimateTime: 3000
      });

      rings.push({
        materialId: material.id,
        lat: material.lat,
        lng: material.lng,
        color: material.farbe,
        maxR: 3.4,
        speed: 1.4,
        repeatPeriod: 1700
      });

      htmlLabels.push({
        materialId: material.id,
        materialName: material.rohstoff,
        lat: material.lat,
        lng: material.lng,
        text: shortCountry[material.land] || material.land,
        color: material.farbe
      });
    });

    state.points = points;
    state.arcs = arcs;
    state.rings = rings;
    state.htmlLabels = htmlLabels;
  }

  function updateGlobeData() {
    if (!state.globe) return;
    const visibleIds = new Set(getVisibleMaterials().map((material) => material.id));

    state.globe.pointsData(state.points.filter((point) => visibleIds.has(point.materialId)));
    state.globe.arcsData(state.arcs.filter((arc) => visibleIds.has(arc.materialId)));
    state.globe.ringsData(state.rings.filter((ring) => visibleIds.has(ring.materialId)));
    state.globe.htmlElementsData(state.htmlLabels.filter((label) => visibleIds.has(label.materialId)));
  }

  function createGlobeLabel(label) {
    const element = document.createElement('div');
    element.className = 'globe-label-anchor';
    element.style.setProperty('--label-color', label.color);
    element.innerHTML = `<button class="globe-label" type="button" aria-label="${escapeAttr(`${label.text}: ${label.materialName} – Details anzeigen`)}"><span class="globe-label__dot" aria-hidden="true"></span><span>${escapeHtml(label.text)}</span></button>`;
    element.querySelector('.globe-label').addEventListener('click', (event) => {
      event.stopPropagation();
      const material = state.materials.find((entry) => entry.id === label.materialId);
      if (material) selectMaterial(material);
    });
    return element;
  }

  function pointTooltip(point) {
    const type = point.type === 'mine' ? 'Abbaugebiet' : 'Verarbeitung';
    const impact = point.impact
      ? `<p>${escapeHtml(trimText(point.impact, 150))}</p>`
      : '';

    return `
      <div class="globe-tooltip">
        <span class="globe-tooltip__type" style="color:${point.color}">${type}</span>
        <strong>${escapeHtml(point.name)}</strong>
        <span class="globe-tooltip__meta">${escapeHtml(point.materialName)} · ${escapeHtml(point.country)}</span>
        ${impact}
        <em>Klicken für Details →</em>
      </div>
    `;
  }

  function markGlobeReady() {
    if (state.globeReady) return;
    state.globeReady = true;
    if (dom.globeLoading) dom.globeLoading.hidden = true;
    setStatus(`${state.materials.length} Standorte · ${state.groups.length} Rohstoffe`, 'ready');
  }

  function initGlobe() {
    const GlobeConstructor = getGlobeConstructor();
    if (!GlobeConstructor) {
      throw new Error('globe.gl wurde nicht geladen.');
    }
    if (!supportsWebGL()) {
      throw new Error('Dein Browser oder diese Umgebung unterstützt kein WebGL. Bitte aktiviere die Hardwarebeschleunigung oder nutze einen aktuellen Browser.');
    }
    if (!dom.globeViz) {
      throw new Error('Der Globus-Container fehlt.');
    }

    const width = Math.max(1, Math.floor(dom.globeViz.clientWidth || dom.globeStage.clientWidth));
    const height = Math.max(1, Math.floor(dom.globeViz.clientHeight || dom.globeStage.clientHeight));

    const globe = GlobeConstructor()(dom.globeViz);
    state.globe = globe;

    globe
      .width(width)
      .height(height)
      .backgroundColor('#03060c')
      .backgroundImageUrl('assets/night-sky.png')
      .globeImageUrl('assets/earth-night.jpg')
      .bumpImageUrl('assets/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.2)
      .pointsMerge(false)
      .pointAltitude((point) => point.altitude)
      .pointRadius((point) => point.radius)
      .pointColor((point) => point.color)
      .pointResolution(16)
      .pointLabel((point) => pointTooltip(point))
      .onPointClick((point) => {
        const material = state.materials.find((entry) => entry.id === point.materialId);
        if (material) selectMaterial(material);
      })
      .arcStartLat((arc) => arc.startLat)
      .arcStartLng((arc) => arc.startLng)
      .arcEndLat((arc) => arc.endLat)
      .arcEndLng((arc) => arc.endLng)
      .arcColor((arc) => arc.colors)
      .arcStroke((arc) => arc.stroke)
      .arcAltitudeAutoScale(0.38)
      .arcDashLength((arc) => arc.dashLength)
      .arcDashGap((arc) => arc.dashGap)
      .arcDashAnimateTime((arc) => arc.dashAnimateTime)
      .arcsTransitionDuration(600)
      .ringLat((ring) => ring.lat)
      .ringLng((ring) => ring.lng)
      .ringColor((ring) => (t) => colorWithAlpha(ring.color, 0.55 * (1 - t)))
      .ringMaxRadius((ring) => ring.maxR)
      .ringPropagationSpeed((ring) => ring.speed)
      .ringRepeatPeriod((ring) => ring.repeatPeriod)
      .ringAltitude(0.008)
      .htmlLat((label) => label.lat)
      .htmlLng((label) => label.lng)
      .htmlAltitude(0.016)
      .htmlElement((label) => createGlobeLabel(label))
      .htmlTransitionDuration(0)
      .pointsData([])
      .arcsData([])
      .ringsData([])
      .htmlElementsData([]);

    const controls = globe.controls();
    if (controls) {
      state.controls = controls;
      controls.autoRotate = !reducedMotion;
      controls.autoRotateSpeed = 0.22;
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.7;
      controls.enablePan = false;
      controls.minDistance = 140;
      controls.maxDistance = 680;
    }

    if (typeof globe.onGlobeReady === 'function') {
      globe.onGlobeReady(markGlobeReady);
    }

    buildGlobeData();
    updateGlobeData();
    globe.pointOfView({ lat: 12, lng: 75, altitude: 2.35 }, 0);

    if (dom.globeStage) {
      dom.globeStage.addEventListener('pointerenter', () => {
        if (state.controls && !reducedMotion && !state.userInteracted) {
          state.controls.autoRotate = false;
        }
      });
      dom.globeStage.addEventListener('pointerleave', () => {
        if (state.controls && !reducedMotion && !state.userInteracted) {
          state.controls.autoRotate = true;
        }
      });
      dom.globeStage.addEventListener('pointerdown', () => {
        state.userInteracted = true;
        if (state.controls) state.controls.autoRotate = false;
      });
    }

    const resizeGlobe = () => {
      if (!state.globe || !dom.globeViz) return;
      const newWidth = Math.floor(dom.globeViz.clientWidth);
      const newHeight = Math.floor(dom.globeViz.clientHeight);
      if (newWidth > 0 && newHeight > 0) {
        state.globe.width(newWidth).height(newHeight);
      }
    };

    if ('ResizeObserver' in window) {
      state.resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(resizeGlobe);
      });
      state.resizeObserver.observe(dom.globeViz);
    } else {
      window.addEventListener('resize', resizeGlobe);
    }

    state.readyTimer = window.setTimeout(markGlobeReady, 2600);
  }

  function showGlobeError(title, message) {
    if (dom.globeLoading) dom.globeLoading.hidden = true;
    if (dom.globeFallback) dom.globeFallback.hidden = false;
    if (dom.globeFallbackTitle) dom.globeFallbackTitle.textContent = title;
    if (dom.globeFallbackText) dom.globeFallbackText.textContent = message;
    setStatus('Globus nicht verfügbar', 'error');
  }

  function renderFatalPanel() {
    if (!dom.panel) return;
    dom.panel.innerHTML = `
      <div class="panel-content">
        <p class="panel-kicker">Datenfehler</p>
        <h3 class="panel-title">Die Lieferkettendaten konnten nicht geladen werden.</h3>
        <p class="panel-lead">
          Der Browser konnte <code>data/battery_data.json</code> nicht abrufen.
          Öffne die Seite über einen lokalen Server – nicht per Doppelklick auf die HTML-Datei.
        </p>
        <div class="error-command">
          <span>Im Projektordner ausführen</span>
          <code>python -m http.server 5500</code>
        </div>
        <p class="panel-note">Danach <a href="http://localhost:5500">http://localhost:5500</a> im Browser öffnen.</p>
      </div>
    `;
  }

  function selectMaterial(material) {
    if (!material) return;
    state.filter = material.rohstoff;
    state.selectedId = material.id;
    state.userInteracted = true;
    if (state.controls) state.controls.autoRotate = false;

    updateFilterButtons();
    updateGlobeData();
    renderDetail(material);
    flyToMaterial(material);
  }

  function setFilter(name) {
    state.filter = name;
    state.selectedId = null;
    state.userInteracted = true;
    if (state.controls) state.controls.autoRotate = false;

    updateFilterButtons();
    updateGlobeData();

    if (name === 'all') {
      renderOverview();
      flyOverview();
      return;
    }

    const group = state.groups.find((entry) => entry.name === name);
    if (!group) {
      state.filter = 'all';
      updateFilterButtons();
      updateGlobeData();
      renderOverview();
      flyOverview();
      return;
    }

    if (group.items.length === 1) {
      renderDetail(group.items[0]);
      flyToMaterial(group.items[0]);
    } else {
      renderGroup(group.name);
      flyToGroup(group);
    }
  }

  function setupInteractions() {
    if (dom.materialFilters) {
      dom.materialFilters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        const filter = button.dataset.filter;
        if (filter === state.filter && filter !== 'all') {
          setFilter('all');
        } else {
          setFilter(filter);
        }
      });
    }

    if (dom.panel) {
      dom.panel.addEventListener('click', (event) => {
        const backButton = event.target.closest('[data-action="back"]');
        if (backButton) {
          setFilter('all');
          return;
        }

        const groupButton = event.target.closest('[data-group]');
        if (groupButton) {
          setFilter(groupButton.dataset.group);
          return;
        }

        const siteButton = event.target.closest('[data-material-id]');
        if (siteButton) {
          const material = state.materials.find((entry) => entry.id === siteButton.dataset.materialId);
          if (material) selectMaterial(material);
        }
      });
    }
  }

  async function init() {
    cacheDom();
    setupHeader();
    setupNavigation();
    setupReveal();
    setupInteractions();

    if (dom.year) dom.year.textContent = String(new Date().getFullYear());
    setStatus('Daten werden geladen …', 'loading');

    try {
      state.materials = await loadMaterials();
      state.groups = groupMaterials();

      renderStats();
      renderFilters();
      renderTable();
      renderOverview();
    } catch (error) {
      console.error('E-Auto-Reise: Daten konnten nicht geladen werden.', error);
      renderFatalPanel();
      showGlobeError(
        'Daten konnten nicht geladen werden',
        'Bitte starte die Seite über einen lokalen Server. Die genaue Anleitung steht in der Liste.'
      );
      revealAll();
      return;
    }

    setStatus('Daten geladen · Globus startet', 'loading');

    const hasGlobe = await ensureGlobeLibrary();
    if (!hasGlobe) {
      showGlobeError(
        'globe.gl konnte nicht geladen werden',
        'Bitte prüfe deine Internetverbindung oder die lokale Datei vendor/globe.gl.min.js. Die Lieferketten bleiben in der Liste verfügbar.'
      );
      return;
    }

    try {
      initGlobe();
    } catch (error) {
      console.error('E-Auto-Reise: Globus konnte nicht initialisiert werden.', error);
      showGlobeError(
        '3D-Darstellung nicht möglich',
        error.message || 'Der Globus konnte in diesem Browser nicht gestartet werden.'
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
