#!/usr/bin/env node
'use strict';

// Simple local weather lookup using Open-Meteo (no API key required).
// Usage: node weather.js "City, State, Country"
// Default city: Acapulco, Guerrero, MX

const WMO_CODES = {
  0: 'Cielo despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  56: 'Llovizna helada ligera',
  57: 'Llovizna helada densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada ligera',
  67: 'Lluvia helada fuerte',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada fuerte',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos violentos',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve fuertes',
  95: 'Tormenta eléctrica',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo fuerte',
};

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding falló: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.results || !data.results.length) {
    throw new Error(`No se encontró la ciudad: "${city}"`);
  }
  const r = data.results[0];
  return {
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  };
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast falló: HTTP ${res.status}`);
  return res.json();
}

function degToCompass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}

async function main() {
  const city = process.argv.slice(2).join(' ') || 'Acapulco, Guerrero, Mexico';

  const place = await geocode(city);
  const weather = await getWeather(place.latitude, place.longitude);
  const cur = weather.current;
  const daily = weather.daily;

  const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  const desc = WMO_CODES[cur.weather_code] || `Código ${cur.weather_code}`;

  console.log(`Clima en ${label}`);
  console.log(`Actualizado: ${cur.time} (${place.timezone})`);
  console.log('-'.repeat(40));
  console.log(`Condición:      ${desc}`);
  console.log(`Temperatura:    ${cur.temperature_2m}°C (sensación ${cur.apparent_temperature}°C)`);
  console.log(`Humedad:        ${cur.relative_humidity_2m}%`);
  console.log(`Precipitación:  ${cur.precipitation} mm`);
  console.log(`Viento:         ${cur.wind_speed_10m} km/h ${degToCompass(cur.wind_direction_10m)}`);
  console.log('-'.repeat(40));
  console.log(`Hoy: máx ${daily.temperature_2m_max[0]}°C / mín ${daily.temperature_2m_min[0]}°C, precipitación ${daily.precipitation_sum[0]} mm`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
