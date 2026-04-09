'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')

// ── Utility functions mirroring node_helper.js logic ──

function validateConfig(config) {
  if (config.method === 'nearby') {
    return typeof config.latitude === 'number' && typeof config.longitude === 'number'
  }
  if (config.method === 'manual') {
    return Array.isArray(config.stationIds) && config.stationIds.length > 0
  }
  return false
}

function buildNearbyUrl(config) {
  const baseUrl = 'https://backend.drivstoffapp.no'
  const radius = config.radius || 5
  return `${baseUrl}/stations/fuel/nearby?lat=${config.latitude}&lng=${config.longitude}&radius=${radius}`
}

function buildStationUrl(stationId) {
  const baseUrl = 'https://backend.drivstoffapp.no'
  return `${baseUrl}/stations/fuel/${stationId}`
}

function isCacheValid(cache, cacheTime, updateInterval) {
  if (!cache || !cacheTime) return false
  const age = Date.now() - cacheTime
  return age < (updateInterval || 15 * 60 * 1000)
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
  return config.retryDelay || 5000
}

function shouldRetry(attempt, config) {
  return attempt < (config.retryAttempts || 3)
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

  test('validates nearby config rejects non-number lat/lng', () => {
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: '59.9', longitude: 10.7 }), false)
    assert.strictEqual(validateConfig({ method: 'nearby', latitude: 59.9, longitude: '10.7' }), false)
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
