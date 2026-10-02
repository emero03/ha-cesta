/* Backend simulado para la vista previa: replica en JS el gestor de Python
 * (custom_components/cesta/manager.py) y expone un objeto `hass` falso con
 * callWS y connection.subscribeMessage. Solo para la demo. */
(function () {
  const CATALOG = window.CESTA_CATALOG;
  const STAPLES = window.CESTA_STAPLES;
  const DEFAULT_DEPARTMENTS = window.CESTA_DEPARTMENTS;
  const DEFAULT_STORES = window.CESTA_STORES;

  const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const stem = (w) => {
    if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
    if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
    return w;
  };
  const stems = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean).map(stem);
  const clean = (n) => {
    n = String(n ?? "").replace(/\s+/g, " ").trim();
    return n ? n[0].toUpperCase() + n.slice(1) : n;
  };
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || uid();
  const uid = () => Math.random().toString(16).slice(2, 14);
  const now = () => Math.round(Date.now()) / 1000;
  const err = (code, message) => Object.assign(new Error(message), { code });

  const catIndex = new Map(CATALOG.map((e) => [norm(e.name), e]));
  const catStems = CATALOG.map((e) => [stems(e.name), e]);
  const byStems = new Map(catStems.map(([w, e]) => [w.join(" "), e]));
  const canonical = (name) => catIndex.get(norm(name)) || byStems.get(stems(name).join(" "));
  function guess(name) {
    const key = norm(name);
    if (catIndex.has(key)) return catIndex.get(key);
    const words = stems(name);
    let best = null;
    let bestScore = 0;
    for (const [cw, entry] of catStems) {
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

  /* ---------- datos de ejemplo (fechas relativas a ahora) */
  function seed() {
    const t = now();
    const H = 3600;
    const D = 86400;
    const products = {};
    const hist = (lastAgo, every, n) => Array.from({ length: n }, (_, i) => t - lastAgo - every * (n - 1 - i));
    const remember = (it, purchases = []) => {
      products[norm(it.name)] = {
        name: it.name, icon: it.icon, department: it.department, stores: [...it.stores],
        purchases, hidden: false,
      };
    };
    const make = (name, extra = {}) => {
      const e = catIndex.get(norm(name));
      return { id: uid(), name: e.name, icon: e.icon, department: e.department, stores: [], note: "", added_at: t - D, ...extra };
    };
    const items = [
      make("Tomates", { stores: ["mercado"] }),
      make("Aguacates", { stores: ["mercado"], note: "maduros" }),
      make("Plátanos"),
      make("Pan de molde"),
      make("Pechugas de pollo", { note: "1 kg" }),
      make("Salmón", { stores: ["mercado"] }),
      make("Leche sin lactosa", { note: "6 bricks" }),
      make("Huevos", { note: "docena" }),
      make("Yogur griego"),
      make("Arroz", { note: "redondo" }),
      make("Café molido"),
      make("Detergente"),
      make("Papel higiénico"),
      make("Ibuprofeno", { stores: ["farmacia"] }),
    ];
    items.forEach((it) => remember(it, hist(10 * D, 9 * D, 3)));

    const recentSpec = [
      ["Queso curado", 2 * H, 12 * D, "purchased"],
      ["Galletas", 5 * H, 9 * D, "purchased"],
      ["Cerveza", 1.1 * D, 7 * D, "purchased"],
      ["Lejía", 2 * D, 30 * D, "purchased"],
      ["Manzanas", 3 * D, 6 * D, "removed"],
      ["Mantequilla", 4 * D, 14 * D, "purchased"],
      ["Pasta", 5 * D, 10 * D, "purchased"],
    ];
    const recent = recentSpec.map(([name, ago, every, kind]) => {
      const it = make(name);
      remember(it, hist(kind === "removed" ? ago + 4 * D : ago, every, 4));
      return { ...it, purchased_at: t - ago, kind };
    });

    // Historial que genera sugerencias: "te toca" (cada N días) y habituales
    for (const [name, lastAgo, every, n] of [
      ["Barra de pan", 3 * D, 2 * D, 6],
      ["Mandarinas", 6 * D, 5 * D, 5],
      ["Agua", 8 * D, 7 * D, 5],
      ["Aceite de oliva", 20 * D, 21 * D, 4],
      ["Zumo de naranja", 2 * D, 4 * D, 6],
    ]) {
      remember(make(name), hist(lastAgo, every, n));
    }

    return {
      items,
      recent,
      products,
      departments: structuredClone(DEFAULT_DEPARTMENTS),
      stores: structuredClone(DEFAULT_STORES),
    };
  }

  /* ---------- operaciones (mismas reglas que manager.py) */
  class Backend {
    constructor() {
      this.listeners = new Set();
      this.data = seed();
    }
    reset() {
      this.data = seed();
      this.emit();
    }
    emit() {
      for (const l of this.listeners) l(structuredClone(this.data));
    }
    get items() { return this.data.items; }
    get recent() { return this.data.recent; }
    get products() { return this.data.products; }
    deptIds() { return this.data.departments.map((d) => d.id); }
    fallback() { const ids = this.deptIds(); return ids.includes("otros") ? "otros" : ids[0]; }
    findByName(name) { const k = norm(name); return this.items.find((i) => norm(i.name) === k); }
    resolveDept(v) {
      if (!v) return null;
      const d = this.data.departments.find((x) => x.id === v || norm(x.name) === norm(v));
      return d ? d.id : null;
    }
    resolveStores(values) {
      const out = [];
      for (const v of values || []) {
        const s = this.data.stores.find((x) => x.id === v || norm(x.name) === norm(v));
        if (s && !out.includes(s.id)) out.push(s.id);
      }
      return out;
    }
    remember(item) {
      const k = norm(item.name);
      const mem = this.products[k] || {};
      this.products[k] = { name: item.name, icon: item.icon, department: item.department, stores: [...item.stores], purchases: mem.purchases || [], hidden: false };
    }
    toRecent(item, kind) {
      const entry = { ...item, purchased_at: now(), kind };
      const k = norm(item.name);
      this.data.recent = [entry, ...this.recent.filter((r) => norm(r.name) !== k)].slice(0, 40);
      return entry;
    }
    getItem(id) {
      const it = this.items.find((i) => i.id === id);
      if (!it) throw err("not_found", `No hay ningún elemento con id ${id}`);
      return it;
    }

    add({ name, icon, department, stores, note }) {
      name = clean(name);
      if (!name) throw err("invalid_name", "El nombre no puede estar vacío");
      let key = norm(name);
      const canon = !this.products[key] && canonical(name);
      if (canon) [name, key] = [canon.name, norm(canon.name)];
      const existing = this.findByName(name);
      if (existing) {
        if (note) existing.note = note.trim();
        return existing;
      }
      const mem = this.products[key] || {};
      const g = guess(name);
      if (mem.name) name = mem.name;
      let dept = this.resolveDept(department) || mem.department || (g && g.department);
      if (!this.deptIds().includes(dept)) dept = this.fallback();
      const valid = new Set(this.data.stores.map((s) => s.id));
      const item = {
        id: uid(), name,
        icon: (icon || "").trim() || mem.icon || (g ? g.icon : "🛒"),
        department: dept,
        stores: stores ? this.resolveStores(stores) : (mem.stores || []).filter((s) => valid.has(s)),
        note: (note || "").trim(),
        added_at: now(),
      };
      this.items.push(item);
      this.remember(item);
      return item;
    }
    update({ item_id, ...ch }) {
      const item = this.items.find((i) => i.id === item_id) || this.recent.find((i) => i.id === item_id);
      if (!item) throw err("not_found", `No hay ningún elemento con id ${item_id}`);
      if (ch.name != null) {
        const n = clean(ch.name);
        if (!n) throw err("invalid_name", "El nombre no puede estar vacío");
        item.name = n;
      }
      if (ch.icon) item.icon = ch.icon.trim();
      if (ch.department != null) item.department = this.resolveDept(ch.department) || this.fallback();
      if (ch.stores != null) item.stores = this.resolveStores(ch.stores);
      if (ch.note != null) item.note = ch.note.trim();
      this.remember(item);
      return item;
    }
    purchase({ item_id }) {
      const item = this.getItem(item_id);
      this.data.items = this.items.filter((i) => i !== item);
      const entry = this.toRecent(item, "purchased");
      const k = norm(item.name);
      if (!this.products[k]) this.remember(item);
      const h = this.products[k].purchases;
      h.push(entry.purchased_at);
      this.products[k].purchases = h.slice(-12);
      return entry;
    }
    remove({ item_id }) {
      const item = this.getItem(item_id);
      this.data.items = this.items.filter((i) => i !== item);
      return this.toRecent(item, "removed");
    }
    restore({ item_id, undo = false }) {
      const entry = this.recent.find((r) => r.id === item_id);
      if (!entry) throw err("not_found", `No hay ningún elemento con id ${item_id}`);
      this.data.recent = this.recent.filter((r) => r !== entry);
      if (undo && entry.kind === "purchased") {
        const mem = this.products[norm(entry.name)];
        if (mem) {
          const i = mem.purchases.lastIndexOf(entry.purchased_at);
          if (i >= 0) mem.purchases.splice(i, 1);
        }
      }
      const existing = this.findByName(entry.name);
      if (existing) return existing;
      const { purchased_at, kind, ...item } = entry;
      if (!undo) item.added_at = now();
      this.items.push(item);
      this.remember(item);
      return item;
    }
    recentDelete({ item_id }) {
      if (!this.recent.some((r) => r.id === item_id)) throw err("not_found", "No existe");
      this.data.recent = this.recent.filter((r) => r.id !== item_id);
    }
    recentClear() { this.data.recent = []; }
    hide({ name, hidden = true }) {
      const k = norm(name);
      if (!this.products[k]) {
        const e = catIndex.get(k);
        this.products[k] = { name: e ? e.name : clean(name), icon: e ? e.icon : "🛒", department: e ? e.department : this.fallback(), stores: [], purchases: [] };
      }
      this.products[k].hidden = hidden;
    }
    setDepartments({ departments }) {
      const taken = new Set();
      const out = [];
      for (const d of departments) {
        const name = clean(d.name);
        if (!name) continue;
        let id = d.id || slug(name);
        let n = 2;
        const base = id;
        while (taken.has(id)) id = `${base}_${n++}`;
        taken.add(id);
        out.push({ id, name, icon: (d.icon || "🛒").trim(), color: /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : "#78909C" });
      }
      if (!out.length) throw err("invalid", "Tiene que haber al menos un departamento");
      this.data.departments = out;
      const fb = this.fallback();
      for (const e of [...this.items, ...this.recent, ...Object.values(this.products)]) if (!taken.has(e.department)) e.department = fb;
    }
    setStores({ stores }) {
      const taken = new Set();
      const out = [];
      for (const s of stores) {
        const name = clean(s.name);
        if (!name) continue;
        let id = s.id || slug(name);
        let n = 2;
        const base = id;
        while (taken.has(id)) id = `${base}_${n++}`;
        taken.add(id);
        out.push({ id, name, icon: (s.icon || "🏪").trim() });
      }
      this.data.stores = out;
      for (const e of [...this.items, ...this.recent, ...Object.values(this.products)]) e.stores = (e.stores || []).filter((x) => taken.has(x));
    }

    call(msg) {
      const ops = {
        "cesta/catalog": () => ({ catalog: CATALOG, staples: STAPLES }),
        "cesta/item/add": () => this.add(msg),
        "cesta/item/update": () => this.update(msg),
        "cesta/item/purchase": () => this.purchase(msg),
        "cesta/item/remove": () => this.remove(msg),
        "cesta/recent/restore": () => this.restore(msg),
        "cesta/recent/delete": () => this.recentDelete(msg),
        "cesta/recent/clear": () => this.recentClear(),
        "cesta/product/hide": () => this.hide(msg),
        "cesta/departments/set": () => this.setDepartments(msg),
        "cesta/stores/set": () => this.setStores(msg),
      };
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const op = ops[msg.type];
          if (!op) return reject(err("unknown_command", "Unknown command."));
          try {
            const result = op();
            if (msg.type !== "cesta/catalog") this.emit();
            resolve(result === undefined ? null : structuredClone(result));
          } catch (e) {
            reject(e);
          }
        }, 60);
      });
    }
    subscribe(cb) {
      this.listeners.add(cb);
      setTimeout(() => cb(structuredClone(this.data)), 30);
      return Promise.resolve(() => this.listeners.delete(cb));
    }
  }

  const backend = new Backend();
  window.CestaDemo = {
    backend,
    hass: {
      language: "es",
      dockedSidebar: "docked",
      callWS: (msg) => backend.call(msg),
      connection: { subscribeMessage: (cb) => backend.subscribe(cb) },
    },
  };
})();
