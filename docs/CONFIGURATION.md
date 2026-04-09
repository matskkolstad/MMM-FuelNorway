# MMM-FuelNorway Configuration Reference

All available configuration options for the MMM-FuelNorway module.

## Full Configuration Object

```javascript
{
  module: 'MMM-FuelNorway',
  position: 'top_right',
  config: {
    method: 'nearby',
    latitude: 59.9139,
    longitude: 10.7522,
    radius: 5,
    stationIds: [],
    updateInterval: 15 * 60 * 1000,
    retryDelay: 5000,
    retryAttempts: 3,
    displayMode: 'list',
    orientation: 'vertical',
    moduleSize: 'medium',
    fuelTypes: ['gasoline_price', 'diesel_price'],
    showStationName: true,
    showAddress: true,
    addressFormat: 'street',
    showLastUpdated: true,
    lastUpdatedFormat: 'relative',
    showBrandLogo: true,
    compactPriceFormat: false,
    highlightCheapest: true,
    priceHighlightColor: '#00ff00',
    currencyFormat: 'NOK',
    decimalPlaces: 2,
    maxStations: 5,
    debug: false
  }
}
```

---

## Options Reference

### Data Fetching

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | `string` | `'nearby'` | Fetch method: `'nearby'` (location-based) or `'manual'` (specific station IDs) |
| `latitude` | `number` | `null` | Latitude for nearby search. **Required** when `method` is `'nearby'` |
| `longitude` | `number` | `null` | Longitude for nearby search. **Required** when `method` is `'nearby'` |
| `radius` | `number` | `5` | Search radius in kilometres for nearby method |
| `stationIds` | `string[]` | `[]` | Array of station IDs. **Required** when `method` is `'manual'` |
| `updateInterval` | `number` | `900000` | Refresh interval in milliseconds (default: 15 minutes) |
| `retryAttempts` | `number` | `3` | Number of retry attempts on API failure |
| `retryDelay` | `number` | `5000` | Delay in milliseconds between retry attempts |
| `debug` | `boolean` | `false` | Enable debug logging to the console |

### Display

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `displayMode` | `string` | `'list'` | Layout mode: `'list'` or `'grid'` |
| `orientation` | `string` | `'vertical'` | Item flow: `'vertical'` or `'horizontal'` |
| `moduleSize` | `string` | `'medium'` | Font/element size: `'small'`, `'medium'`, or `'large'` |
| `maxStations` | `number` | `5` | Maximum number of stations to display |

### Station Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showStationName` | `boolean` | `true` | Show the station name |
| `showAddress` | `boolean` | `true` | Show the station address |
| `addressFormat` | `string` | `'street'` | Address format: `'street'`, `'city'`, or `'full'` |
| `showLastUpdated` | `boolean` | `true` | Show when the price was last updated |
| `lastUpdatedFormat` | `string` | `'relative'` | Timestamp format: `'relative'` (e.g. "5 min") or `'absolute'` (HH:MM) |
| `showBrandLogo` | `boolean` | `true` | Show the station brand logo |

### Fuel Types

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fuelTypes` | `string[]` | `['gasoline_price', 'diesel_price']` | Fuel types to display. Valid values listed below |

**Available fuel type keys:**

| Key | Description |
|-----|-------------|
| `gasoline_price` | Petrol / Gasoline |
| `diesel_price` | Diesel |
| `hvo100_price` | HVO100 (renewable diesel) |
| `fd_price` | Fast charging (electric) |

### Pricing

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `highlightCheapest` | `boolean` | `true` | Highlight the cheapest price per fuel type |
| `priceHighlightColor` | `string` | `'#00ff00'` | CSS colour used to highlight the cheapest price |
| `currencyFormat` | `string` | `'NOK'` | Currency label appended to prices |
| `decimalPlaces` | `number` | `2` | Number of decimal places shown on prices |
| `compactPriceFormat` | `boolean` | `false` | Omit the currency label when `true` |

---

## Examples

### Nearby stations (Oslo city centre)

```javascript
config: {
  method: 'nearby',
  latitude: 59.9139,
  longitude: 10.7522,
  radius: 3,
  maxStations: 5,
  fuelTypes: ['gasoline_price', 'diesel_price']
}
```

### Manual station list

```javascript
config: {
  method: 'manual',
  stationIds: ['circle-k-oslo-sentrum', 'uno-x-gronland'],
  displayMode: 'grid',
  fuelTypes: ['gasoline_price', 'diesel_price', 'hvo100_price']
}
```

### Compact horizontal list

```javascript
config: {
  method: 'nearby',
  latitude: 59.9139,
  longitude: 10.7522,
  displayMode: 'list',
  orientation: 'horizontal',
  moduleSize: 'small',
  compactPriceFormat: true,
  showAddress: false,
  showLastUpdated: false
}
```
