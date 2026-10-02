"""Gestor de datos de Cesta: lista, comprados recientemente y memoria de productos."""

from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
import logging
import re
from typing import Any
import uuid

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .catalog import CATALOG_INDEX, canonical_product, guess_product, normalize
from .const import (
    DEFAULT_DEPARTMENTS,
    DEFAULT_ICON,
    DEFAULT_STORE_ICON,
    DEFAULT_STORES,
    FALLBACK_DEPARTMENT,
    MAX_HISTORY,
    MAX_RECENT,
    SAVE_DELAY,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)

ITEM_FIELDS = ("id", "name", "icon", "department", "stores", "note", "added_at")
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class CestaError(Exception):
    """Error de operación (elemento inexistente, nombre vacío...)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", normalize(text)).strip("_")
    return slug or _new_id()


def _clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", str(name)).strip()
    return name[:1].upper() + name[1:] if name else name


def _now() -> float:
    return round(dt_util.utcnow().timestamp(), 3)


class CestaManager:
    """Fuente única de verdad de la lista. Todas las operaciones son síncronas
    (se ejecutan en el bucle de eventos) y notifican a los suscriptores."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data: dict[str, Any] = {}
        self._listeners: list[Callable[[], None]] = []

    # ------------------------------------------------------------------ carga
    async def async_load(self) -> None:
        """Carga los datos guardados (o crea los iniciales)."""
        stored = await self._store.async_load() or {}
        self.data = {
            "items": stored.get("items", []),
            "recent": stored.get("recent", []),
            "products": stored.get("products", {}),
            "departments": stored.get("departments") or deepcopy(DEFAULT_DEPARTMENTS),
            "stores": stored.get("stores")
            if stored.get("stores") is not None
            else deepcopy(DEFAULT_STORES),
        }

    @callback
    def async_add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Registra un oyente de cambios. Devuelve la función para quitarlo."""
        self._listeners.append(listener)

        @callback
        def remove() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return remove

    @callback
    def _changed(self) -> None:
        self._store.async_delay_save(lambda: self.data, SAVE_DELAY)
        for listener in list(self._listeners):
            try:
                listener()
            except Exception:  # pragma: no cover - un oyente roto no debe romper el resto
                _LOGGER.exception("Error notificando un cambio de Cesta")

    @callback
    def snapshot(self) -> dict[str, Any]:
        """Copia completa del estado para enviar al panel."""
        return deepcopy(self.data)

    # -------------------------------------------------------------- utilidades
    @property
    def items(self) -> list[dict[str, Any]]:
        return self.data["items"]

    @property
    def recent(self) -> list[dict[str, Any]]:
        return self.data["recent"]

    @property
    def products(self) -> dict[str, dict[str, Any]]:
        return self.data["products"]

    def _find(self, collection: list[dict[str, Any]], item_id: str) -> int:
        for index, item in enumerate(collection):
            if item["id"] == item_id:
                return index
        return -1

    def _get_item(self, item_id: str) -> dict[str, Any]:
        index = self._find(self.items, item_id)
        if index < 0:
            raise CestaError("not_found", f"No hay ningún elemento con id {item_id}")
        return self.items[index]

    def find_by_name(self, name: str) -> dict[str, Any] | None:
        """Elemento de la lista con ese nombre (sin distinguir tildes/mayúsculas)."""
        key = normalize(name)
        return next((i for i in self.items if normalize(i["name"]) == key), None)

    def department_ids(self) -> list[str]:
        return [d["id"] for d in self.data["departments"]]

    def _fallback_department(self) -> str:
        ids = self.department_ids()
        return FALLBACK_DEPARTMENT if FALLBACK_DEPARTMENT in ids else ids[0]

    def resolve_department(self, value: str | None) -> str | None:
        """Acepta el id o el nombre de un departamento."""
        if not value:
            return None
        key = normalize(value)
        for dept in self.data["departments"]:
            if dept["id"] == value or normalize(dept["name"]) == key:
                return dept["id"]
        return None

    def resolve_store(self, value: str | None) -> str | None:
        """Acepta el id o el nombre de una tienda."""
        if not value:
            return None
        key = normalize(value)
        for store in self.data["stores"]:
            if store["id"] == value or normalize(store["name"]) == key:
                return store["id"]
        return None

    def resolve_stores(self, values: list[str] | None, create: bool = False) -> list[str]:
        """Convierte nombres/ids de tiendas en ids. Con create=True crea las nuevas."""
        result: list[str] = []
        created = False
        for value in values or []:
            store_id = self.resolve_store(value)
            if store_id is None and create and str(value).strip():
                store_id = self._unique_id(_slug(value), {s["id"] for s in self.data["stores"]})
                self.data["stores"].append(
                    {"id": store_id, "name": _clean_name(value), "icon": DEFAULT_STORE_ICON}
                )
                created = True
            if store_id and store_id not in result:
                result.append(store_id)
        if created:
            _LOGGER.debug("Tiendas creadas automáticamente: %s", result)
        return result

    @staticmethod
    def _unique_id(base: str, taken: set[str]) -> str:
        candidate, n = base, 2
        while candidate in taken:
            candidate = f"{base}_{n}"
            n += 1
        return candidate

    def _remember(self, item: dict[str, Any]) -> None:
        """Guarda cómo le gusta al usuario este producto (icono, sección, tiendas)."""
        key = normalize(item["name"])
        memory = self.products.get(key, {})
        self.products[key] = {
            "name": item["name"],
            "icon": item["icon"],
            "department": item["department"],
            "stores": list(item["stores"]),
            "purchases": memory.get("purchases", []),
            "hidden": False,
        }

    # ------------------------------------------------------------- operaciones
    @callback
    def add_item(
        self,
        name: str,
        *,
        icon: str | None = None,
        department: str | None = None,
        stores: list[str] | None = None,
        note: str | None = None,
        create_stores: bool = False,
    ) -> dict[str, Any]:
        """Añade un producto. Si ya está en la lista, devuelve el existente."""
        name = _clean_name(name)
        if not name:
            raise CestaError("invalid_name", "El nombre no puede estar vacío")
        key = normalize(name)
        if key not in self.products and (canon := canonical_product(name)):
            name, key = canon["name"], normalize(canon["name"])  # "tomate" → "Tomates"

        if existing := self.find_by_name(name):
            if note:
                existing["note"] = note.strip()
                self._changed()
            return existing

        memory = self.products.get(key) or {}
        guess = guess_product(name)
        if memory.get("name"):
            name = memory["name"]

        dept = self.resolve_department(department)
        if dept is None:
            dept = memory.get("department") or (guess["department"] if guess else None)
        if dept not in self.department_ids():
            dept = self._fallback_department()

        if stores is not None:
            store_ids = self.resolve_stores(stores, create=create_stores)
        else:
            valid = {s["id"] for s in self.data["stores"]}
            store_ids = [s for s in memory.get("stores", []) if s in valid]

        item = {
            "id": _new_id(),
            "name": name,
            "icon": (icon or "").strip()
            or memory.get("icon")
            or (guess["icon"] if guess else DEFAULT_ICON),
            "department": dept,
            "stores": store_ids,
            "note": (note or "").strip(),
            "added_at": _now(),
        }
        self.items.append(item)
        self._remember(item)
        self._changed()
        return item

    @callback
    def update_item(self, item_id: str, **changes: Any) -> dict[str, Any]:
        """Edita un producto de la lista (o de comprados recientemente)."""
        index = self._find(self.items, item_id)
        if index >= 0:
            item = self.items[index]
        else:
            index = self._find(self.recent, item_id)
            if index < 0:
                raise CestaError("not_found", f"No hay ningún elemento con id {item_id}")
            item = self.recent[index]

        if changes.get("name") is not None:
            name = _clean_name(changes["name"])
            if not name:
                raise CestaError("invalid_name", "El nombre no puede estar vacío")
            item["name"] = name
        if changes.get("icon"):
            item["icon"] = changes["icon"].strip()
        if changes.get("department") is not None:
            item["department"] = (
                self.resolve_department(changes["department"]) or self._fallback_department()
            )
        if changes.get("stores") is not None:
            item["stores"] = self.resolve_stores(changes["stores"])
        if changes.get("note") is not None:
            item["note"] = changes["note"].strip()

        self._remember(item)
        self._changed()
        return item

    def _to_recent(self, item: dict[str, Any], kind: str) -> dict[str, Any]:
        entry = {**item, "purchased_at": _now(), "kind": kind}
        key = normalize(item["name"])
        self.data["recent"] = [r for r in self.recent if normalize(r["name"]) != key]
        self.recent.insert(0, entry)
        del self.recent[MAX_RECENT:]
        return entry

    @callback
    def purchase_item(self, item_id: str) -> dict[str, Any]:
        """Marca como comprado: sale de la lista y pasa a recientes."""
        item = self._get_item(item_id)
        self.items.remove(item)
        entry = self._to_recent(item, "purchased")
        key = normalize(item["name"])
        if key not in self.products:
            self._remember(item)
        history = self.products[key].setdefault("purchases", [])
        history.append(entry["purchased_at"])
        del history[:-MAX_HISTORY]
        self._changed()
        return entry

    @callback
    def remove_item(self, item_id: str) -> dict[str, Any]:
        """Quita de la lista sin contarlo como compra (queda en recientes por si acaso)."""
        item = self._get_item(item_id)
        self.items.remove(item)
        entry = self._to_recent(item, "removed")
        self._changed()
        return entry

    @callback
    def restore_recent(self, item_id: str, undo: bool = False) -> dict[str, Any]:
        """Devuelve a la lista un elemento de comprados recientemente."""
        index = self._find(self.recent, item_id)
        if index < 0:
            raise CestaError("not_found", f"No hay ningún elemento con id {item_id}")
        entry = self.recent.pop(index)

        if undo and entry.get("kind") == "purchased":
            memory = self.products.get(normalize(entry["name"]))
            if memory and entry["purchased_at"] in memory.get("purchases", []):
                memory["purchases"].remove(entry["purchased_at"])

        if existing := self.find_by_name(entry["name"]):
            self._changed()
            return existing

        item = {field: entry.get(field) for field in ITEM_FIELDS}
        item["stores"] = list(item["stores"] or [])
        item["note"] = item["note"] or ""
        if not undo:
            item["added_at"] = _now()
        self.items.append(item)
        self._remember(item)
        self._changed()
        return item

    @callback
    def delete_recent(self, item_id: str) -> None:
        index = self._find(self.recent, item_id)
        if index < 0:
            raise CestaError("not_found", f"No hay ningún elemento con id {item_id}")
        self.recent.pop(index)
        self._changed()

    @callback
    def clear_recent(self) -> None:
        self.recent.clear()
        self._changed()

    @callback
    def set_product_hidden(self, name: str, hidden: bool = True) -> None:
        """Oculta (o vuelve a mostrar) un producto en las sugerencias."""
        key = normalize(name)
        memory = self.products.get(key)
        if memory is None:
            entry = CATALOG_INDEX.get(key)
            memory = {
                "name": entry["name"] if entry else _clean_name(name),
                "icon": entry["icon"] if entry else DEFAULT_ICON,
                "department": entry["department"] if entry else self._fallback_department(),
                "stores": [],
                "purchases": [],
            }
            self.products[key] = memory
        memory["hidden"] = hidden
        self._changed()

    @callback
    def set_departments(self, departments: list[dict[str, Any]]) -> None:
        """Reemplaza departamentos (orden, nombres, colores, iconos)."""
        cleaned: list[dict[str, str]] = []
        taken: set[str] = set()
        for dept in departments:
            name = _clean_name(dept.get("name", ""))
            if not name:
                continue
            dept_id = dept.get("id") or _slug(name)
            dept_id = self._unique_id(dept_id, taken)
            taken.add(dept_id)
            color = dept.get("color", "")
            cleaned.append(
                {
                    "id": dept_id,
                    "name": name,
                    "icon": (dept.get("icon") or DEFAULT_ICON).strip(),
                    "color": color if _HEX_COLOR.match(color) else "#78909C",
                }
            )
        if not cleaned:
            raise CestaError("invalid", "Tiene que haber al menos un departamento")
        self.data["departments"] = cleaned
        fallback = self._fallback_department()
        for collection in (self.items, self.recent, self.products.values()):
            for entry in collection:
                if entry.get("department") not in taken:
                    entry["department"] = fallback
        self._changed()

    @callback
    def set_stores(self, stores: list[dict[str, Any]]) -> None:
        """Reemplaza las tiendas/etiquetas disponibles."""
        cleaned: list[dict[str, str]] = []
        taken: set[str] = set()
        for store in stores:
            name = _clean_name(store.get("name", ""))
            if not name:
                continue
            store_id = self._unique_id(store.get("id") or _slug(name), taken)
            taken.add(store_id)
            cleaned.append(
                {"id": store_id, "name": name, "icon": (store.get("icon") or DEFAULT_STORE_ICON).strip()}
            )
        self.data["stores"] = cleaned
        for collection in (self.items, self.recent, self.products.values()):
            for entry in collection:
                entry["stores"] = [s for s in entry.get("stores", []) if s in taken]
        self._changed()

    # ---------------------------------------------------------------- consultas
    def sorted_items(self, store: str | None = None) -> list[dict[str, Any]]:
        """Lista ordenada por recorrido del súper. Con tienda: las de esa tienda
        y las que no tienen tienda asignada (se pueden comprar en cualquiera)."""
        order = {dept_id: n for n, dept_id in enumerate(self.department_ids())}
        items = [
            i for i in self.items if store is None or not i["stores"] or store in i["stores"]
        ]
        return sorted(items, key=lambda i: (order.get(i["department"], 999), normalize(i["name"])))
