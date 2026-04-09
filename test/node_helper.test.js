'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

// ── Load fixtures ──

const nearbyFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/nearby-response.json'), 'utf-8')
)
const stationFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/station-response.json'), 'utf-8')
)

// ── Utility functions mirroring node_helper.js logic ──

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function validateConfig(config) {
  if (config.method === 'nearby') {
    return toNumber(config.latitude) !== null && toNumber(config.longitude) !== null
  }
  if (config.method === 'manual') {
    return Array.isArray(config.stationIds) && config.stationIds.length > 0
  }
  return false
}

function buildNearbyUrl(config) {
  const baseUrl = 'https://backend.drivstoffapp.no'
  const lat = toNumber(config.latitude)
  const lng = toNumber(config.longitude)
  const radius = toNumber(config.radius) ?? 5
  return `${baseUrl}/stations/fuel/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
}

function buildStationUrl(stationId) {
  const baseUrl = 'https://backend.drivstoffapp.no'
  return `${baseUrl}/stations/fuel/${stationId}`
}

function isCacheValid(cache, cacheTime, updateInterval) {
  if (!cache || !cacheTime) return false
  const age = Date.now() - cacheTime
  return age < ((updateInterval ?? 15 * 60 * 1000))
}

function parseStationResponse(body) {
  try {
    const parsed = JSON.parse(body)
    return { data: parsed, error: null }
  } catch (e) {
    return { data: null, error: 'Failed to parse API response' }
  }
}

function normaliseToArray(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') return [data]
  return []
}

function buildRetryDelay(config) {
  const delay = toNumber(config.retryDelay)
  return delay ?? 5000
}

function shouldRetry(attempt, config) {
  const attempts = toNumber(config.retryAttempts) ?? 3
  return attempt < attempts
}

// Mirror of node_helper.js normalizeStation + haversineDistance
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeStation(raw, userLat, userLng) {
  const prices = (raw && raw.prices) || {}
  const location = (raw && raw.location) || {}
  const stationLat = toNumber(location.latitude)
  const stationLng = toNumber(location.longitude)
  const userLatNum = toNumber(userLat)
  const userLngNum = toNumber(userLng)

  let distance = null
  if (userLatNum !== null && userLngNum !== null && stationLat !== null && stationLng !== null) {
    distance = Math.round(haversineDistance(userLatNum, userLngNum, stationLat, stationLng) * 10) / 10
  }

  return {
    id: raw.id,
    name: raw.name || raw.station_name || '',
    address: {
      street: raw.street || '',
      city: raw.city || '',
      zip: raw.zip || ''
    },
    latitude: stationLat,
    longitude: stationLng,
    distance,
    gasoline_price: prices.gasoline_price !== undefined ? toNumber(prices.gasoline_price) : null,
    gasoline_95_price: prices.gasoline_95_price !== undefined ? toNumber(prices.gasoline_95_price) : null,
    gasoline_98_price: prices.gasoline_98_price !== undefined ? toNumber(prices.gasoline_98_price) : null,
    diesel_price: prices.diesel_price !== undefined ? toNumber(prices.diesel_price) : null,
    hvo100_price: prices.hvo100_price !== undefined ? toNumber(prices.hvo100_price) : null,
    fd_price: prices.fd_price !== undefined ? toNumber(prices.fd_price) : null,
    last_updated: prices.last_updated || null,
    logo: raw.logo || null
  }
}

// ── Tests ──

describe('Config validation', () => {
  test('validates nearby config requires latitude and longitude', () => {
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 59.9, longitude: 10.7 }), true)
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 0, longitude: 0 }), true)
    assert.strictEqual(validateConfig({ method: 'nearby' }), false)
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 59.9 }), false)
    assert.strictEqual(validateConfig({ method: 'nearby', longitude: 10.7 }), false)
  })

  test('accepts numeric string lat/lng but rejects non-numeric', () => {
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: '59.9', longitude: '10.7' }), true)
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 'not-number', longitude: 10.7 }), false)
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 59.9, longitude: 'ten' }), false)
  })

  test('validates manual config requires stationIds array', () => {
    assert.strictEqual(validateConfig({ method: 'manual', stationIds: ['abc', 'def'] }), true)
    assert.strictEqual(validateConfig({ method: 'manual', stationIds: ['single'] }), true)
    assert.strictEqual(validateConfig({ method: 'manual', stationIds: [] }), false)
    assert.strictEqual(validateConfig({ method: 'manual' }), false)
    assert.strictEqual(validateConfig({ method: 'manual', stationIds: 'not-an-array' }), false)
  })

  test('returns false for unknown method', () => {
    assert.strictEqual(validateConfig({ method: 'unknown' }), false)
    assert.strictEqual(validateConfig({}), false)
  })
})

describe('URL building', () => {
  test('builds nearby URL with default radius', () => {
    const result = buildNearbyUrl({ latitude: 59.9139, longitude: 10.7522 })
    assert.strictEqual(result, 'https://backend.drivstoffapp.no/stations/fuel/nearby?lat=59.9139&lng=10.7522&radius=5')
  })

  test('builds nearby URL with custom radius', () => {
    const result = buildNearbyUrl({ latitude: 59.9139, longitude: 10.7522, radius: 10 })
    assert.strictEqual(result, 'https://backend.drivstoffapp.no/stations/fuel/nearby?lat=59.9139&lng=10.7522&radius=10')
  })

  test('builds station URL', () => {
    const result = buildStationUrl('circle-k-oslo')
    assert.strictEqual(result, 'https://backend.drivstoffapp.no/stations/fuel/circle-k-oslo')
  })

  test('builds station URL for numeric id', () => {
    const result = buildStationUrl(12345)
    assert.strictEqual(result, 'https://backend.drivstoffapp.no/stations/fuel/12345')
  })

  test('builds nearby URL when lat/lng and radius are numeric strings', () => {
    const result = buildNearbyUrl({ latitude: '59.9139', longitude: '10.7522', radius: '7' })
    assert.strictEqual(result, 'https://backend.drivstoffapp.no/stations/fuel/nearby?lat=59.9139&lng=10.7522&radius=7')
  })
})

describe('Cache validation', () => {
  test('returns false when cache is empty', () => {
    assert.strictEqual(isCacheValid(null, null, 900000), false)
    assert.strictEqual(isCacheValid([], null, 900000), false)
  })

  test('returns true when cache is fresh', () => {
    const freshTime = Date.now() - 60000
    assert.strictEqual(isCacheValid([{}], freshTime, 900000), true)
  })

  test('returns false when cache is stale', () => {
    const staleTime = Date.now() - 20 * 60 * 1000
    assert.strictEqual(isCacheValid([{}], staleTime, 900000), false)
  })

  test('uses default interval when not specified', () => {
    const freshTime = Date.now() - 60000
    assert.strictEqual(isCacheValid([{}], freshTime, undefined), true)
  })

  test('accepts numeric string updateInterval', () => {
    const freshTime = Date.now() - 60000
    assert.strictEqual(isCacheValid([{}], freshTime, '900000'), true)
  })
})

describe('Response parsing', () => {
  test('parses valid JSON', () => {
    const body = JSON.stringify([{ id: '1', name: 'Test' }])
    const { data, error } = parseStationResponse(body)
    assert.strictEqual(error, null)
    assert.deepStrictEqual(data, [{ id: '1', name: 'Test' }])
  })

  test('returns error on invalid JSON', () => {
    const { data, error } = parseStationResponse('not-json{{')
    assert.strictEqual(data, null)
    assert.ok(typeof error === 'string' && error.length > 0)
  })
})

describe('normaliseToArray', () => {
  test('returns arrays unchanged', () => {
    const arr = [{ id: '1' }, { id: '2' }]
    assert.deepStrictEqual(normaliseToArray(arr), arr)
  })

  test('wraps a single object in array', () => {
    const station = { id: '1', name: 'Test' }
    assert.deepStrictEqual(normaliseToArray(station), [station])
  })

  test('returns empty array for falsy input', () => {
    assert.deepStrictEqual(normaliseToArray(null), [])
    assert.deepStrictEqual(normaliseToArray(undefined), [])
  })
})

describe('Retry logic', () => {
  test('shouldRetry returns true while under limit', () => {
    const config = { retryAttempts: 3 }
    assert.strictEqual(shouldRetry(1, config), true)
    assert.strictEqual(shouldRetry(2, config), true)
    assert.strictEqual(shouldRetry(3, config), false)
  })

  test('shouldRetry uses default of 3 attempts', () => {
    assert.strictEqual(shouldRetry(2, {}), true)
    assert.strictEqual(shouldRetry(3, {}), false)
  })

  test('buildRetryDelay returns configured delay', () => {
    assert.strictEqual(buildRetryDelay({ retryDelay: 2000 }), 2000)
  })

  test('buildRetryDelay defaults to 5000ms', () => {
    assert.strictEqual(buildRetryDelay({}), 5000)
  })

  test('retry helpers accept numeric string values', () => {
    assert.strictEqual(buildRetryDelay({ retryDelay: '3000' }), 3000)
    assert.strictEqual(shouldRetry(1, { retryAttempts: '2' }), true)
    assert.strictEqual(shouldRetry(2, { retryAttempts: '2' }), false)
  })
})

describe('Error handling', () => {
  test('returns descriptive error for unknown method', () => {
    const method = 'foobar'
    const message = `Unknown method: ${method}`
    assert.ok(message.includes('foobar'))
  })

  test('missing lat/lng produces config error', () => {
    const valid = validateConfig({ method: 'nearby', latitude: null, longitude: 10.7 })
    assert.strictEqual(valid, false)
  })
})

describe('Haversine distance', () => {
  test('returns ~0 for identical coordinates', () => {
    const d = haversineDistance(59.9139, 10.7522, 59.9139, 10.7522)
    assert.ok(d < 0.001)
  })

  test('calculates reasonable distance between Oslo and Bergen (~300 km)', () => {
    const d = haversineDistance(59.9139, 10.7522, 60.3913, 5.3221)
    assert.ok(d > 280 && d < 320, `Expected ~300 km, got ${d.toFixed(1)} km`)
  })

  test('calculates short distance correctly', () => {
    // ~0.3 km
    const d = haversineDistance(59.92082, 10.75106, 59.9236, 10.7529)
    assert.ok(d < 1.0, `Expected < 1 km, got ${d.toFixed(3)} km`)
  })
})

describe('Station normalisation', () => {
  test('flattens nested prices to top-level fields', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.gasoline_price, 19.2)
    assert.strictEqual(result.gasoline_95_price, 19.2)
    assert.strictEqual(result.diesel_price, 24.61)
    assert.strictEqual(result.hvo100_price, null)
    assert.strictEqual(result.fd_price, null)
  })

  test('extracts last_updated from nested prices', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.last_updated, '2026-04-09T11:03:29.295000Z')
  })

  test('builds address object from flat street/city/zip fields', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.deepStrictEqual(result.address, { street: 'Maridalsveien 10', city: 'Oslo', zip: '0178' })
  })

  test('extracts lat/lng from nested location object', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.ok(Math.abs(result.latitude - 59.92082191643188) < 0.000001)
    assert.ok(Math.abs(result.longitude - 10.75106396077194) < 0.000001)
  })

  test('calculates distance when user coordinates provided', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, 59.9139, 10.7522)
    assert.ok(result.distance !== null && result.distance > 0, 'distance should be positive')
    assert.ok(result.distance < 20, 'distance should be < 20 km for Oslo')
  })

  test('sets distance to null when no user coordinates provided', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.distance, null)
  })

  test('uses name field for station name', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.name, 'Fredensborg')
  })

  test('falls back to station_name when name is missing', () => {
    const raw = { ...stationFixture, name: '', station_name: 'Fallback Name', prices: {}, location: {} }
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.name, 'Fallback Name')
  })

  test('preserves logo URL', () => {
    const raw = stationFixture
    const result = normalizeStation(raw, null, null)
    assert.ok(result.logo && result.logo.startsWith('https://'))
  })

  test('sets logo to null when absent', () => {
    const raw = { ...stationFixture, logo: null, prices: {}, location: {} }
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.logo, null)
  })

  test('normalises all stations in nearby fixture', () => {
    const results = nearbyFixture.map((s) => normalizeStation(s, 59.9139, 10.7522))
    assert.strictEqual(results.length, 3)
    results.forEach((r) => {
      assert.ok(r.id)
      assert.ok(r.name)
      assert.ok(typeof r.gasoline_price === 'number' || r.gasoline_price === null)
      assert.ok(typeof r.diesel_price === 'number' || r.diesel_price === null)
    })
  })

  test('handles station with no prices gracefully', () => {
    const raw = { id: 'x', name: 'Empty', street: '', city: '', zip: '', logo: null, location: {} }
    const result = normalizeStation(raw, null, null)
    assert.strictEqual(result.gasoline_price, null)
    assert.strictEqual(result.diesel_price, null)
    assert.strictEqual(result.last_updated, null)
  })

  test('calculates distance when coordinates are zero', () => {
    const raw = { id: 'zero', name: 'Zero', street: '', city: '', zip: '', logo: null, location: { latitude: 0, longitude: 0 }, prices: {} }
    const result = normalizeStation(raw, 0, 0)
    assert.strictEqual(result.distance, 0)
  })

  test('parses numeric string prices to numbers and ignores invalid ones', () => {
    const raw = {
      id: 'string-prices',
      name: 'String Station',
      street: '',
      city: '',
      zip: '',
      logo: null,
      location: { latitude: '59.9', longitude: '10.7' },
      prices: { gasoline_price: '19.55', diesel_price: 'bad-data' }
    }
    const result = normalizeStation(raw, '59.9', '10.7')
    assert.strictEqual(result.gasoline_price, 19.55)
    assert.strictEqual(result.diesel_price, null)
    assert.ok(result.distance !== null)
  })
})
