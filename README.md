# MMM-FuelNorway

A [MagicMirror²](https://magicmirror.builders/) module that displays live Norwegian fuel prices using the [Drivstoff App](https://www.drivstoffapp.no/) API. Find nearby stations automatically or configure specific stations by ID — with support for petrol, diesel, HVO100, and electric fast-charging prices.

---

## Features

- 📍 **Nearby mode** – automatically fetch stations within a configurable radius of your location
- 🔖 **Manual mode** – pin specific station IDs you care about
- ⛽ **Multiple fuel types** – petrol, diesel, HVO100, electric (fast-charge)
- 🏆 **Cheapest price highlight** – visually flag the best price per fuel type
- 🗺️ **List and grid layouts** – vertical or horizontal orientation
- 📐 **Three size variants** – small, medium, large
- 🖼️ **Brand logos** – shows the station's brand logo when available
- 🌍 **Bilingual** – English and Norwegian (Bokmål/Nynorsk) translations
- ♻️ **Smart caching** – avoids redundant API calls between update intervals
- 🔄 **Auto-retry** – configurable retry logic on API failure

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/matskkolstad/MMM-FuelNorway.git
cd MMM-FuelNorway
npm install
```

---

## Configuration

Add the module to your `config/config.js`:

### Minimal – nearby stations

```javascript
{
  module: 'MMM-FuelNorway',
  position: 'top_right',
  config: {
    method: 'nearby',
    latitude: 59.9139,   // your latitude
    longitude: 10.7522   // your longitude
  }
}
```

### Full example

```javascript
{
  module: 'MMM-FuelNorway',
  position: 'top_right',
  header: 'Fuel Prices',
  config: {
    method: 'nearby',
    latitude: 59.9139,
    longitude: 10.7522,
    radius: 5,
    maxStations: 5,
    updateInterval: 15 * 60 * 1000,
    retryAttempts: 3,
    retryDelay: 5000,

    displayMode: 'list',        // 'list' or 'grid'
    orientation: 'vertical',   // 'vertical' or 'horizontal'
    moduleSize: 'medium',      // 'small', 'medium', 'large'

    fuelTypes: ['gasoline_price', 'diesel_price'],

    showStationName: true,
    showAddress: true,
    addressFormat: 'street',   // 'street', 'city', 'full'
    showLastUpdated: true,
    lastUpdatedFormat: 'relative',  // 'relative' or 'absolute'
    showBrandLogo: true,

    highlightCheapest: true,
    priceHighlightColor: '#00ff00',

    currencyFormat: 'NOK',
    decimalPlaces: 2,
    compactPriceFormat: false,

    debug: false
  }
}
```

### Manual – specific stations

```javascript
{
  module: 'MMM-FuelNorway',
  position: 'top_right',
  config: {
    method: 'manual',
    stationIds: ['ewf1ni1aituz3xc', '2bc5fi4pdadlnc1'],
    displayMode: 'grid',
    fuelTypes: ['gasoline_price', 'diesel_price', 'hvo100_price']
  }
}
```

### All configuration options

See [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) for the complete reference table.

---

## Finding Station IDs

Station IDs are provided by the Drivstoff App API. You can find them by making a nearby request manually:

```
GET https://backend.drivstoffapp.no/stations/fuel/nearby?lat=59.9139&lng=10.7522&radius=5
```

Each station object in the response contains an `id` field — use that value in your `stationIds` array.

---

## API Integration Notes

- **Base URL:** `https://backend.drivstoffapp.no`
- **Nearby endpoint:** `GET /stations/fuel/nearby?lat={lat}&lng={lng}&radius={km}`
- **Single station:** `GET /stations/fuel/{station_id}`
- No authentication required for public endpoints
- The module respects the `updateInterval` and will not make duplicate requests within that window (caching)

---

## Troubleshooting

| Symptom | Solution |
|---------|----------|
| "No stations found" | Check your `latitude`/`longitude` values and increase `radius` |
| "Error loading fuel prices" | Enable `debug: true` and check browser/server logs |
| Prices not updating | The module caches results; wait for `updateInterval` to expire |
| Module blank on startup | Verify `method`, `latitude`, and `longitude` are set correctly |

Enable debug logging with `debug: true` in the config. Logs appear in the MagicMirror server console prefixed with `[MMM-FuelNorway]`.

---

## Internationalization

The module ships with English (`en`) and Norwegian (`no` / `nb` / `nn`) translations. MagicMirror² will automatically pick the translation that matches your `language` setting in `config.js`.

To use Norwegian:
```javascript
// In config/config.js
language: 'no'
```

---

## License & Credits

MIT License — see [`LICENSE`](LICENSE) for details.

Copyright (c) 2024 Mats Kjoshagen Kolstad. Created with AI assistance.

Fuel price data provided by the [Drivstoff App](https://www.drivstoffapp.no/) API.

---

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to your branch and open a pull request
