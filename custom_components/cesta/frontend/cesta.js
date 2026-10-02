/*
 * Cesta – lista de la compra visual para Home Assistant.
 * Define <cesta-panel> (panel de la barra lateral) y <cesta-card> (tarjeta).
 * Sin dependencias: un único módulo que sirve la integración.
 */
const CESTA_VERSION = "1.0.0";

/* ------------------------------------------------------------ utilidades */
const P = {
  menu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  cog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  search: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  pencil: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  trash: "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  up: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
};
const svg = (p, s = 24) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" focusable="false"><path d="${p}" fill="currentColor"/></svg>`;

const norm = (s) =>
  String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cap = (s) => {
  s = String(s ?? "").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};
const rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = parseInt(m ? m[1] : "78909c", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const onColor = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#1d1b16" : "#ffffff";
};
/* Variables CSS de color de un departamento */
const tone = (hex) => {
  const [r, g, b] = rgb(hex);
  return `--c:${hex};--on-c:${onColor(hex)};--c1:rgba(${r},${g},${b},.15);--c2:rgba(${r},${g},${b},.34);--c3:rgba(${r},${g},${b},.7)`;
};
const nowS = () => Date.now() / 1000;
const ago = (ts) => {
  const s = nowS() - ts;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return m === 1 ? "hace 1 mes" : `hace ${m} meses`;
};
const stem = (w) => {
  if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
};
const stems = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean).map(stem);
const byName = (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" });

const EXTRA_EMOJI = "🍏🥗🍳🥘🍲🫕🥙🌯🍔🍕🌭🥪🍿🧃🧋🍶🍵🥤🧉🍾🧊🧂🫙🥫🍯🧈🥜🌰🫘🌾🍚🍝🍜🥟🍤🍣🍱🧆🥨🥯🥞🧇🥐🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍦🍧🍨🧀🥚🥓🥩🍗🍖🦴🐟🦐🦑🦀🐙🦪🧻🧼🧽🧴🪥🪒🧹🧺🪣🧯🧤🔋💡🕯️📦🗑️💊🩹🌸💐🪴🎁🐶🐱🐾🐠👶🍼💄🧦🎈🖊️📰🔥🛒🏪";

/* -------------------------------------------------------------- estilos */
const STYLE = `
:host{display:block;color:var(--primary-text-color,#1c1b1f);font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,system-ui,-apple-system,"Segoe UI",sans-serif));-webkit-tap-highlight-color:transparent}
:host([mode=panel]){height:100%}
*{box-sizing:border-box}
[hidden]{display:none!important}
button{font:inherit;color:inherit}
.app{position:relative;display:flex;flex-direction:column;height:100%;container-type:inline-size}
:host([mode=panel]) .app{background:var(--primary-background-color,#f4f5f2)}
.em,.emoji{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}

/* barra superior */
.toolbar{flex:none;display:flex;align-items:center;gap:2px;height:var(--header-height,56px);padding:0 4px;background:var(--app-header-background-color,var(--primary-background-color));color:var(--app-header-text-color,var(--primary-text-color));border-bottom:var(--app-header-border-bottom,none)}
.toolbar h1{flex:1;margin:0 0 0 12px;font-size:20px;font-weight:400;display:flex;align-items:baseline;gap:10px;white-space:nowrap;overflow:hidden}
.toolbar h1 small{font-size:14px;opacity:.72}
:host([mode=card]) .toolbar{height:auto;padding:12px 8px 0 16px;background:none;color:inherit;border:0}
:host([mode=card]) .toolbar h1{margin:0;font-size:var(--ha-card-header-font-size,22px)}
.icon-btn{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:0;background:none;cursor:pointer;flex:none}
.icon-btn:hover{background:rgba(127,127,127,.12)}
.icon-btn:focus-visible,.chip:focus-visible,.tile:focus-visible,.text-btn:focus-visible,.btn:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}

.scroller{flex:1;overflow-y:auto;overscroll-behavior:contain}
:host([mode=card]) .scroller{overflow:visible}
.layout{width:100%;max-width:1200px;margin:0 auto;padding:4px 16px 96px;display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
:host([mode=card]) .layout{padding:4px 16px 16px}
@container (min-width:860px){
  .layout{grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:36px;padding:8px 28px 96px}
  .side{padding-top:12px}
  :host([mode=panel]) .side{position:sticky;top:0;align-self:start;max-height:calc(100vh - var(--header-height,56px));overflow:auto;padding-bottom:24px;scrollbar-width:thin}
}

/* barra para añadir */
.addwrap{padding:10px 0 2px}
:host([mode=panel]) .addwrap{position:sticky;top:0;z-index:3;background:var(--primary-background-color,#f4f5f2)}
.addbar{display:flex;align-items:center;gap:6px;height:48px;padding:0 4px 0 14px;border-radius:24px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,rgba(0,0,0,.12));color:var(--secondary-text-color)}
.addbar:focus-within{border-color:var(--primary-color,#03a9f4);box-shadow:inset 0 0 0 1px var(--primary-color,#03a9f4)}
.addbar input{flex:1;min-width:0;height:100%;border:0;background:none;outline:none;font:inherit;font-size:16px;color:var(--primary-text-color)}
.addbar input::placeholder{color:var(--secondary-text-color);opacity:.9}
.results{margin-top:12px}
.results[hidden]{display:none}
.hint{margin:8px 2px 0;font-size:12.5px;color:var(--secondary-text-color)}

/* filtros por tienda */
.filters{display:flex;gap:8px;overflow-x:auto;padding:12px 0 2px;scrollbar-width:none}
.filters::-webkit-scrollbar{display:none}
.chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:17px;border:1px solid var(--divider-color,rgba(0,0,0,.14));background:var(--card-background-color,transparent);cursor:pointer;font-size:14px;white-space:nowrap}
.chip .n{opacity:.66;font-variant-numeric:tabular-nums}
.chip[aria-pressed=true]{background:var(--primary-color,#03a9f4);border-color:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
.chip.dept[aria-pressed=true]{background:var(--c1);border-color:var(--c);color:inherit;box-shadow:inset 0 0 0 1px var(--c)}
.chip .dot{width:10px;height:10px;border-radius:50%;background:var(--c)}

/* grupos por departamento */
.group{margin-top:22px}
.group-head{display:flex;align-items:center;gap:10px;margin:0 2px 10px;font-size:15px;font-weight:500}
.aisle{display:grid;place-items:center;min-width:24px;height:24px;padding:0 4px;border-radius:8px;background:var(--c);color:var(--on-c);font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
.group-head .n,.section-head .n{margin-left:auto;font-size:13px;font-weight:400;color:var(--secondary-text-color);font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}

/* fichas */
.tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:96px;padding:12px 6px 9px;border-radius:16px;border:1px solid var(--c2);background:var(--c1);text-align:center;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation;transition:transform .14s ease,opacity .16s ease}
.tile:active{transform:scale(.95)}
.tile .em{font-size:32px;line-height:1.05}
.tile .nm{font-size:13px;font-weight:500;line-height:1.22;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.tile .sub{max-width:100%;font-size:11.5px;line-height:1.2;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .tags{position:absolute;top:5px;right:7px;display:flex;gap:1px;font-size:12px;line-height:1}
.tile .edit{position:absolute;top:3px;left:3px;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;color:var(--secondary-text-color);opacity:0;transition:opacity .12s}
@media (hover:hover){.tile:hover .edit{opacity:1}.tile .edit:hover{background:rgba(127,127,127,.16);color:var(--primary-text-color)}}
.tile.sugg{background:none;border:1.5px dashed var(--c3)}
.tile .badge{position:absolute;top:5px;right:5px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--c);color:var(--on-c)}
.tile.rec{background:var(--secondary-background-color,rgba(127,127,127,.09));border-color:transparent}
.tile.rec .nm{font-weight:400}
.tile.rec .sub{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tile.new{background:none;border:1.5px dashed var(--divider-color,rgba(0,0,0,.25))}
.tile.inlist{border-width:2px;border-color:var(--c)}
.tile.leaving{transform:scale(.7);opacity:0;pointer-events:none}
.tile.entering{animation:pop .26s cubic-bezier(.2,.9,.3,1.3)}
@keyframes pop{from{transform:scale(.6);opacity:0}}

/* secciones laterales */
.side section+section{margin-top:28px}
.section-head{display:flex;align-items:center;gap:8px;margin:0 2px 10px}
.section-head h2{margin:0;font-size:15px;font-weight:500}
.text-btn{border:0;background:none;color:var(--primary-color,#03a9f4);font-size:13.5px;font-weight:500;cursor:pointer;padding:6px 8px;border-radius:8px}
.text-btn:hover{background:rgba(127,127,127,.1)}
.more{display:block;margin:10px auto 0}
.muted{margin:0 2px;font-size:13.5px;color:var(--secondary-text-color)}

/* vacío / error */
.empty{margin-top:18px;padding:32px 20px;text-align:center;border:1.5px dashed var(--divider-color,rgba(0,0,0,.18));border-radius:18px;color:var(--secondary-text-color);font-size:14px}
.empty .big{font-size:44px;line-height:1}
.empty strong{display:block;margin:10px 0 4px;color:var(--primary-text-color);font-size:16px;font-weight:500}
.loading{padding:64px 16px;text-align:center;color:var(--secondary-text-color)}

/* aviso inferior */
.snackbar{position:absolute;left:50%;bottom:16px;z-index:6;display:flex;align-items:center;gap:8px;min-width:260px;max-width:calc(100% - 32px);padding:6px 6px 6px 16px;border-radius:12px;background:#2f3133;color:#f2f2f2;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.28);transform:translate(-50%,24px);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease}
.snackbar.show{transform:translate(-50%,0);opacity:1;pointer-events:auto}
.snackbar span{flex:1;padding:8px 0}
.snackbar button{border:0;background:none;color:#8fd0ff;font-weight:600;padding:8px 12px;border-radius:8px;cursor:pointer}
:host([mode=card]) .snackbar{position:sticky;transform:none;left:auto;margin:0 auto 12px;width:fit-content;display:none}
:host([mode=card]) .snackbar.show{display:flex}

/* hojas (diálogos) */
dialog{border:0;padding:0;width:min(540px,calc(100vw - 24px));max-height:min(88vh,800px);border-radius:22px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1c1b1f);box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden}
dialog[open]{display:flex;flex-direction:column}
dialog::backdrop{background:rgba(0,0,0,.5)}
@media (max-width:600px){dialog{width:100vw;max-width:100vw;margin:auto 0 0;border-radius:22px 22px 0 0;max-height:92vh}}
.sheet-head{display:flex;align-items:center;gap:10px;padding:14px 10px 10px 16px}
.sheet-head h2{flex:1;margin:0;font-size:19px;font-weight:500}
.sheet-body{flex:1;overflow:auto;padding:4px 18px 8px}
.sheet-foot{display:flex;align-items:center;gap:8px;padding:12px 16px 16px;border-top:1px solid var(--divider-color,rgba(0,0,0,.1))}
.sheet-foot .grow{flex:1}
.btn{height:40px;padding:0 20px;border-radius:20px;border:0;font-weight:500;cursor:pointer;background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
.btn.quiet{background:none;color:var(--primary-color,#03a9f4)}
.btn.danger{background:none;color:var(--error-color,#db4437);padding:0 12px}
.big-em{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;border:1px solid var(--c2);background:var(--c1);font-size:32px;cursor:pointer;flex:none}
.name-input{flex:1;min-width:0;font:inherit;font-size:20px;font-weight:500;border:0;border-bottom:1px solid var(--divider-color,rgba(0,0,0,.2));background:none;color:inherit;padding:6px 2px;outline:none}
.name-input:focus{border-bottom-color:var(--primary-color,#03a9f4)}
.field{display:block;margin:18px 0 0}
.field>span{display:block;margin:0 0 8px;font-size:13px;color:var(--secondary-text-color)}
.input{width:100%;height:44px;padding:0 12px;border-radius:12px;border:1px solid var(--divider-color,rgba(0,0,0,.18));background:none;color:inherit;font:inherit;font-size:16px;outline:none}
.input:focus{border-color:var(--primary-color,#03a9f4)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.emoji-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:2px;margin-top:14px;padding:8px;border-radius:14px;background:var(--secondary-background-color,rgba(127,127,127,.08));max-height:208px;overflow:auto}
.emoji-grid[hidden]{display:none}
.emoji-grid button{height:42px;border:0;background:none;border-radius:10px;font-size:24px;cursor:pointer}
.emoji-grid button:hover{background:rgba(127,127,127,.16)}
.emoji-grid .own{grid-column:1/-1;display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;color:var(--secondary-text-color)}
.emoji-grid .own input{width:72px;text-align:center}
.actions{display:grid;gap:8px;padding:4px 16px 20px}
.actions .btn{width:100%;height:48px;border-radius:14px;font-size:15px}
.actions .btn.quiet{background:var(--secondary-background-color,rgba(127,127,127,.1));color:inherit}
.actions .btn.danger{background:none}
.rows{display:grid;gap:6px}
.row{display:flex;align-items:center;gap:6px}
.row .input{height:40px}
.row .em-input{width:52px;flex:none;text-align:center;font-size:20px;padding:0}
.row input[type=color]{width:40px;height:40px;flex:none;border:0;padding:0;background:none;cursor:pointer}
.row input[type=color]::-webkit-color-swatch-wrapper{padding:4px}
.row input[type=color]::-webkit-color-swatch{border:0;border-radius:10px}
.row .icon-btn{width:34px;height:34px}
.row .icon-btn[disabled]{opacity:.25;pointer-events:none}
.settings h3{margin:20px 0 4px;font-size:16px;font-weight:500}
.settings h3:first-child{margin-top:4px}
.settings p{margin:0 0 12px;font-size:13px;color:var(--secondary-text-color)}
.add-row{margin-top:8px}
@container (max-width:520px){
  .grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}
  .tile{min-height:86px;padding:10px 3px 7px;border-radius:14px;gap:4px}
  .tile .em{font-size:28px}
  .tile .nm{font-size:12.5px}
  .tile .sub{font-size:11px}
  .group{margin-top:18px}
  .group-head{margin-bottom:8px}
}
@media (prefers-reduced-motion:reduce){.tile,.snackbar{transition:none}.tile.entering{animation:none}}
`;

/* ------------------------------------------------------- componente base */
class CestaBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null; // estado mostrado (con cambios optimistas)
    this._server = null; // último estado recibido del servidor
    this._catalog = [];
    this._staples = [];
    this._catIndex = new Map();
    this._filter = null;
    this._query = "";
    this._seen = null;
    this._showAllRecent = false;
    this._narrow = false;
    this._config = {};
  }

  get mode() {
    return "panel";
  }

  /* ---- ciclo de vida */
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._build();
    if (!this._unsub && !this._connecting && this.isConnected) this._connect();
    this._updateMenuButton();
  }
  get hass() {
    return this._hass;
  }
  set narrow(v) {
    this._narrow = v;
    this._updateMenuButton();
  }

  connectedCallback() {
    if (this._hass && !this._unsub && !this._connecting) this._connect();
  }
  disconnectedCallback() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
    clearTimeout(this._snackTimer);
  }

  async _connect() {
    this._connecting = true;
    try {
      if (!this._catalog.length) {
        const res = await this._hass.callWS({ type: "cesta/catalog" });
        this._catalog = res.catalog;
        this._staples = res.staples;
        this._catIndex = new Map(this._catalog.map((e) => [norm(e.name), e]));
        this._catStems = this._catalog.map((e) => [stems(e.name), e]);
        this._catStemIndex = new Map(this._catStems.map(([w, e]) => [w.join(" "), e]));
      }
      const unsub = await this._hass.connection.subscribeMessage(
        (state) => {
          this._server = state;
          this._state = state;
          this._error = null;
          this._render();
        },
        { type: "cesta/subscribe" }
      );
      if (!this.isConnected) unsub();
      else this._unsub = unsub;
    } catch (err) {
      this._error = err && err.code === "not_loaded" ? "not_loaded" : (err && err.message) || String(err);
      this._render();
    } finally {
      this._connecting = false;
    }
  }

  /* ---- esqueleto (se crea una vez; luego solo se rellenan zonas) */
  _build() {
    const card = this.mode === "card";
    this.setAttribute("mode", this.mode);
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      ${card ? "<ha-card>" : ""}
      <div class="app">
        <header class="toolbar">
          ${card ? "" : `<button class="icon-btn menu" data-action="menu" aria-label="Menú" hidden>${svg(P.menu)}</button>`}
          <h1><span class="title">${esc(this._config.title || "Cesta")}</span><small class="count"></small></h1>
          <button class="icon-btn" data-action="settings" aria-label="Ajustes de Cesta" title="Ajustes">${svg(P.cog)}</button>
        </header>
        <div class="scroller">
          <div class="layout">
            <div class="main">
              <div class="addwrap">
                <label class="addbar">
                  ${svg(P.search, 22)}
                  <input type="text" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" spellcheck="false"
                    placeholder="Añadir a la lista…" aria-label="Añadir a la lista">
                  <button class="icon-btn clear" data-action="clear" aria-label="Borrar texto" hidden>${svg(P.close, 20)}</button>
                </label>
              </div>
              <div class="results" hidden></div>
              <div class="filters" role="toolbar" aria-label="Filtrar por tienda"></div>
              <div class="list"><div class="loading">Cargando la lista…</div></div>
            </div>
            <div class="side"></div>
          </div>
        </div>
        <div class="snackbar" role="status" aria-live="polite"><span></span><button type="button" data-action="snack" hidden></button></div>
        <dialog></dialog>
      </div>
      ${card ? "</ha-card>" : ""}`;
    const $ = (s) => this.shadowRoot.querySelector(s);
    this.$ = {
      input: $(".addbar input"), clear: $(".clear"), results: $(".results"), filters: $(".filters"),
      list: $(".list"), side: $(".side"), count: $(".count"), menu: $(".menu"), snack: $(".snackbar"),
      dialog: $("dialog"), scroller: $(".scroller"),
    };
    const root = this.shadowRoot;
    root.addEventListener("click", (e) => this._onClick(e));
    root.addEventListener("contextmenu", (e) => this._onContext(e));
    root.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    root.addEventListener("pointermove", (e) => this._onPointerMove(e));
    for (const ev of ["pointerup", "pointercancel", "pointerleave"])
      root.addEventListener(ev, () => {
        clearTimeout(this._lp);
        if (this._lpFired) setTimeout(() => (this._lpFired = false), 400);
      });
    root.addEventListener("keydown", (e) => this._onKey(e));
    root.addEventListener("input", (e) => this._onInput(e));
    root.addEventListener("change", (e) => this._onInput(e));
    this.$.dialog.addEventListener("close", () => (this._sheet = null));
    this.$.dialog.addEventListener("click", (e) => {
      if (e.target === this.$.dialog) this.$.dialog.close(); // clic en el fondo
    });
    this._updateMenuButton();
  }

  _updateMenuButton() {
    if (!this.$ || !this.$.menu) return;
    const hidden = this._hass && this._hass.dockedSidebar === "always_hidden";
    this.$.menu.hidden = !(this._narrow || hidden);
  }

  /* ---- datos auxiliares */
  get _depts() {
    return this._state ? this._state.departments : [];
  }
  _dept(id) {
    const d = this._depts;
    return d.find((x) => x.id === id) || d.find((x) => x.id === "otros") || d[d.length - 1] || { id: "otros", name: "Otros", color: "#78909C", icon: "🛒" };
  }
  _store(id) {
    return this._state.stores.find((s) => s.id === id);
  }
  _inListKeys() {
    return new Set(this._state.items.map((i) => norm(i.name)));
  }
  /* Producto conocido (memoria del usuario > catálogo > deducción) */
  _lookup(name) {
    let key = norm(name);
    if (!this._state.products[key] && !this._catIndex.has(key)) {
      // "tomate" → "Tomates": mismo producto en singular/plural
      const same = this._catStemIndex && this._catStemIndex.get(stems(name).join(" "));
      if (same) key = norm((name = same.name));
    }
    const mem = this._state.products[key];
    const cat = this._catIndex.get(key) || this._guess(name);
    return {
      key,
      name: (mem && mem.name) || (this._catIndex.get(key) || {}).name || cap(name),
      icon: (mem && mem.icon) || (cat && cat.icon) || "🛒",
      department: (mem && mem.department) || (cat && cat.department) || "otros",
      stores: (mem && mem.stores) || [],
    };
  }
  _guess(name) {
    const words = stems(name);
    if (!words.length || !this._catStems) return null;
    let best = null;
    let bestScore = 0;
    for (const [cw, entry] of this._catStems) {
      if (!cw.length || cw.length > words.length) continue;
      for (let s = 0; s + cw.length <= words.length; s++) {
        if (cw.every((w, i) => words[s + i] === w)) {
          let score = cw.reduce((n, w) => n + w.length, 0) * 10 + (s === 0 ? 5 : 0);
          if (cw.length === words.length) score += 1000;
          if (score > bestScore) [best, bestScore] = [entry, score];
          break;
        }
      }
    }
    return best;
  }

  _visibleItems() {
    const items = this._state.items;
    if (!this._filter) return items;
    return items.filter((i) => !i.stores.length || i.stores.includes(this._filter));
  }

  _suggestions() {
    const st = this._state;
    const inList = this._inListKeys();
    const now = nowS();
    const out = [];
    for (const [key, p] of Object.entries(st.products)) {
      if (p.hidden || inList.has(key)) continue;
      const ps = p.purchases || [];
      if (!ps.length) continue;
      const last = ps[ps.length - 1];
      const since = now - last;
      if (ps.length >= 2) {
        const avg = (last - ps[0]) / (ps.length - 1);
        if (avg > 6 * 3600 && since >= avg * 0.8) {
          const days = Math.max(1, Math.round(avg / 86400));
          out.push({ p, key, score: 1000 + since / avg, sub: days === 1 ? "Cada día" : `Cada ${days} días` });
        } else if (since > 86400 && since >= avg * 0.4) {
          out.push({ p, key, score: 100 + ps.length, sub: `${ps.length} veces` });
        }
      } else if (since > 7 * 86400) {
        out.push({ p, key, score: 10, sub: "" });
      }
    }
    out.sort((a, b) => b.score - a.score);
    const result = out.slice(0, 12).map(({ p, key, sub }) => ({ key, name: p.name, icon: p.icon, department: p.department, sub }));
    if (result.length < 8) {
      const taken = new Set(result.map((r) => r.key));
      for (const name of this._staples) {
        const key = norm(name);
        const mem = st.products[key];
        if (inList.has(key) || taken.has(key) || (mem && mem.hidden)) continue;
        const l = this._lookup(name);
        result.push({ key, name: l.name, icon: l.icon, department: l.department, sub: "" });
        if (result.length >= 8) break;
      }
    }
    return result;
  }

  _search(q) {
    const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
    const inList = this._inListKeys();
    if (parts.length > 1) {
      return parts.map((part) => ({ ...this._lookup(part), isNew: true, inList: inList.has(norm(part)) }));
    }
    const nq = norm(q);
    if (!nq) return [];
    const pool = new Map();
    for (const e of this._catalog) pool.set(norm(e.name), { ...e, count: 0 });
    for (const [k, p] of Object.entries(this._state.products)) {
      pool.set(k, { name: p.name, icon: p.icon, department: p.department, count: (p.purchases || []).length });
    }
    const found = [];
    for (const [k, e] of pool) {
      let s = 0;
      if (k === nq) s = 100;
      else if (k.startsWith(nq)) s = 80;
      else if (k.split(" ").some((w) => w.startsWith(nq))) s = 60;
      else if (nq.length > 2 && k.includes(nq)) s = 40;
      if (s) found.push({ ...e, key: k, score: s + Math.min(e.count, 10), inList: inList.has(k) });
    }
    found.sort((a, b) => b.score - a.score || byName(a, b));
    const top = found.slice(0, 11);
    const typed = this._lookup(q);
    if (!top.some((r) => r.key === typed.key)) {
      // Lo escrito tal cual: primero si no hay coincidencias, al final si las hay.
      const tile = { ...typed, isNew: true, inList: inList.has(typed.key) };
      if (top.length) top.push(tile);
      else top.unshift(tile);
    }
    return top;
  }

  /* ------------------------------------------------------------ pintado */
  _tile(o) {
    const d = this._dept(o.department);
    const cls = ["tile", o.cls || "", o.enter ? "entering" : ""].join(" ").trim();
    return `<button type="button" class="${cls}" style="${tone(d.color)}" data-action="${o.action}"
      ${o.id ? `data-id="${esc(o.id)}"` : ""} ${o.name ? `data-name="${esc(o.name)}"` : ""}
      ${o.press ? `data-press="${o.press}"` : ""} aria-label="${esc(o.label)}">
      ${o.edit ? `<span class="edit" data-action="edit" data-id="${esc(o.id)}" title="Editar">${svg(P.pencil, 16)}</span>` : ""}
      ${o.tags ? `<span class="tags emoji">${o.tags}</span>` : ""}
      ${o.badge ? `<span class="badge">${svg(o.badge, 14)}</span>` : ""}
      <span class="em">${esc(o.icon)}</span>
      <span class="nm">${esc(o.title)}</span>
      ${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ""}
    </button>`;
  }

  _render() {
    if (!this.$) return;
    if (this._error) {
      const msg =
        this._error === "not_loaded"
          ? "Cesta no está configurada. Añádela en Ajustes → Dispositivos y servicios → Añadir integración."
          : `No se pudo cargar la lista: ${this._error}`;
      this.$.list.innerHTML = `<div class="empty"><div class="big emoji">🧺</div><strong>Sin conexión con Cesta</strong>${esc(msg)}</div>`;
      return;
    }
    if (!this._state) return;
    if (this._filter && !this._state.stores.some((s) => s.id === this._filter)) this._filter = null;
    const n = this._state.items.length;
    this.$.count.textContent = n ? `${n} ${n === 1 ? "producto" : "productos"}` : "";
    this._renderFilters();
    this._renderList();
    this._renderResults();
    this._renderSide();
    this._seen = new Set(this._state.items.map((i) => norm(i.name)));
  }

  _renderFilters() {
    const stores = this._state.stores;
    if (!stores.length) {
      this.$.filters.innerHTML = "";
      return;
    }
    const items = this._state.items;
    const count = (sid) => items.filter((i) => !i.stores.length || i.stores.includes(sid)).length;
    this.$.filters.innerHTML =
      `<button type="button" class="chip" data-action="filter" data-id="" aria-pressed="${!this._filter}">Todo <span class="n">${items.length}</span></button>` +
      stores
        .map(
          (s) => `<button type="button" class="chip" data-action="filter" data-id="${esc(s.id)}" aria-pressed="${this._filter === s.id}">
            <span class="emoji">${esc(s.icon)}</span>${esc(s.name)} <span class="n">${count(s.id)}</span></button>`
        )
        .join("");
  }

  _renderList() {
    const items = this._visibleItems();
    if (!items.length) {
      const store = this._filter && this._store(this._filter);
      this.$.list.innerHTML = store
        ? `<div class="empty"><div class="big emoji">${esc(store.icon)}</div><strong>Nada pendiente en ${esc(store.name)}</strong>Los productos sin tienda también aparecen aquí.</div>`
        : `<div class="empty"><div class="big emoji">🧺</div><strong>La lista está vacía</strong>Escribe arriba lo que necesitas o toca una sugerencia.</div>`;
      return;
    }
    const depts = this._depts;
    const known = new Set(depts.map((d) => d.id));
    const fallback = this._dept("otros").id;
    const groups = depts
      .map((d, i) => ({ d, i, items: items.filter((it) => (known.has(it.department) ? it.department : fallback) === d.id).sort(byName) }))
      .filter((g) => g.items.length);
    const fresh = (name) => this._seen && !this._seen.has(norm(name));
    this.$.list.innerHTML = groups
      .map(
        (g) => `<section class="group" style="${tone(g.d.color)}" aria-label="${esc(g.d.name)}">
          <div class="group-head"><span class="aisle" title="Orden en el recorrido">${g.i + 1}</span><span>${esc(g.d.name)}</span><span class="n">${g.items.length}</span></div>
          <div class="grid">${g.items
            .map((it) =>
              this._tile({
                action: "purchase", press: "item", id: it.id, department: it.department, icon: it.icon,
                title: it.name, sub: it.note, edit: true, enter: fresh(it.name),
                tags: this._filter ? "" : it.stores.map((s) => (this._store(s) || {}).icon || "").join(""),
                label: `${it.name}${it.note ? `, ${it.note}` : ""}. Toca para marcar como comprado; mantén pulsado para editar.`,
              })
            )
            .join("")}</div></section>`
      )
      .join("");
  }

  _renderResults() {
    const q = this._query;
    this.$.clear.hidden = !q;
    if (!q.trim()) {
      this.$.results.hidden = true;
      this.$.results.innerHTML = "";
      return;
    }
    const results = this._search(q);
    this.$.results.hidden = false;
    const tiles = results
      .map((r) =>
        r.inList
          ? this._tile({
              action: "toggle-off", name: r.name, department: r.department, icon: r.icon, title: r.name,
              sub: "En la lista", cls: "inlist", badge: P.check, label: `${r.name} ya está en la lista. Toca para quitarlo.`,
            })
          : this._tile({
              action: "add-name", name: r.name, department: r.department, icon: r.icon, title: r.name,
              sub: r.isNew && !this._state.products[r.key] && !this._catIndex.has(r.key) ? "Nuevo" : "",
              cls: r.isNew && !this._state.products[r.key] && !this._catIndex.has(r.key) ? "new" : "sugg",
              badge: P.plus, label: `Añadir ${r.name}`,
            })
      )
      .join("");
    const multi = q.includes(",");
    this.$.results.innerHTML = `<div class="grid">${tiles}</div>
      <p class="hint">${multi ? "Pulsa Intro para añadirlos todos." : "Separa con comas para añadir varios a la vez."}</p>`;
  }

  _renderSide() {
    const cfg = this._config;
    let html = "";
    if (cfg.show_suggestions !== false) {
      const sugg = this._suggestions();
      html += `<section><div class="section-head"><h2>Sugerencias</h2></div>
        ${sugg.length ? `<div class="grid">${sugg
          .map((s) =>
            this._tile({
              action: "add-name", press: "sugg", name: s.name, department: s.department, icon: s.icon,
              title: s.name, sub: s.sub, cls: "sugg", badge: P.plus, label: `Añadir ${s.name}${s.sub ? ` (${s.sub})` : ""}`,
            })
          )
          .join("")}</div>` : `<p class="muted">Cuando compres algo varias veces, aparecerá aquí al tocar reponerlo.</p>`}
      </section>`;
    }
    if (cfg.show_recent !== false) {
      const inList = this._inListKeys();
      const recent = this._state.recent.filter((r) => !inList.has(norm(r.name)));
      const limit = this._showAllRecent ? recent.length : 12;
      html += `<section><div class="section-head"><h2>Comprado recientemente</h2>
          ${recent.length ? `<span class="n">${recent.length}</span><button type="button" class="text-btn" data-action="clear-recent">Vaciar</button>` : ""}</div>
        ${recent.length ? `<div class="grid">${recent
          .slice(0, limit)
          .map((r) =>
            this._tile({
              action: "restore", press: "recent", id: r.id, department: r.department, icon: r.icon, title: r.name,
              sub: `${r.kind === "removed" ? "Quitado " : ""}${ago(r.purchased_at)}`, cls: "rec",
              label: `${r.name}, ${r.kind === "removed" ? "quitado" : "comprado"} ${ago(r.purchased_at)}. Toca para volver a añadirlo.`,
            })
          )
          .join("")}</div>
          ${recent.length > limit ? `<button type="button" class="text-btn more" data-action="more-recent">Ver los ${recent.length}</button>` : ""}`
        : `<p class="muted">Lo que marques como comprado quedará aquí para volver a añadirlo con un toque.</p>`}
      </section>`;
    }
    this.$.side.innerHTML = html;
    this.$.side.hidden = !html;
  }

  /* ------------------------------------------------------------ eventos */
  _onInput(e) {
    const t = e.composedPath()[0];
    if (t === this.$.input) {
      // Solo "input": el "change" del desenfoque re-pintaría la ficha que se está tocando.
      if (e.type !== "input" || t.value === this._query) return;
      this._query = t.value;
      if (this._state) this._renderResults();
      return;
    }
    if (this._sheet && t.dataset) this._sheetInput(t);
  }

  _onKey(e) {
    const t = e.composedPath()[0];
    if (t === this.$.input) {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        this._submitQuery();
      } else if (e.key === "Escape") {
        this._setQuery("");
      }
      return;
    }
    if ((e.key === "e" || e.key === "ContextMenu") && t.dataset && t.dataset.press) {
      e.preventDefault();
      this._openFor(t);
    }
  }

  _onClick(e) {
    if (this._lpFired) {
      this._lpFired = false;
      e.preventDefault();
      return;
    }
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const { action, id, name } = el.dataset;
    switch (action) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        break;
      case "settings":
        this._openSettings();
        break;
      case "clear":
        this._setQuery("");
        this.$.input.focus();
        break;
      case "filter":
        this._filter = id || null;
        this._render();
        break;
      case "purchase":
        this._purchase(id, el);
        break;
      case "edit":
        e.stopPropagation();
        this._openEditor(id);
        break;
      case "add-name":
        this._add(name, el);
        if (el.closest(".results")) {
          this._setQuery("");
          if (matchMedia("(hover:hover)").matches) this.$.input.focus();
        }
        break;
      case "toggle-off": {
        const it = this._state.items.find((i) => norm(i.name) === norm(name));
        if (it) this._remove(it.id);
        break;
      }
      case "restore":
        this._restore(id, el);
        break;
      case "clear-recent":
        this._ws({ type: "cesta/recent/clear" });
        this._optimistic((st) => (st.recent = []));
        break;
      case "more-recent":
        this._showAllRecent = true;
        this._renderSide();
        break;
      case "snack":
        clearTimeout(this._snackTimer);
        this.$.snack.classList.remove("show");
        if (this._snackFn) this._snackFn();
        this._snackFn = null;
        break;
      default:
        if (this._sheet) this._sheetAction(action, el);
    }
  }

  _onContext(e) {
    const tile = e.target.closest("[data-press]");
    if (!tile) return;
    e.preventDefault();
    clearTimeout(this._lp);
    this._openFor(tile);
  }
  _onPointerDown(e) {
    clearTimeout(this._lp);
    this._lpFired = false;
    const tile = e.target.closest("[data-press]");
    if (!tile || e.button > 0) return;
    this._lpAt = [e.clientX, e.clientY];
    this._lp = setTimeout(() => {
      this._lpFired = true;
      if (navigator.vibrate) navigator.vibrate(12);
      this._openFor(tile);
    }, 480);
  }
  _onPointerMove(e) {
    if (this._lpAt && Math.hypot(e.clientX - this._lpAt[0], e.clientY - this._lpAt[1]) > 10) clearTimeout(this._lp);
  }
  _openFor(tile) {
    if (this.$.dialog.open) return;
    const { press, id, name } = tile.dataset;
    if (press === "item") this._openEditor(id);
    else if (press === "sugg") this._openActions("sugg", name);
    else if (press === "recent") this._openActions("recent", id);
  }

  _setQuery(q) {
    this._query = q;
    this.$.input.value = q;
    this._renderResults();
  }
  _submitQuery() {
    const q = this._query.trim();
    if (!q || !this._state) return;
    for (const part of q.split(",").map((s) => s.trim()).filter(Boolean)) {
      const it = this._state.items.find((i) => norm(i.name) === norm(part));
      if (!it) this._add(part);
    }
    this._setQuery("");
  }

  /* ------------------------------------------------------- operaciones */
  async _ws(msg) {
    try {
      return await this._hass.callWS(msg);
    } catch (err) {
      this._state = this._server;
      this._render();
      this._toast(`No se pudo guardar: ${(err && err.message) || err}`);
      return null;
    }
  }
  _optimistic(fn) {
    const st = structuredClone(this._state);
    fn(st);
    this._state = st;
    this._render();
  }
  _leave(el, fn) {
    if (el && el.classList && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("leaving");
      setTimeout(fn, 150);
    } else fn();
  }

  _add(name, el) {
    if (!name || !this._state) return;
    const l = this._lookup(name);
    if (this._state.items.some((i) => norm(i.name) === l.key)) return;
    const stores = l.stores.length ? null : this._filter ? [this._filter] : null;
    this._leave(el && el.closest(".side") ? el : null, () => {
      this._optimistic((st) =>
        st.items.push({
          id: `tmp-${Math.random().toString(36).slice(2)}`, name: l.name, icon: l.icon, department: l.department,
          stores: stores || l.stores, note: "", added_at: nowS(),
        })
      );
      this._ws({ type: "cesta/item/add", name: l.name, ...(stores ? { stores } : {}) });
    });
  }

  _purchase(id, el) {
    if (!id || id.startsWith("tmp-")) return;
    const it = this._state.items.find((i) => i.id === id);
    if (!it) return;
    this._leave(el, () => {
      this._optimistic((st) => {
        st.items = st.items.filter((i) => i.id !== id);
        st.recent = [{ ...it, purchased_at: nowS(), kind: "purchased" }, ...st.recent.filter((r) => norm(r.name) !== norm(it.name))];
      });
      this._ws({ type: "cesta/item/purchase", item_id: id });
      this._toast(`Comprado: ${it.name}`, "Deshacer", () => this._undo(id));
    });
  }

  _remove(id) {
    const it = this._state.items.find((i) => i.id === id);
    if (!it || id.startsWith("tmp-")) return;
    this._optimistic((st) => {
      st.items = st.items.filter((i) => i.id !== id);
      st.recent = [{ ...it, purchased_at: nowS(), kind: "removed" }, ...st.recent.filter((r) => norm(r.name) !== norm(it.name))];
    });
    this._ws({ type: "cesta/item/remove", item_id: id });
    this._toast(`Quitado: ${it.name}`, "Deshacer", () => this._undo(id));
  }

  _undo(id) {
    const r = this._state.recent.find((x) => x.id === id);
    if (!r) return;
    this._optimistic((st) => {
      st.recent = st.recent.filter((x) => x.id !== id);
      st.items.push({ ...r });
    });
    this._ws({ type: "cesta/recent/restore", item_id: id, undo: true });
  }

  _restore(id, el) {
    const r = this._state.recent.find((x) => x.id === id);
    if (!r) return;
    this._leave(el, () => {
      this._optimistic((st) => {
        st.recent = st.recent.filter((x) => x.id !== id);
        st.items.push({ ...r, added_at: nowS() });
      });
      this._ws({ type: "cesta/recent/restore", item_id: id });
    });
  }

  _toast(text, label, fn) {
    const s = this.$.snack;
    s.querySelector("span").textContent = text;
    const b = s.querySelector("button");
    b.hidden = !label;
    b.textContent = label || "";
    this._snackFn = fn || null;
    s.classList.add("show");
    clearTimeout(this._snackTimer);
    this._snackTimer = setTimeout(() => {
      s.classList.remove("show");
      this._snackFn = null;
    }, 5000);
  }

  /* -------------------------------------------------------------- hojas */
  _openSheet(kind, html) {
    const d = this.$.dialog;
    this._sheet = kind;
    d.innerHTML = html;
    if (!d.open) d.showModal();
  }

  _openActions(kind, ref) {
    if (!this._state) return;
    let icon, name, dept, buttons;
    if (kind === "sugg") {
      const l = this._lookup(ref);
      [icon, name, dept] = [l.icon, l.name, l.department];
      this._sheetRef = ref;
      buttons = `<button type="button" class="btn" data-action="sheet-add">Añadir a la lista</button>
        <button type="button" class="btn quiet" data-action="sheet-hide">No sugerir más</button>`;
    } else {
      const r = this._state.recent.find((x) => x.id === ref);
      if (!r) return;
      [icon, name, dept] = [r.icon, r.name, r.department];
      this._sheetRef = ref;
      buttons = `<button type="button" class="btn" data-action="sheet-restore">Volver a la lista</button>
        <button type="button" class="btn danger" data-action="sheet-forget">Borrar del historial</button>`;
    }
    this._openSheet(
      kind,
      `<div class="sheet-head" style="${tone(this._dept(dept).color)}"><span class="big-em emoji" aria-hidden="true">${esc(icon)}</span>
        <h2>${esc(name)}</h2><button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${svg(P.close)}</button></div>
       <div class="actions">${buttons}</div>`
    );
  }

  _openEditor(id) {
    const it = this._state && this._state.items.find((i) => i.id === id);
    if (!it || id.startsWith("tmp-")) return;
    this._edit = { id, name: it.name, icon: it.icon, department: it.department, stores: [...it.stores], note: it.note || "" };
    const emojis = [...new Set([...this._catalog.map((e) => e.icon), ...this._depts.map((d) => d.icon), ...EXTRA_EMOJI.match(/\p{Extended_Pictographic}️?/gu)])];
    this._openSheet(
      "edit",
      `<div class="sheet-head" style="${tone(this._dept(it.department).color)}">
        <button type="button" class="big-em emoji" data-action="emojis" aria-label="Cambiar icono" title="Cambiar icono">${esc(it.icon)}</button>
        <input class="name-input" data-field="name" value="${esc(it.name)}" aria-label="Nombre" maxlength="120">
        <button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${svg(P.close)}</button>
      </div>
      <div class="sheet-body">
        <div class="emoji-grid" hidden>${emojis.map((e) => `<button type="button" class="emoji" data-action="pick" data-emoji="${esc(e)}">${e}</button>`).join("")}
          <label class="own">Otro: <input class="input emoji" data-field="icon" maxlength="16" placeholder="😀"></label></div>
        <label class="field"><span>Detalle</span><input class="input" data-field="note" value="${esc(it.note)}" placeholder="Cantidad, marca, tamaño…" maxlength="200"></label>
        <div class="field"><span>Departamento</span><div class="chips dept-chips"></div></div>
        ${this._state.stores.length ? `<div class="field"><span>Dónde comprarlo</span><div class="chips store-chips"></div></div>` : ""}
      </div>
      <div class="sheet-foot"><button type="button" class="btn danger" data-action="edit-remove">Quitar de la lista</button><span class="grow"></span>
        <button type="button" class="btn" data-action="edit-save">Guardar</button></div>`
    );
    this._renderEditorChips();
  }

  _renderEditorChips() {
    const d = this.$.dialog;
    const e = this._edit;
    d.querySelector(".dept-chips").innerHTML = this._depts
      .map(
        (x) => `<button type="button" class="chip dept" style="${tone(x.color)}" data-action="pick-dept" data-id="${esc(x.id)}" aria-pressed="${e.department === x.id}">
          <span class="dot"></span>${esc(x.name)}</button>`
      )
      .join("");
    const sc = d.querySelector(".store-chips");
    if (sc)
      sc.innerHTML = this._state.stores
        .map(
          (s) => `<button type="button" class="chip" data-action="pick-store" data-id="${esc(s.id)}" aria-pressed="${e.stores.includes(s.id)}">
            <span class="emoji">${esc(s.icon)}</span>${esc(s.name)}</button>`
        )
        .join("");
    const head = d.querySelector(".sheet-head");
    head.setAttribute("style", tone(this._dept(e.department).color));
    head.querySelector(".big-em").textContent = e.icon;
  }

  _openSettings() {
    if (!this._state) return;
    this._settings = {
      departments: this._depts.map((d) => ({ ...d })),
      stores: this._state.stores.map((s) => ({ ...s })),
    };
    this._openSheet(
      "settings",
      `<div class="sheet-head"><h2>Ajustes</h2><button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">${svg(P.close)}</button></div>
       <div class="sheet-body settings"></div>
       <div class="sheet-foot"><span class="grow"></span><button type="button" class="btn quiet" data-action="close">Cancelar</button>
         <button type="button" class="btn" data-action="settings-save">Guardar</button></div>`
    );
    this._renderSettings();
  }

  _renderSettings() {
    const s = this._settings;
    const last = s.departments.length - 1;
    const body = this.$.dialog.querySelector(".settings");
    body.innerHTML = `
      <h3>Recorrido por el supermercado</h3>
      <p>Ordena los departamentos como los recorres; la lista sigue este orden y cada color identifica su sección.</p>
      <div class="rows">${s.departments
        .map(
          (d, i) => `<div class="row">
            <button type="button" class="icon-btn" data-action="dept-up" data-id="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>${svg(P.up, 20)}</button>
            <button type="button" class="icon-btn" data-action="dept-down" data-id="${i}" aria-label="Bajar" ${i === last ? "disabled" : ""}>${svg(P.down, 20)}</button>
            <input type="color" value="${esc(d.color)}" data-list="departments" data-i="${i}" data-key="color" aria-label="Color de ${esc(d.name)}">
            <input class="input em-input emoji" value="${esc(d.icon)}" data-list="departments" data-i="${i}" data-key="icon" maxlength="16" aria-label="Icono">
            <input class="input" value="${esc(d.name)}" data-list="departments" data-i="${i}" data-key="name" maxlength="60" aria-label="Nombre del departamento">
            <button type="button" class="icon-btn" data-action="dept-del" data-id="${i}" aria-label="Eliminar ${esc(d.name)}" ${s.departments.length < 2 ? "disabled" : ""}>${svg(P.trash, 20)}</button>
          </div>`
        )
        .join("")}</div>
      <button type="button" class="text-btn add-row" data-action="dept-add">Añadir departamento</button>
      <h3>Tiendas</h3>
      <p>Etiqueta cada producto con dónde lo compras y filtra la lista por tienda.</p>
      <div class="rows">${s.stores
        .map(
          (st, i) => `<div class="row">
            <input class="input em-input emoji" value="${esc(st.icon)}" data-list="stores" data-i="${i}" data-key="icon" maxlength="16" aria-label="Icono">
            <input class="input" value="${esc(st.name)}" data-list="stores" data-i="${i}" data-key="name" maxlength="60" aria-label="Nombre de la tienda">
            <button type="button" class="icon-btn" data-action="store-del" data-id="${i}" aria-label="Eliminar ${esc(st.name)}">${svg(P.trash, 20)}</button>
          </div>`
        )
        .join("")}</div>
      <button type="button" class="text-btn add-row" data-action="store-add">Añadir tienda</button>`;
  }

  _sheetInput(t) {
    if (this._sheet === "edit" && t.dataset.field) {
      this._edit[t.dataset.field] = t.value;
      if (t.dataset.field === "icon" && t.value.trim()) this._renderEditorChips();
    } else if (this._sheet === "settings" && t.dataset.list) {
      this._settings[t.dataset.list][+t.dataset.i][t.dataset.key] = t.value;
    }
  }

  _sheetAction(action, el) {
    const d = this.$.dialog;
    const i = +el.dataset.id;
    const s = this._settings;
    switch (action) {
      case "close":
        d.close();
        break;
      case "sheet-add":
        d.close();
        this._add(this._sheetRef);
        break;
      case "sheet-hide": {
        const name = this._lookup(this._sheetRef).name;
        d.close();
        this._optimistic((st) => {
          const k = norm(name);
          st.products[k] = { ...(st.products[k] || { name, purchases: [], stores: [] }), hidden: true };
        });
        this._ws({ type: "cesta/product/hide", name });
        this._toast(`No se sugerirá más: ${name}`, "Deshacer", () => this._ws({ type: "cesta/product/hide", name, hidden: false }));
        break;
      }
      case "sheet-restore":
        d.close();
        this._restore(this._sheetRef);
        break;
      case "sheet-forget": {
        const id = this._sheetRef;
        d.close();
        this._optimistic((st) => (st.recent = st.recent.filter((x) => x.id !== id)));
        this._ws({ type: "cesta/recent/delete", item_id: id });
        break;
      }
      case "emojis":
        d.querySelector(".emoji-grid").hidden = !d.querySelector(".emoji-grid").hidden;
        break;
      case "pick":
        this._edit.icon = el.dataset.emoji;
        d.querySelector(".emoji-grid").hidden = true;
        this._renderEditorChips();
        break;
      case "pick-dept":
        this._edit.department = el.dataset.id;
        this._renderEditorChips();
        break;
      case "pick-store": {
        const sid = el.dataset.id;
        const st = this._edit.stores;
        this._edit.stores = st.includes(sid) ? st.filter((x) => x !== sid) : [...st, sid];
        this._renderEditorChips();
        break;
      }
      case "edit-save": {
        const e = this._edit;
        const it = this._state.items.find((x) => x.id === e.id);
        d.close();
        if (!it) return;
        const name = cap(e.name) || it.name;
        const icon = (e.icon || "").trim() || it.icon;
        this._optimistic((st) => {
          const x = st.items.find((y) => y.id === e.id);
          if (x) Object.assign(x, { name, icon, department: e.department, stores: e.stores, note: e.note.trim() });
        });
        this._ws({ type: "cesta/item/update", item_id: e.id, name, icon, department: e.department, stores: e.stores, note: e.note.trim() });
        break;
      }
      case "edit-remove":
        d.close();
        this._remove(this._edit.id);
        break;
      case "dept-up":
      case "dept-down": {
        const j = action === "dept-up" ? i - 1 : i + 1;
        [s.departments[i], s.departments[j]] = [s.departments[j], s.departments[i]];
        this._renderSettings();
        d.querySelector(`[data-action="${action}"][data-id="${j}"]`)?.focus();
        break;
      }
      case "dept-del":
        s.departments.splice(i, 1);
        this._renderSettings();
        break;
      case "dept-add":
        s.departments.push({ name: "Nuevo departamento", icon: "🛒", color: "#7E57C2" });
        this._renderSettings();
        d.querySelector(`[data-list="departments"][data-i="${s.departments.length - 1}"][data-key="name"]`)?.select();
        break;
      case "store-del":
        s.stores.splice(i, 1);
        this._renderSettings();
        break;
      case "store-add":
        s.stores.push({ name: "Nueva tienda", icon: "🏪" });
        this._renderSettings();
        d.querySelector(`[data-list="stores"][data-i="${s.stores.length - 1}"][data-key="name"]`)?.select();
        break;
      case "settings-save": {
        const departments = s.departments.filter((x) => x.name.trim()).map(({ id, name, icon, color }) => ({ ...(id ? { id } : {}), name, icon, color }));
        const stores = s.stores.filter((x) => x.name.trim()).map(({ id, name, icon }) => ({ ...(id ? { id } : {}), name, icon }));
        d.close();
        if (departments.length) this._ws({ type: "cesta/departments/set", departments });
        this._ws({ type: "cesta/stores/set", stores });
        break;
      }
    }
  }
}

/* --------------------------------------------------------- panel lateral */
class CestaPanel extends CestaBase {
  get mode() {
    return "panel";
  }
  set panel(p) {
    this._panel = p;
  }
  set route(r) {
    this._route = r;
  }
}

/* --------------------------------------------------------------- tarjeta */
class CestaCard extends CestaBase {
  get mode() {
    return "card";
  }
  setConfig(config) {
    this._config = { ...(config || {}) };
    if (this._config.store) this._filter = this._config.store;
    if (this.$) {
      this.shadowRoot.querySelector(".title").textContent = this._config.title || "Cesta";
      this._render();
    }
  }
  getCardSize() {
    return 8;
  }
  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }
  static getStubConfig() {
    return {};
  }
}

if (!customElements.get("cesta-panel")) customElements.define("cesta-panel", CestaPanel);
if (!customElements.get("cesta-card")) {
  customElements.define("cesta-card", CestaCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "cesta-card",
    name: "Cesta",
    description: "Lista de la compra visual: iconos por departamento, sugerencias y comprado recientemente.",
  });
  console.info(`%c CESTA %c ${CESTA_VERSION} `, "background:#43A047;color:#fff;border-radius:4px 0 0 4px;padding:2px 4px", "background:#555;color:#fff;border-radius:0 4px 4px 0;padding:2px 4px");
}
