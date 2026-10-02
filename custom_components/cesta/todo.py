"""Entidad de lista de tareas: hace que Cesta funcione con Assist (voz),
la tarjeta de tareas de Home Assistant y las acciones todo.*"""

from __future__ import annotations

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .catalog import normalize
from .const import DOMAIN, NAME, VERSION
from .manager import CestaManager


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Crea la entidad todo.cesta."""
    async_add_entities([CestaTodoList(hass.data[DOMAIN], entry)])


class CestaTodoList(TodoListEntity):
    """La lista de Cesta vista como lista de tareas.

    Pendiente = en la lista. Completado = comprado recientemente.
    """

    _attr_has_entity_name = True
    _attr_name = None
    _attr_icon = "mdi:basket-outline"
    _attr_should_poll = False
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
    )

    def __init__(self, manager: CestaManager, entry: ConfigEntry) -> None:
        self._manager = manager
        self._attr_unique_id = f"{entry.entry_id}_list"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=NAME,
            manufacturer=NAME,
            model="Lista de la compra",
            sw_version=VERSION,
            entry_type=DeviceEntryType.SERVICE,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._manager.async_add_listener(self._handle_change))

    @callback
    def _handle_change(self) -> None:
        self.async_write_ha_state()

    @property
    def todo_items(self) -> list[TodoItem]:
        pending = [
            TodoItem(
                uid=item["id"],
                summary=item["name"],
                status=TodoItemStatus.NEEDS_ACTION,
                description=item["note"] or None,
            )
            for item in self._manager.sorted_items()
        ]
        in_list = {normalize(item["name"]) for item in self._manager.items}
        done = [
            TodoItem(
                uid=entry["id"],
                summary=entry["name"],
                status=TodoItemStatus.COMPLETED,
                description=entry.get("note") or None,
            )
            for entry in self._manager.recent
            if normalize(entry["name"]) not in in_list
        ]
        return pending + done

    async def async_create_todo_item(self, item: TodoItem) -> None:
        self._manager.add_item(item.summary or "", note=item.description)

    async def async_update_todo_item(self, item: TodoItem) -> None:
        manager = self._manager
        uid = item.uid or ""
        in_list = any(i["id"] == uid for i in manager.items)

        if not in_list and item.status == TodoItemStatus.NEEDS_ACTION:
            # Desmarcado en la tarjeta de tareas: vuelve a la lista.
            uid = manager.restore_recent(uid)["id"]
            in_list = True

        # Home Assistant envía siempre el elemento completo (con los cambios aplicados).
        changes = {"note": item.description or ""}
        if item.summary:
            changes["name"] = item.summary
        manager.update_item(uid, **changes)

        if in_list and item.status == TodoItemStatus.COMPLETED:
            manager.purchase_item(uid)

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        manager = self._manager
        for uid in uids:
            if any(i["id"] == uid for i in manager.items):
                manager.remove_item(uid)  # queda en recientes por si fue sin querer
            elif any(r["id"] == uid for r in manager.recent):
                manager.delete_recent(uid)
