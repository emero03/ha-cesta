"""Tests de la integración Cesta."""

from __future__ import annotations

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
import pytest

from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.components.todo import DOMAIN as TODO_DOMAIN
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.cesta.catalog import CATALOG, guess_product, normalize
from custom_components.cesta.const import DOMAIN, STORAGE_KEY

ENTITY_ID = "todo.cesta"


def _manager(hass: HomeAssistant):
    return hass.data[DOMAIN]


# --------------------------------------------------------------- catálogo
def test_catalog_is_consistent() -> None:
    from custom_components.cesta.const import DEFAULT_DEPARTMENTS

    dept_ids = {d["id"] for d in DEFAULT_DEPARTMENTS}
    keys = [normalize(e["name"]) for e in CATALOG]
    assert len(keys) == len(set(keys)), "nombres duplicados en el catálogo"
    assert all(e["department"] in dept_ids for e in CATALOG)
    assert len(CATALOG) > 200


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("leche", "Leche"),
        ("LECHE", "Leche"),
        ("tomate", "Tomates"),
        ("platano", "Plátanos"),
        ("queso manchego", "Queso"),
        ("pechuga de pavo", "Pavo"),
        ("limón", "Limones"),
        ("champu anticaspa", "Champú"),
        ("xyz", None),
    ],
)
def test_guess_product(text: str, expected: str | None) -> None:
    result = guess_product(text)
    assert (result["name"] if result else None) == expected


# ------------------------------------------------------------ config flow
async def test_config_flow(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Cesta"
    await hass.async_block_till_done()

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


# ------------------------------------------------------ carga y descarga
async def test_setup_registers_panel_card_and_entity(
    hass: HomeAssistant, setup_cesta: MockConfigEntry
) -> None:
    panels = hass.data[frontend.DATA_PANELS]
    assert "cesta" in panels
    panel = panels["cesta"]
    assert panel.sidebar_title == "Cesta"
    module_url = panel.config["_panel_custom"]["module_url"]
    assert module_url.startswith("/cesta_static/cesta.js?v=")
    assert module_url in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls

    state = hass.states.get(ENTITY_ID)
    assert state is not None
    assert state.state == "0"

    assert await hass.config_entries.async_unload(setup_cesta.entry_id)
    await hass.async_block_till_done()
    assert setup_cesta.state is ConfigEntryState.NOT_LOADED
    assert "cesta" not in hass.data[frontend.DATA_PANELS]
    assert module_url not in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls

    # Recargar no debe fallar (rutas estáticas ya registradas, etc.)
    assert await hass.config_entries.async_setup(setup_cesta.entry_id)
    await hass.async_block_till_done()
    assert "cesta" in hass.data[frontend.DATA_PANELS]


async def test_static_file_is_served(
    hass: HomeAssistant, setup_cesta: MockConfigEntry, hass_client
) -> None:
    client = await hass_client()
    resp = await client.get("/cesta_static/cesta.js")
    assert resp.status == 200
    body = await resp.text()
    assert "cesta-panel" in body
    assert "cesta-card" in body


# ------------------------------------------------------------- websocket
async def test_websocket_full_flow(
    hass: HomeAssistant, setup_cesta: MockConfigEntry, hass_ws_client
) -> None:
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "cesta/catalog"})
    msg = await client.receive_json()
    assert msg["success"]
    assert any(e["name"] == "Leche" for e in msg["result"]["catalog"])
    assert "Leche" in msg["result"]["staples"]

    await client.send_json_auto_id({"type": "cesta/subscribe"})
    msg = await client.receive_json()
    assert msg["success"]
    event = await client.receive_json()
    state = event["event"]
    assert state["items"] == []
    assert len(state["departments"]) == 14
    assert [s["id"] for s in state["stores"]] == ["supermercado", "mercado", "farmacia"]

    # Añadir: icono y departamento deducidos del catálogo
    await client.send_json_auto_id({"type": "cesta/item/add", "name": "leche", "note": "2 L"})
    event = await client.receive_json()  # el evento de la suscripción llega antes
    msg = await client.receive_json()
    assert msg["success"]
    leche = msg["result"]
    assert (leche["name"], leche["icon"], leche["department"], leche["note"]) == (
        "Leche",
        "🥛",
        "lacteos",
        "2 L",
    )
    assert event["event"]["items"][0]["id"] == leche["id"]

    # Añadir el mismo producto no lo duplica (ni genera evento: no cambia nada)
    await client.send_json_auto_id({"type": "cesta/item/add", "name": "LECHE"})
    msg = await client.receive_json()
    assert msg["type"] == "result"
    assert msg["result"]["id"] == leche["id"]
    assert len(_manager(hass).items) == 1

    # Producto desconocido → Otros
    await client.send_json_auto_id(
        {"type": "cesta/item/add", "name": "tornillos", "stores": ["mercado"]}
    )
    await client.receive_json()
    msg = await client.receive_json()
    tornillos = msg["result"]
    assert (tornillos["name"], tornillos["department"], tornillos["stores"]) == (
        "Tornillos",
        "otros",
        ["mercado"],
    )

    # Editar: cambia icono, departamento y tiendas, y se recuerda
    await client.send_json_auto_id(
        {
            "type": "cesta/item/update",
            "item_id": tornillos["id"],
            "icon": "🔩",
            "department": "Limpieza y hogar",
            "stores": ["Supermercado"],
        }
    )
    await client.receive_json()
    msg = await client.receive_json()
    assert msg["result"]["department"] == "limpieza"
    assert msg["result"]["stores"] == ["supermercado"]
    assert _manager(hass).products["tornillos"]["icon"] == "🔩"

    # Comprar → sale de la lista y entra en recientes
    await client.send_json_auto_id({"type": "cesta/item/purchase", "item_id": leche["id"]})
    event = await client.receive_json()
    msg = await client.receive_json()
    assert msg["success"]
    assert [i["name"] for i in event["event"]["items"]] == ["Tornillos"]
    assert event["event"]["recent"][0]["name"] == "Leche"
    assert event["event"]["recent"][0]["kind"] == "purchased"
    assert len(_manager(hass).products["leche"]["purchases"]) == 1

    # Deshacer → vuelve y no cuenta como compra
    await client.send_json_auto_id(
        {"type": "cesta/recent/restore", "item_id": leche["id"], "undo": True}
    )
    event = await client.receive_json()
    msg = await client.receive_json()
    assert msg["success"]
    assert {i["name"] for i in event["event"]["items"]} == {"Leche", "Tornillos"}
    assert event["event"]["recent"] == []
    assert _manager(hass).products["leche"]["purchases"] == []

    # Quitar (sin comprar) → recientes como "removed"
    await client.send_json_auto_id({"type": "cesta/item/remove", "item_id": tornillos["id"]})
    event = await client.receive_json()
    await client.receive_json()
    assert event["event"]["recent"][0]["kind"] == "removed"
    assert _manager(hass).products["tornillos"]["purchases"] == []

    # Volver a añadir desde recientes recuerda icono y tienda
    await client.send_json_auto_id({"type": "cesta/item/add", "name": "tornillos"})
    await client.receive_json()
    msg = await client.receive_json()
    assert msg["result"]["icon"] == "🔩"
    assert msg["result"]["stores"] == ["supermercado"]

    # Ocultar sugerencia
    await client.send_json_auto_id({"type": "cesta/product/hide", "name": "Pan"})
    await client.receive_json()
    msg = await client.receive_json()
    assert msg["success"]
    assert _manager(hass).products["pan"]["hidden"] is True

    # Vaciar recientes
    await client.send_json_auto_id({"type": "cesta/recent/clear"})
    event = await client.receive_json()
    await client.receive_json()
    assert event["event"]["recent"] == []

    # Errores
    await client.send_json_auto_id({"type": "cesta/item/purchase", "item_id": "nope"})
    msg = await client.receive_json()
    assert not msg["success"]
    assert msg["error"]["code"] == "not_found"

    await client.send_json_auto_id({"type": "cesta/item/add", "name": "   "})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "invalid_name"


async def test_departments_and_stores(
    hass: HomeAssistant, setup_cesta: MockConfigEntry, hass_ws_client
) -> None:
    manager = _manager(hass)
    huevos = manager.add_item("Huevos", stores=["mercado", "supermercado"])

    client = await hass_ws_client(hass)
    depts = [d for d in manager.data["departments"] if d["id"] != "lacteos"]
    depts.reverse()
    depts.append({"name": "Bebé", "icon": "🍼", "color": "#F48FB1"})
    await client.send_json_auto_id({"type": "cesta/departments/set", "departments": depts})
    assert (await client.receive_json())["success"]
    assert manager.department_ids()[0] == "otros"
    assert manager.department_ids()[-1] == "bebe"
    assert huevos["department"] == "otros"  # su departamento ya no existe

    await client.send_json_auto_id(
        {
            "type": "cesta/stores/set",
            "stores": [{"id": "mercado", "name": "Mercado"}, {"name": "Lidl", "icon": "🟡"}],
        }
    )
    assert (await client.receive_json())["success"]
    assert [s["id"] for s in manager.data["stores"]] == ["mercado", "lidl"]
    assert huevos["stores"] == ["mercado"]

    await client.send_json_auto_id({"type": "cesta/departments/set", "departments": []})
    msg = await client.receive_json()
    assert msg["error"]["code"] == "invalid"


# ---------------------------------------------------------------- todo
async def test_todo_entity(hass: HomeAssistant, setup_cesta: MockConfigEntry) -> None:
    manager = _manager(hass)

    await hass.services.async_call(
        TODO_DOMAIN, "add_item", {"item": "Plátanos", "description": "maduros"},
        target={"entity_id": ENTITY_ID}, blocking=True,
    )
    assert hass.states.get(ENTITY_ID).state == "1"
    item = manager.items[0]
    assert (item["icon"], item["department"], item["note"]) == ("🍌", "fruta_verdura", "maduros")

    result = await hass.services.async_call(
        TODO_DOMAIN, "get_items", {}, target={"entity_id": ENTITY_ID},
        blocking=True, return_response=True,
    )
    items = result[ENTITY_ID]["items"]
    assert items[0]["summary"] == "Plátanos"
    assert items[0]["description"] == "maduros"

    # Completar (como haría Assist: «marca plátanos como completado»)
    await hass.services.async_call(
        TODO_DOMAIN, "update_item", {"item": "Plátanos", "status": "completed"},
        target={"entity_id": ENTITY_ID}, blocking=True,
    )
    assert hass.states.get(ENTITY_ID).state == "0"
    assert manager.recent[0]["name"] == "Plátanos"
    assert manager.recent[0]["note"] == "maduros"
    assert len(manager.products["platanos"]["purchases"]) == 1

    # Desmarcar en la tarjeta de tareas → vuelve a la lista
    await hass.services.async_call(
        TODO_DOMAIN, "update_item", {"item": "Plátanos", "status": "needs_action"},
        target={"entity_id": ENTITY_ID}, blocking=True,
    )
    assert hass.states.get(ENTITY_ID).state == "1"
    assert manager.recent == []

    # Renombrar
    await hass.services.async_call(
        TODO_DOMAIN, "update_item", {"item": "Plátanos", "rename": "Plátanos de Canarias"},
        target={"entity_id": ENTITY_ID}, blocking=True,
    )
    assert manager.items[0]["name"] == "Plátanos de Canarias"
    assert manager.items[0]["note"] == "maduros"

    # Borrar → queda en recientes por si fue sin querer
    await hass.services.async_call(
        TODO_DOMAIN, "remove_item", {"item": "Plátanos de Canarias"},
        target={"entity_id": ENTITY_ID}, blocking=True,
    )
    assert manager.items == []
    assert manager.recent[0]["kind"] == "removed"

    # Borrar los completados → vacía recientes
    await hass.services.async_call(
        TODO_DOMAIN, "remove_completed_items", {}, target={"entity_id": ENTITY_ID}, blocking=True
    )
    assert manager.recent == []


# ------------------------------------------------------------ servicios
async def test_services(hass: HomeAssistant, setup_cesta: MockConfigEntry) -> None:
    manager = _manager(hass)

    response = await hass.services.async_call(
        DOMAIN, "add_item", {"name": "pan", "stores": ["Lidl"], "note": "2 barras"},
        blocking=True, return_response=True,
    )
    assert response == {
        "name": "Pan", "icon": "🍞", "note": "2 barras",
        "department": "Panadería", "stores": ["Lidl"],
    }
    assert any(s["name"] == "Lidl" for s in manager.data["stores"])

    await hass.services.async_call(
        DOMAIN, "add_item", {"name": "Huevos", "stores": "Mercado"}, blocking=True
    )
    await hass.services.async_call(DOMAIN, "add_item", {"name": "Sal"}, blocking=True)

    # Singular/plural sin tildes → mismo producto del catálogo
    await hass.services.async_call(DOMAIN, "add_item", {"name": "platano"}, blocking=True)
    assert manager.items[-1]["name"] == "Plátanos"
    await hass.services.async_call(DOMAIN, "add_item", {"name": "Plátano"}, blocking=True)
    assert [i["name"] for i in manager.items].count("Plátanos") == 1
    await hass.services.async_call(DOMAIN, "complete_item", {"name": "plátanos"}, blocking=True)

    result = await hass.services.async_call(
        DOMAIN, "get_items", {}, blocking=True, return_response=True
    )
    # Ordenado por recorrido del súper: panadería, lácteos, despensa
    assert [i["name"] for i in result["items"]] == ["Pan", "Huevos", "Sal"]
    assert result["count"] == 3
    assert result["text"].splitlines()[0] == "🍞 Pan (2 barras)"

    result = await hass.services.async_call(
        DOMAIN, "get_items", {"store": "lidl"}, blocking=True, return_response=True
    )
    # Lo de Lidl y lo que no tiene tienda
    assert [i["name"] for i in result["items"]] == ["Pan", "Sal"]

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "get_items", {"store": "Inventada"}, blocking=True, return_response=True
        )

    await hass.services.async_call(DOMAIN, "complete_item", {"name": "pan"}, blocking=True)
    assert [i["name"] for i in manager.items] == ["Huevos", "Sal"]

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "complete_item", {"name": "pan"}, blocking=True)


# ---------------------------------------------------------- persistencia
async def test_persistence(
    hass: HomeAssistant, hass_storage, freezer: FrozenDateTimeFactory
) -> None:
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {
            "items": [
                {
                    "id": "abc", "name": "Café", "icon": "☕", "department": "desayuno",
                    "stores": [], "note": "", "added_at": 1,
                }
            ],
            "recent": [],
            "products": {},
            "stores": [],
        },
    }
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    manager = _manager(hass)
    assert manager.items[0]["name"] == "Café"
    assert manager.data["stores"] == []  # una lista vacía guardada se respeta
    assert len(manager.data["departments"]) == 14  # se rellenan los que faltan

    manager.purchase_item("abc")
    freezer.tick(timedelta(seconds=5))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    saved = hass_storage[STORAGE_KEY]["data"]
    assert saved["items"] == []
    assert saved["recent"][0]["name"] == "Café"
    assert len(saved["products"]["cafe"]["purchases"]) == 1

    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert STORAGE_KEY not in hass_storage
