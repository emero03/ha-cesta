"""Servicios de Cesta para automatizaciones y scripts."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.exceptions import ServiceValidationError
import homeassistant.helpers.config_validation as cv

from .const import (
    ATTR_DEPARTMENT,
    ATTR_ICON,
    ATTR_NAME,
    ATTR_NOTE,
    ATTR_STORE,
    ATTR_STORES,
    DOMAIN,
    SERVICE_ADD_ITEM,
    SERVICE_COMPLETE_ITEM,
    SERVICE_GET_ITEMS,
)
from .manager import CestaError, CestaManager

ADD_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_NAME): cv.string,
        vol.Optional(ATTR_NOTE): cv.string,
        vol.Optional(ATTR_STORES): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(ATTR_DEPARTMENT): cv.string,
        vol.Optional(ATTR_ICON): cv.string,
    }
)
COMPLETE_ITEM_SCHEMA = vol.Schema({vol.Required(ATTR_NAME): cv.string})
GET_ITEMS_SCHEMA = vol.Schema({vol.Optional(ATTR_STORE): cv.string})


def _manager(hass: HomeAssistant) -> CestaManager:
    manager: CestaManager | None = hass.data.get(DOMAIN)
    if manager is None:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
    return manager


@callback
def async_register_services(hass: HomeAssistant) -> None:
    """Registra los servicios cesta.*"""

    @callback
    def add_item(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        try:
            item = manager.add_item(
                call.data[ATTR_NAME],
                icon=call.data.get(ATTR_ICON),
                department=call.data.get(ATTR_DEPARTMENT),
                stores=call.data.get(ATTR_STORES),
                note=call.data.get(ATTR_NOTE),
                create_stores=True,
            )
        except CestaError as err:
            raise ServiceValidationError(str(err)) from err
        return _public_item(manager, item) if call.return_response else None

    @callback
    def complete_item(call: ServiceCall) -> None:
        manager = _manager(hass)
        item = manager.find_by_name(call.data[ATTR_NAME])
        if item is None:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="item_not_found",
                translation_placeholders={"name": call.data[ATTR_NAME]},
            )
        manager.purchase_item(item["id"])

    @callback
    def get_items(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        store_id = None
        if store := call.data.get(ATTR_STORE):
            store_id = manager.resolve_store(store)
            if store_id is None:
                raise ServiceValidationError(
                    translation_domain=DOMAIN,
                    translation_key="store_not_found",
                    translation_placeholders={"store": store},
                )
        items = [_public_item(manager, i) for i in manager.sorted_items(store_id)]
        lines = [
            f"{i['icon']} {i['name']}" + (f" ({i['note']})" if i["note"] else "") for i in items
        ]
        return {"count": len(items), "items": items, "text": "\n".join(lines)}

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD_ITEM,
        add_item,
        schema=ADD_ITEM_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_COMPLETE_ITEM, complete_item, schema=COMPLETE_ITEM_SCHEMA
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_GET_ITEMS,
        get_items,
        schema=GET_ITEMS_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )


def _public_item(manager: CestaManager, item: dict[str, Any]) -> dict[str, Any]:
    """Elemento con los nombres legibles de departamento y tiendas."""
    depts = {d["id"]: d["name"] for d in manager.data["departments"]}
    stores = {s["id"]: s["name"] for s in manager.data["stores"]}
    return {
        "name": item["name"],
        "icon": item["icon"],
        "note": item["note"],
        "department": depts.get(item["department"], item["department"]),
        "stores": [stores[s] for s in item["stores"] if s in stores],
    }
