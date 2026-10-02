"""API websocket de Cesta (la usan el panel y la tarjeta)."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .catalog import CATALOG, STAPLES
from .const import DOMAIN
from .manager import CestaError, CestaManager

_STORES = vol.All([str], vol.Length(max=20))


def _manager(hass: HomeAssistant) -> CestaManager | None:
    return hass.data.get(DOMAIN)


def _with_manager(
    func: Callable[[HomeAssistant, websocket_api.ActiveConnection, dict[str, Any], CestaManager], None],
) -> Callable[[HomeAssistant, websocket_api.ActiveConnection, dict[str, Any]], None]:
    """Inyecta el gestor y convierte los errores en respuestas websocket."""

    @wraps(func)
    def wrapper(
        hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
    ) -> None:
        manager = _manager(hass)
        if manager is None:
            connection.send_error(msg["id"], "not_loaded", "Cesta no está configurada")
            return
        try:
            func(hass, connection, msg, manager)
        except CestaError as err:
            connection.send_error(msg["id"], err.code, str(err))

    return wrapper


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Registra los comandos (una sola vez por arranque)."""
    for command in (
        ws_subscribe,
        ws_catalog,
        ws_add,
        ws_update,
        ws_purchase,
        ws_remove,
        ws_restore,
        ws_recent_delete,
        ws_recent_clear,
        ws_product_hide,
        ws_departments_set,
        ws_stores_set,
    ):
        websocket_api.async_register_command(hass, command)


@websocket_api.websocket_command({vol.Required("type"): "cesta/subscribe"})
@callback
@_with_manager
def ws_subscribe(hass, connection, msg, manager: CestaManager) -> None:
    """Envía el estado completo ahora y cada vez que cambie."""
    msg_id = msg["id"]

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg_id, manager.snapshot()))

    connection.subscriptions[msg_id] = manager.async_add_listener(forward)
    connection.send_result(msg_id)
    forward()


@websocket_api.websocket_command({vol.Required("type"): "cesta/catalog"})
@callback
def ws_catalog(hass, connection, msg) -> None:
    connection.send_result(msg["id"], {"catalog": CATALOG, "staples": STAPLES})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/item/add",
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=120)),
        vol.Optional("icon"): vol.All(str, vol.Length(max=16)),
        vol.Optional("department"): str,
        vol.Optional("stores"): _STORES,
        vol.Optional("note"): vol.All(str, vol.Length(max=200)),
    }
)
@callback
@_with_manager
def ws_add(hass, connection, msg, manager: CestaManager) -> None:
    item = manager.add_item(
        msg["name"],
        icon=msg.get("icon"),
        department=msg.get("department"),
        stores=msg.get("stores"),
        note=msg.get("note"),
    )
    connection.send_result(msg["id"], item)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/item/update",
        vol.Required("item_id"): str,
        vol.Optional("name"): vol.All(str, vol.Length(min=1, max=120)),
        vol.Optional("icon"): vol.All(str, vol.Length(max=16)),
        vol.Optional("department"): str,
        vol.Optional("stores"): _STORES,
        vol.Optional("note"): vol.All(str, vol.Length(max=200)),
    }
)
@callback
@_with_manager
def ws_update(hass, connection, msg, manager: CestaManager) -> None:
    changes = {k: msg[k] for k in ("name", "icon", "department", "stores", "note") if k in msg}
    connection.send_result(msg["id"], manager.update_item(msg["item_id"], **changes))


@websocket_api.websocket_command(
    {vol.Required("type"): "cesta/item/purchase", vol.Required("item_id"): str}
)
@callback
@_with_manager
def ws_purchase(hass, connection, msg, manager: CestaManager) -> None:
    connection.send_result(msg["id"], manager.purchase_item(msg["item_id"]))


@websocket_api.websocket_command(
    {vol.Required("type"): "cesta/item/remove", vol.Required("item_id"): str}
)
@callback
@_with_manager
def ws_remove(hass, connection, msg, manager: CestaManager) -> None:
    connection.send_result(msg["id"], manager.remove_item(msg["item_id"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/recent/restore",
        vol.Required("item_id"): str,
        vol.Optional("undo", default=False): bool,
    }
)
@callback
@_with_manager
def ws_restore(hass, connection, msg, manager: CestaManager) -> None:
    connection.send_result(msg["id"], manager.restore_recent(msg["item_id"], undo=msg["undo"]))


@websocket_api.websocket_command(
    {vol.Required("type"): "cesta/recent/delete", vol.Required("item_id"): str}
)
@callback
@_with_manager
def ws_recent_delete(hass, connection, msg, manager: CestaManager) -> None:
    manager.delete_recent(msg["item_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "cesta/recent/clear"})
@callback
@_with_manager
def ws_recent_clear(hass, connection, msg, manager: CestaManager) -> None:
    manager.clear_recent()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/product/hide",
        vol.Required("name"): str,
        vol.Optional("hidden", default=True): bool,
    }
)
@callback
@_with_manager
def ws_product_hide(hass, connection, msg, manager: CestaManager) -> None:
    manager.set_product_hidden(msg["name"], msg["hidden"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/departments/set",
        vol.Required("departments"): [
            vol.Schema(
                {
                    vol.Optional("id"): str,
                    vol.Required("name"): str,
                    vol.Optional("icon"): str,
                    vol.Optional("color"): str,
                }
            )
        ],
    }
)
@callback
@_with_manager
def ws_departments_set(hass, connection, msg, manager: CestaManager) -> None:
    manager.set_departments(msg["departments"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "cesta/stores/set",
        vol.Required("stores"): [
            vol.Schema({vol.Optional("id"): str, vol.Required("name"): str, vol.Optional("icon"): str})
        ],
    }
)
@callback
@_with_manager
def ws_stores_set(hass, connection, msg, manager: CestaManager) -> None:
    manager.set_stores(msg["stores"])
    connection.send_result(msg["id"])
