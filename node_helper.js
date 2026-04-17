'use strict'

const NodeHelper = require('node_helper')
const https = require('node:https')

const BASE_URL = 'https://backend.drivstoffapp.no'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

module.exports = NodeHelper.create({
  start() {
    console.log(`[MMM-FuelNorway] Node helper started`)
    this.cache = null
    this.cacheTime = null
    this.config = null
    this.requestInProgress = false
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FUELNORWAY_FETCH_DATA') {
      this.fetchData(payload)
    }
  },

  isCacheValid() {
    if (!this.cache || !this.cacheTime || !this.config) return false
    const age = Date.now() - this.cacheTime
    return age < (this.config.updateInterval ?? 15 * 60 * 1000)
  },

  fetchData(config) {
    const updateInterval = toNumber(config.updateInterval)
    const retryAttempts = toNumber(config.retryAttempts)
    const retryDelay = toNumber(config.retryDelay)
    const safeInterval = updateInterval !== null && updateInterval >= 5000
      ? updateInterval
      : 15 * 60 * 1000
    if (updateInterval !== null && updateInterval < 5000) {
      console.warn('[MMM-FuelNorway] updateInterval is below minimum (5000 ms); using default 15 minutes')
    }
    const normalizedConfig = {
      ...config,
      latitude: toNumber(config.latitude),
      longitude: toNumber(config.longitude),
      radius: toNumber(config.radius) ?? 5,
      updateInterval: safeInterval,
      retryAttempts: retryAttempts ?? 3,
      retryDelay: retryDelay ?? 5000
    }
    this.config = normalizedConfig

    if (this.isCacheValid()) {
      if (this.config.debug) {
        console.log('[MMM-FuelNorway] Serving from cache')
      }
      this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', this.cache)
      return
    }

    if (this.requestInProgress) {
      if (this.config.debug) {
        console.log('[MMM-FuelNorway] Request already in progress, skipping duplicate fetch')
      }
      return
    }

    if (config.method === 'nearby') {
      if (normalizedConfig.latitude === null || normalizedConfig.longitude === null) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: latitude and longitude required for nearby method' })
        return
      }
      this.requestInProgress = true
      this.fetchNearby(normalizedConfig)
    } else if (config.method === 'manual') {
      if (!Array.isArray(config.stationIds) || config.stationIds.length === 0) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: stationIds array required for manual method' })
        return
      }
      this.requestInProgress = true
      this.fetchMultipleStations(normalizedConfig)
    } else {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: `Unknown method: ${config.method}` })
    }
  },

  resolveStationName(raw) {
    const address = this.buildAddress(raw)
    const locationAddress = raw && raw.location && typeof raw.location.address === 'string'
      ? raw.location.address
      : ''
    const candidates = [
      raw && raw.name,
      raw && raw.station_name,
      raw && raw.stationName,
      raw && raw.station && raw.station.name,
      address.street,
      raw && raw.location && raw.location.name,
      locationAddress,
      raw && raw.id
    ]
    const match = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)
    return match ? match.trim() : 'Unknown station'
  },

  buildAddress(raw) {
    const location = (raw && raw.location) || {}
    const addressLine = typeof location.address === 'string' ? location.address : ''
    const [addressStreet, ...addressRest] = addressLine
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    const street = (raw && raw.street) || addressStreet || ''
    const city = (raw && raw.city) || (addressRest.length > 0 ? addressRest.join(', ') : '')
    const zip = (raw && raw.zip) || ''

    return { street, city, zip }
  },

  // Normalise a raw API station object into the flat format the front-end expects.
  // The real API nests prices under station.prices and the address as separate flat
  // fields (street / city / zip), so we flatten everything here.
  normalizeStation(raw, userLat, userLng) {
    const prices = (raw && raw.prices) || {}
    const location = (raw && raw.location) || {}
    const stationLat = toNumber(location.latitude)
    const stationLng = toNumber(location.longitude)
    const userLatNum = toNumber(userLat)
    const userLngNum = toNumber(userLng)
    const resolvedName = this.resolveStationName(raw)
    const address = this.buildAddress(raw)

    let distance = null
    if (userLatNum !== null && userLngNum !== null && stationLat !== null && stationLng !== null) {
      distance = Math.round(this.haversineDistance(userLatNum, userLngNum, stationLat, stationLng) * 10) / 10
    }

    return {
      id: raw.id,
      name: resolvedName,
      address,
      latitude: stationLat,
      longitude: stationLng,
      distance,
      gasoline_price: prices.gasoline_price !== undefined ? toNumber(prices.gasoline_price) : null,
      gasoline_95_price: prices.gasoline_95_price !== undefined ? toNumber(prices.gasoline_95_price) : null,
      gasoline_98_price: prices.gasoline_98_price !== undefined ? toNumber(prices.gasoline_98_price) : null,
      diesel_price: prices.diesel_price !== undefined ? toNumber(prices.diesel_price) : null,
      hvo100_price: prices.hvo100_price !== undefined ? toNumber(prices.hvo100_price) : null,
      fd_price: prices.fd_price !== undefined ? toNumber(prices.fd_price) : null,
      last_updated: prices.last_updated || raw.last_updated || null,
      logo: raw.logo || null
    }
  },

  // Haversine formula – returns distance in kilometres between two lat/lng points.
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371
    const toRad = (deg) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  },

  fetchNearby(config, attempt) {
    attempt = attempt || 1
    const radius = config.radius ?? 5
    const endpoint = `${BASE_URL}/stations/fuel/nearby?lat=${config.latitude}&lng=${config.longitude}&radius=${radius}`

    if (config.debug) {
      console.log(`[MMM-FuelNorway] Fetching nearby: ${endpoint} (attempt ${attempt})`)
    }

    this.httpsGet(endpoint, (err, data) => {
      if (err) {
        const retryAttempts = config.retryAttempts ?? 3
        if (attempt < retryAttempts) {
          console.log(`[MMM-FuelNorway] Retry ${attempt}/${retryAttempts} after error: ${err.message}`)
          setTimeout(() => this.fetchNearby(config, attempt + 1), config.retryDelay ?? 5000)
        } else {
          this.requestInProgress = false
          this.sendSocketNotification('FUELNORWAY_ERROR', { message: err.message })
        }
        return
      }
      let stations
      try {
        stations = JSON.parse(data)
      } catch (_e) {
        this.requestInProgress = false
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Failed to parse API response' })
        return
      }
      if (!Array.isArray(stations)) {
        stations = [stations]
      }
      if (config.debug) {
        console.log(`[MMM-FuelNorway] Parsed ${stations.length} station(s) from nearby response`)
        if (stations.length > 0) {
          console.log(`[MMM-FuelNorway] First station: id=${stations[0].id}, name=${stations[0].name}`)
        }
      }
      const normalized = stations.map((s) => this.normalizeStation(s, config.latitude, config.longitude))
      this.cache = normalized
      this.cacheTime = Date.now()
      this.requestInProgress = false
      if (config.debug) {
        console.log(`[MMM-FuelNorway] Sending FUELNORWAY_DATA_RECEIVED with ${normalized.length} station(s)`)
      }
      this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', normalized)
    })
  },

  fetchStation(stationId, callback, attempt) {
    attempt = attempt || 1
    const endpoint = `${BASE_URL}/stations/fuel/${stationId}`

    if (this.config && this.config.debug) {
      console.log(`[MMM-FuelNorway] Fetching station ${stationId}: ${endpoint}`)
    }

    this.httpsGet(endpoint, (err, data) => {
      if (err) {
        const retryAttempts = (this.config && this.config.retryAttempts) ?? 3
        if (attempt < retryAttempts) {
          setTimeout(() => this.fetchStation(stationId, callback, attempt + 1), (this.config && this.config.retryDelay) ?? 5000)
        } else {
          callback(err, null)
        }
        return
      }
      let station
      try {
        station = JSON.parse(data)
      } catch (_e) {
        callback(new Error('Failed to parse station response'), null)
        return
      }
      callback(null, station)
    })
  },

  fetchMultipleStations(config) {
    const ids = [...config.stationIds]
    const concurrencyLimit = 5
    const results = new Array(ids.length).fill(null)
    let activeCount = 0
    let nextIndex = 0
    let failed = false

    if (config.debug) {
      console.log(`[MMM-FuelNorway] Queue-based fetch starting for ${ids.length} station(s) (max ${concurrencyLimit} parallel)`)
    }

    const finish = (err) => {
      this.requestInProgress = false
      if (err) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: err.message })
      } else {
        const normalized = results.map((station) => this.normalizeStation(station, config.latitude, config.longitude))
        this.cache = normalized
        this.cacheTime = Date.now()
        if (config.debug) {
          console.log(`[MMM-FuelNorway] Sending FUELNORWAY_DATA_RECEIVED with ${normalized.length} station(s)`)
        }
        this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', normalized)
      }
    }

    const dispatch = () => {
      if (failed) return
      while (activeCount < concurrencyLimit && nextIndex < ids.length) {
        const idx = nextIndex++
        const stationId = ids[idx]
        activeCount++
        this.fetchStation(stationId, (err, station) => {
          activeCount--
          if (failed) return
          if (err) {
            failed = true
            finish(new Error(`Failed to fetch station ${stationId}: ${err.message}`))
            return
          }
          results[idx] = station
          if (nextIndex < ids.length) {
            dispatch()
          } else if (activeCount === 0) {
            finish(null)
          }
        })
      }
    }

    dispatch()
  },

  httpsGet(endpoint, callback) {
    const parsedUrl = new URL(endpoint)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MMM-FuelNorway/1.0.0'
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          callback(null, body)
        } else {
          callback(new Error(`HTTP ${res.statusCode}: ${body}`), null)
        }
      })
    })

    req.on('error', (err) => {
      callback(err, null)
    })

    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timed out'))
    })

    req.end()
  }
})
