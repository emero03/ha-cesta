# Cesta

Lista de la compra visual para Home Assistant, al estilo de Bring!: cada producto es una ficha con icono y nombre, coloreada según el departamento del supermercado donde está.

- **Lista por departamentos** en el orden en que recorres el súper (frutas, panadería, carnicería…), cada uno con su color.
- **Tiendas**: etiqueta cada producto con dónde lo compras (Supermercado, Mercado, Farmacia… o las tuyas) y filtra la lista por tienda.
- **Sugerencias** basadas en tu historial: si compras agua cada 7 días, a los 7 días te la sugiere ("Cada 7 días"); también lo que compras a menudo y, al principio, productos básicos.
- **Comprado recientemente**: todo lo que quitas de la lista (comprado o borrado sin querer) queda ahí y vuelve con un toque.
- **Deshacer** justo después de marcar algo como comprado.
- **Catálogo de más de 300 productos** en español con icono y departamento; lo que escribas se reconoce aunque esté en singular o sin tildes ("platano" → Plátanos 🍌).
- **Recuerda tus cambios**: si a la leche le pones otro icono o la etiquetas en "Mercado", la próxima vez vuelve igual.
- **Sincronizada al instante** entre todos los móviles, tablets y ordenadores de casa.
- **Panel en la barra lateral**, **tarjeta para paneles de control**, **entidad `todo.cesta`** (funciona con Assist por voz) y **acciones** para automatizaciones.

Todo se guarda en local, en tu Home Assistant. No usa servicios externos.

## Instalación

### Con HACS (recomendado)

1. Sube esta carpeta a un repositorio de GitHub.
2. En HACS → menú ⋮ → **Repositorios personalizados**, añade la URL del repositorio con el tipo **Integración**.
3. Busca **Cesta** en HACS, instálala y reinicia Home Assistant.
4. Ve a **Ajustes → Dispositivos y servicios → Añadir integración** y busca **Cesta**.

### Manual

1. Copia la carpeta `custom_components/cesta` dentro de la carpeta `config/custom_components/` de tu Home Assistant (créala si no existe).
2. Reinicia Home Assistant.
3. **Ajustes → Dispositivos y servicios → Añadir integración → Cesta**.

Al añadirla aparece **Cesta** en la barra lateral. Requiere Home Assistant 2025.1 o posterior (probada en 2026.2).

## Uso

| Gesto | Qué hace |
| --- | --- |
| Escribir en "Añadir a la lista…" | Busca en el catálogo y en tus productos. **Intro** añade lo escrito. |
| Escribir varios separados por comas | `leche, pan, huevos` + Intro añade los tres. |
| Tocar un producto de la lista | Lo marca como comprado y pasa a "Comprado recientemente" (con **Deshacer**). |
| Mantener pulsado o clic derecho | Edita: icono, nombre, detalle (cantidad, marca…), departamento y tiendas. |
| Tocar una sugerencia o algo de "Comprado recientemente" | Lo vuelve a añadir. |
| Mantener pulsada una sugerencia | Opción **No sugerir más**. |
| Chips de tienda | Filtran la lista. Los productos sin tienda salen en todas. |
| ⚙️ Ajustes | Ordena los departamentos según tu recorrido, cambia colores, iconos y nombres, y gestiona las tiendas. |

Con un filtro de tienda activo, lo que añades queda etiquetado en esa tienda (si no tenía ya una).

## Tarjeta para paneles de control

Edita un panel → **Añadir tarjeta** → **Cesta**, o en YAML:

```yaml
type: custom:cesta-card
title: Compra            # opcional
store: supermercado      # opcional: filtro inicial (id de la tienda: nombre en minúsculas, sin tildes)
show_suggestions: true   # opcional
show_recent: true        # opcional
```

Si la tarjeta no aparece justo después de instalar, recarga la página del navegador.

## Voz (Assist)

Cesta crea la lista de tareas `todo.cesta`, así que Assist puede usarla. Por ejemplo: *«Añade leche a la lista Cesta»*. Los productos añadidos por voz reciben su icono y departamento automáticamente. Si prefieres decir «lista de la compra», cambia el nombre de la entidad (y no tengas a la vez la lista de la compra integrada de Home Assistant con ese nombre).

La entidad también aparece en **Listas de tareas** de Home Assistant: lo pendiente es tu lista y lo completado es "Comprado recientemente".

## Automatizaciones

Acciones disponibles:

- `cesta.add_item`: `name` (obligatorio), `note`, `stores` (lista; las tiendas nuevas se crean), `department`, `icon`.
- `cesta.complete_item`: `name`. Lo marca como comprado.
- `cesta.get_items`: `store` (opcional). Devuelve `count`, `items` y `text` (lista lista para enviar).

Enviarte la lista al llegar al supermercado:

```yaml
alias: Cesta al llegar al súper
triggers:
  - trigger: zone
    entity_id: person.miriam
    zone: zone.supermercado
    event: enter
actions:
  - action: cesta.get_items
    data:
      store: Supermercado
    response_variable: cesta
  - if: "{{ cesta.count > 0 }}"
    then:
      - action: notify.mobile_app_mi_movil
        data:
          title: "🛒 {{ cesta.count }} productos"
          message: "{{ cesta.text }}"
```

Añadir café al pulsar un botón o leer una etiqueta NFC junto a la cafetera:

```yaml
action: cesta.add_item
data:
  name: Café
  stores: [Supermercado]
```

## Datos

Se guardan en `config/.storage/cesta` y se incluyen en las copias de seguridad de Home Assistant. Si eliminas la integración, se borran.

## Desarrollo

```bash
pip install pytest-homeassistant-custom-component
pytest                       # tests del backend
python3 tools/build_preview.py   # regenera preview/cesta-preview.html
```

`preview/cesta-preview.html` es una demo que funciona sin Home Assistant: usa el mismo `cesta.js` de la integración con un backend simulado (`preview/mock-backend.js`).

Estructura:

```
custom_components/cesta/
  __init__.py        carga, panel lateral, tarjeta y ficheros estáticos
  manager.py         lista, recientes, memoria de productos, departamentos y tiendas
  catalog.py         catálogo de productos (icono + departamento) y reconocimiento de nombres
  websocket.py       API que usa el panel (cesta/*)
  services.py        acciones cesta.add_item, complete_item, get_items
  todo.py            entidad todo.cesta (Assist y tarjeta de tareas)
  config_flow.py     alta desde Dispositivos y servicios
  frontend/cesta.js  panel <cesta-panel> y tarjeta <cesta-card>, sin dependencias
```
