"""Constantes de la integración Cesta."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "cesta"
NAME: Final = "Cesta"
VERSION: Final = "1.0.0"

STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1
SAVE_DELAY: Final = 1

# Panel lateral y ficheros estáticos
PANEL_URL_PATH: Final = "cesta"
PANEL_ICON: Final = "mdi:basket-outline"
PANEL_COMPONENT: Final = "cesta-panel"
STATIC_URL: Final = "/cesta_static"
FRONTEND_FILE: Final = "cesta.js"

# Límites
MAX_RECENT: Final = 40  # elementos en "Comprado recientemente"
MAX_HISTORY: Final = 12  # compras recordadas por producto (para sugerencias)

DEFAULT_ICON: Final = "🛒"
DEFAULT_STORE_ICON: Final = "🏪"
FALLBACK_DEPARTMENT: Final = "otros"

# Orden por defecto: el recorrido típico de un supermercado en España.
DEFAULT_DEPARTMENTS: Final[list[dict[str, str]]] = [
    {"id": "fruta_verdura", "name": "Frutas y verduras", "icon": "🥦", "color": "#43A047"},
    {"id": "panaderia", "name": "Panadería", "icon": "🥖", "color": "#C9922E"},
    {"id": "carne", "name": "Carnicería", "icon": "🥩", "color": "#E53935"},
    {"id": "pescado", "name": "Pescadería", "icon": "🐟", "color": "#1E88E5"},
    {"id": "charcuteria", "name": "Charcutería y quesos", "icon": "🧀", "color": "#FB8C00"},
    {"id": "lacteos", "name": "Lácteos y huevos", "icon": "🥛", "color": "#F9C02D"},
    {"id": "despensa", "name": "Despensa", "icon": "🥫", "color": "#9E9D24"},
    {"id": "desayuno", "name": "Desayuno y dulces", "icon": "🍪", "color": "#EC407A"},
    {"id": "congelados", "name": "Congelados", "icon": "🧊", "color": "#00ACC1"},
    {"id": "bebidas", "name": "Bebidas", "icon": "🥤", "color": "#8E24AA"},
    {"id": "limpieza", "name": "Limpieza y hogar", "icon": "🧽", "color": "#3949AB"},
    {"id": "higiene", "name": "Higiene y salud", "icon": "🧴", "color": "#00897B"},
    {"id": "mascotas", "name": "Mascotas", "icon": "🐾", "color": "#6D4C41"},
    {"id": "otros", "name": "Otros", "icon": "🛒", "color": "#78909C"},
]

DEFAULT_STORES: Final[list[dict[str, str]]] = [
    {"id": "supermercado", "name": "Supermercado", "icon": "🛒"},
    {"id": "mercado", "name": "Mercado", "icon": "🧺"},
    {"id": "farmacia", "name": "Farmacia", "icon": "💊"},
]

# Servicios
SERVICE_ADD_ITEM: Final = "add_item"
SERVICE_COMPLETE_ITEM: Final = "complete_item"
SERVICE_GET_ITEMS: Final = "get_items"

ATTR_NAME: Final = "name"
ATTR_NOTE: Final = "note"
ATTR_STORES: Final = "stores"
ATTR_STORE: Final = "store"
ATTR_DEPARTMENT: Final = "department"
ATTR_ICON: Final = "icon"
