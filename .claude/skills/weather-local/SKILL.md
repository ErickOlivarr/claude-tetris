---
name: weather-local
description: >
  Consulta clima actual y pronóstico del día para cualquier ciudad usando la API pública
  Open-Meteo (sin API key, sin costo). Corre localmente vía Node.js — no depende de WebSearch.
  Usar cuando el usuario pida clima/temperatura/pronóstico de una ciudad, o invoque /weather-local.
---

Consulta clima localmente ejecutando el script Node incluido, sin depender de WebSearch.

## Uso

```bash
node .claude/skills/weather-local/scripts/weather.js "<Ciudad, Estado, País>"
```

Si no se pasa ciudad, usa por defecto `Acapulco, Guerrero, Mexico`.

Ejemplos:

```bash
node .claude/skills/weather-local/scripts/weather.js "Acapulco, Guerrero, MX"
node .claude/skills/weather-local/scripts/weather.js "Ciudad de Mexico"
node .claude/skills/weather-local/scripts/weather.js "Madrid, Spain"
```

Invocación como slash command con otra ciudad:

```
/weather-local Guadalajara, Jalisco, MX
```

## Cómo funciona

1. Geocodifica el nombre de ciudad con la API de Open-Meteo (`geocoding-api.open-meteo.com`) → lat/lon.
2. Pide clima actual + pronóstico del día con esa lat/lon a `api.open-meteo.com/v1/forecast`.
3. Imprime en consola: condición (traducida de código WMO), temperatura, sensación térmica, humedad, precipitación, viento, y máx/mín del día.

Ambas APIs son gratuitas, no requieren API key ni registro.

## Requisitos

- Node.js ≥ 18 (usa `fetch` nativo, sin dependencias npm).

## Notas

- Si la ciudad no se encuentra, el script sale con error y mensaje claro — probar con nombre más específico (agregar estado/país).
- Los datos vienen directo de Open-Meteo, no de WebSearch, así que es más rápido y no consume la herramienta de búsqueda.
