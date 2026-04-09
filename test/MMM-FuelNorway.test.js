'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')

// ── Mirror of defaults from MMM-FuelNorway.js ──

const defaults = {
  method: 'nearby',
  latitude: null,
  longitude: null,
  radius: 5,
  stationIds: [],
  updateInterval: 15 * 60 * 1000,
  retryDelay: 5000,
  retryAttempts: 3,
  displayMode: 'list',
  orientation: 'vertical',
  moduleSize: 'medium',
  fuelTypes: ['gasoline_price', 'diesel_price'],
  apiKey: null,
  countryCode: 'NO',
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

// ── Utility functions mirroring MMM-FuelNorway.js ──

function formatPrice(price, decimalPlaces, currencyFormat, compactPriceFormat) {
  if (price === null || price === undefined || price === '') return '-'
  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return '-'
  const formatted = numeric.toFixed(decimalPlaces)
  if (compactPriceFormat) return formatted
  return `${formatted} ${currencyFormat}`
}

function formatTimestamp(timestamp, format) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  if (format === 'relative') {
    const diffMs = Date.now() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return '< 1 min'
    if (diffMins < 60) return `${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    return `${Math.floor(diffHours / 24)}d`
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatAddress(address, format) {
  if (!address) return ''
  if (format === 'full') return [address.street, address.zip, address.city].filter(Boolean).join(', ')
  if (format === 'city') return address.city || ''
  return address.street || ''
}

function getFuelLabel(fuelType) {
  const map = {
    gasoline_price: 'Petrol',
    gasoline_95_price: 'Petrol 95',
    gasoline_98_price: 'Petrol 98',
    diesel_price: 'Diesel',
    hvo100_price: 'HVO100',
    fd_price: 'Electric'
  }
  return map[fuelType] || fuelType
}

function getStationName(station) {
  const candidates = [
    station && station.name,
    station && station.station_name,
    station && station.stationName,
    station && station.address && station.address.street,
    station && station.id
  ]
  const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)
  return resolved ? resolved.trim() : 'Unknown station'
}

function findCheapest(stations, fuelTypes) {
  const cheapest = {}
  fuelTypes.forEach((fuelType) => {
    let minPrice = null
    stations.forEach((station) => {
      const price = station[fuelType]
      if (price !== null && price !== undefined) {
        if (minPrice === null || price < minPrice) minPrice = price
      }
    })
    cheapest[fuelType] = minPrice
  })
  return cheapest
}

function sortStationsByPrice(stations, fuelType) {
  return [...stations].sort((a, b) => {
    const pa = a[fuelType] !== null && a[fuelType] !== undefined ? a[fuelType] : Infinity
    const pb = b[fuelType] !== null && b[fuelType] !== undefined ? b[fuelType] : Infinity
    return pa - pb
  })
}

function sortStationsByLastUpdated(stations) {
  return [...stations].sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
}

// ── Test data ──

const sampleStations = [
  { id: '1', name: 'Station A', gasoline_price: 19.49, diesel_price: 18.79, last_updated: '2024-03-15T09:00:00Z' },
  { id: '2', name: 'Station B', gasoline_price: 19.29, diesel_price: 18.59, last_updated: '2024-03-15T08:00:00Z' },
  { id: '3', name: 'Station C', gasoline_price: 19.69, diesel_price: null, last_updated: '2024-03-15T07:00:00Z' }
]

// ── Tests ──

describe('Default configuration', () => {
  test('has correct default method', () => {
    assert.strictEqual(defaults.method, 'nearby')
  })

  test('has correct default displayMode', () => {
    assert.strictEqual(defaults.displayMode, 'list')
  })

  test('has correct default fuelTypes', () => {
    assert.deepStrictEqual(defaults.fuelTypes, ['gasoline_price', 'diesel_price'])
  })

  test('has correct default updateInterval (15 minutes)', () => {
    assert.strictEqual(defaults.updateInterval, 900000)
  })

  test('has correct default moduleSize', () => {
    assert.strictEqual(defaults.moduleSize, 'medium')
  })

  test('highlightCheapest is true by default', () => {
    assert.strictEqual(defaults.highlightCheapest, true)
  })

  test('apiKey is null by default', () => {
    assert.strictEqual(defaults.apiKey, null)
  })

  test('countryCode defaults to NO', () => {
    assert.strictEqual(defaults.countryCode, 'NO')
  })

  test('debug is false by default', () => {
    assert.strictEqual(defaults.debug, false)
  })

  test('maxStations is 5 by default', () => {
    assert.strictEqual(defaults.maxStations, 5)
  })
})

describe('Price formatting', () => {
  test('formats price with 2 decimal places', () => {
    assert.strictEqual(formatPrice(19.49, 2, 'NOK', false), '19.49 NOK')
  })

  test('formats price with compact mode', () => {
    assert.strictEqual(formatPrice(19.49, 2, 'NOK', true), '19.49')
  })

  test('formats numeric string input', () => {
    assert.strictEqual(formatPrice('19.49', 2, 'NOK', false), '19.49 NOK')
  })

  test('returns dash for null price', () => {
    assert.strictEqual(formatPrice(null, 2, 'NOK', false), '-')
  })

  test('returns dash for undefined price', () => {
    assert.strictEqual(formatPrice(undefined, 2, 'NOK', false), '-')
  })

  test('returns dash for non-numeric input', () => {
    assert.strictEqual(formatPrice('not-a-number', 2, 'NOK', false), '-')
    assert.strictEqual(formatPrice('', 2, 'NOK', false), '-')
  })

  test('formats to configured decimal places', () => {
    assert.strictEqual(formatPrice(19.4999, 1, 'NOK', true), '19.5')
    assert.strictEqual(formatPrice(19.4999, 3, 'NOK', true), '19.500')
  })

  test('handles integer prices', () => {
    assert.strictEqual(formatPrice(20, 2, 'NOK', true), '20.00')
  })

  test('respects custom currency labels', () => {
    assert.strictEqual(formatPrice(21.1, 2, 'EUR', false), '21.10 EUR')
  })
})

describe('Timestamp formatting', () => {
  test('formats very recent timestamp as "< 1 min"', () => {
    const recent = new Date(Date.now() - 30000).toISOString()
    assert.strictEqual(formatTimestamp(recent, 'relative'), '< 1 min')
  })

  test('formats timestamp in minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    assert.strictEqual(formatTimestamp(fiveMinAgo, 'relative'), '5 min')
  })

  test('formats timestamp in hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    assert.strictEqual(formatTimestamp(twoHoursAgo, 'relative'), '2h')
  })

  test('formats timestamp in days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    assert.strictEqual(formatTimestamp(twoDaysAgo, 'relative'), '2d')
  })

  test('returns empty string for falsy timestamp', () => {
    assert.strictEqual(formatTimestamp(null, 'relative'), '')
    assert.strictEqual(formatTimestamp('', 'relative'), '')
  })

  test('returns empty string for invalid timestamp value', () => {
    assert.strictEqual(formatTimestamp('not-a-date', 'relative'), '')
  })

  test('formats timestamp in absolute mode', () => {
    const specific = '2024-03-15T12:00:00Z'
    const formatted = formatTimestamp(specific, 'absolute')
    assert.ok(typeof formatted === 'string' && formatted.includes(':'), 'absolute timestamp should contain a time separator')
  })
})

describe('Fuel type label mapping', () => {
  test('maps gasoline_price to Petrol', () => {
    assert.strictEqual(getFuelLabel('gasoline_price'), 'Petrol')
  })

  test('maps gasoline_95_price to Petrol 95', () => {
    assert.strictEqual(getFuelLabel('gasoline_95_price'), 'Petrol 95')
  })

  test('maps gasoline_98_price to Petrol 98', () => {
    assert.strictEqual(getFuelLabel('gasoline_98_price'), 'Petrol 98')
  })

  test('maps diesel_price to Diesel', () => {
    assert.strictEqual(getFuelLabel('diesel_price'), 'Diesel')
  })

  test('maps hvo100_price to HVO100', () => {
    assert.strictEqual(getFuelLabel('hvo100_price'), 'HVO100')
  })

  test('maps fd_price to Electric', () => {
    assert.strictEqual(getFuelLabel('fd_price'), 'Electric')
  })

  test('returns unknown fuel type as-is', () => {
    assert.strictEqual(getFuelLabel('custom_fuel'), 'custom_fuel')
  })
})

describe('Address formatting', () => {
  const addr = { street: 'Grensen 5', city: 'Oslo', zip: '0159' }

  test('formats street address by default', () => {
    assert.strictEqual(formatAddress(addr, 'street'), 'Grensen 5')
  })

  test('formats city only', () => {
    assert.strictEqual(formatAddress(addr, 'city'), 'Oslo')
  })

  test('formats full address', () => {
    assert.strictEqual(formatAddress(addr, 'full'), 'Grensen 5, 0159, Oslo')
  })

  test('returns empty string for null address', () => {
    assert.strictEqual(formatAddress(null, 'street'), '')
  })
})

describe('Station naming', () => {
  test('returns provided station name when present', () => {
    const station = { name: 'Primary Name', address: { street: 'Gate 1' }, id: 'id-1' }
    assert.strictEqual(getStationName(station), 'Primary Name')
  })

  test('falls back to address street when name fields are empty', () => {
    const station = { name: '', station_name: '', address: { street: 'Fallback Street' }, id: 'id-2' }
    assert.strictEqual(getStationName(station), 'Fallback Street')
  })

  test('uses id as a final fallback', () => {
    const station = { name: '', station_name: '', address: { street: '' }, id: 'id-3' }
    assert.strictEqual(getStationName(station), 'id-3')
  })
})

describe('Station sorting by price', () => {
  test('sorts stations by gasoline price ascending', () => {
    const sorted = sortStationsByPrice(sampleStations, 'gasoline_price')
    assert.strictEqual(sorted[0].name, 'Station B')
    assert.strictEqual(sorted[1].name, 'Station A')
    assert.strictEqual(sorted[2].name, 'Station C')
  })

  test('sorts stations with null price to end', () => {
    const sorted = sortStationsByPrice(sampleStations, 'diesel_price')
    assert.strictEqual(sorted[sorted.length - 1].name, 'Station C')
  })

  test('does not mutate original array', () => {
    const original = [...sampleStations]
    sortStationsByPrice(sampleStations, 'gasoline_price')
    assert.deepStrictEqual(sampleStations, original)
  })
})

describe('Station sorting by last_updated', () => {
  test('sorts most recently updated first', () => {
    const sorted = sortStationsByLastUpdated(sampleStations)
    assert.strictEqual(sorted[0].id, '1')
    assert.strictEqual(sorted[2].id, '3')
  })
})

describe('highlightCheapest logic', () => {
  test('finds cheapest gasoline price', () => {
    const cheapest = findCheapest(sampleStations, ['gasoline_price'])
    assert.strictEqual(cheapest.gasoline_price, 19.29)
  })

  test('finds cheapest diesel price ignoring nulls', () => {
    const cheapest = findCheapest(sampleStations, ['diesel_price'])
    assert.strictEqual(cheapest.diesel_price, 18.59)
  })

  test('returns null for fuel type with no prices available', () => {
    const stations = [
      { id: '1', hvo100_price: null },
      { id: '2', hvo100_price: null }
    ]
    const cheapest = findCheapest(stations, ['hvo100_price'])
    assert.strictEqual(cheapest.hvo100_price, null)
  })

  test('correctly identifies cheapest across multiple fuel types', () => {
    const cheapest = findCheapest(sampleStations, ['gasoline_price', 'diesel_price'])
    assert.strictEqual(cheapest.gasoline_price, 19.29)
    assert.strictEqual(cheapest.diesel_price, 18.59)
  })
})
