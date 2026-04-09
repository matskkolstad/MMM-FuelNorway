'use strict'

const NodeHelper = require('node_helper')
const https = require('https')

const BASE_URL = 'https://backend.drivstoffapp.no'

module.exports = NodeHelper.create({
  start() {
    console.log(`[MMM-FuelNorway] Node helper started`)
    this.cache = null
    this.cacheTime = null
    this.config = null
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FUELNORWAY_FETCH_DATA') {
      this.config = payload
      if (this.isCacheValid()) {
        if (this.config.debug) {
          console.log('[MMM-FuelNorway] Serving from cache')
        }
        this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', this.cache)
        return
      }
      this.fetchData(payload)
    }
  },

  isCacheValid() {
    if (!this.cache || !this.cacheTime || !this.config) return false
    const age = Date.now() - this.cacheTime
    return age < (this.config.updateInterval || 15 * 60 * 1000)
  },

  fetchData(config) {
    if (config.method === 'nearby') {
      if (typeof config.latitude !== 'number' || typeof config.longitude !== 'number') {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: latitude and longitude required for nearby method' })
        return
      }
      this.fetchNearby(config)
    } else if (config.method === 'manual') {
      if (!Array.isArray(config.stationIds) || config.stationIds.length === 0) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: stationIds array required for manual method' })
        return
      }
      this.fetchMultipleStations(config)
    } else {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: `Unknown method: ${config.method}` })
    }
  },

  // Normalise a raw API station object into the flat format the front-end expects.
  // The real API nests prices under station.prices and the address as separate flat
  // fields (street / city / zip), so we flatten everything here.
  normalizeStation(raw, userLat, userLng) {
    const prices = (raw && raw.prices) || {}
    const location = (raw && raw.location) || {}
    const stationLat = location.latitude || null
    const stationLng = location.longitude || null

    let distance = null
    if (typeof userLat === 'number' && typeof userLng === 'number' && stationLat && stationLng) {
      distance = Math.round(this.haversineDistance(userLat, userLng, stationLat, stationLng) * 10) / 10
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
      gasoline_price: prices.gasoline_price !== undefined ? prices.gasoline_price : null,
      gasoline_95_price: prices.gasoline_95_price !== undefined ? prices.gasoline_95_price : null,
      gasoline_98_price: prices.gasoline_98_price !== undefined ? prices.gasoline_98_price : null,
      diesel_price: prices.diesel_price !== undefined ? prices.diesel_price : null,
      hvo100_price: prices.hvo100_price !== undefined ? prices.hvo100_price : null,
      fd_price: prices.fd_price !== undefined ? prices.fd_price : null,
      last_updated: prices.last_updated || null,
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
    const radius = config.radius || 5
    const endpoint = `${BASE_URL}/stations/fuel/nearby?lat=${config.latitude}&lng=${config.longitude}&radius=${radius}`

    if (config.debug) {
      console.log(`[MMM-FuelNorway] Fetching nearby: ${endpoint} (attempt ${attempt})`)
    }

    this.httpsGet(endpoint, (err, data) => {
      if (err) {
        const retryAttempts = config.retryAttempts || 3
        if (attempt < retryAttempts) {
          console.log(`[MMM-FuelNorway] Retry ${attempt}/${retryAttempts} after error: ${err.message}`)
          setTimeout(() => this.fetchNearby(config, attempt + 1), config.retryDelay || 5000)
        } else {
          this.sendSocketNotification('FUELNORWAY_ERROR', { message: err.message })
        }
        return
      }
      let stations
      try {
        stations = JSON.parse(data)
      } catch (_e) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Failed to parse API response' })
        return
      }
      if (!Array.isArray(stations)) {
        stations = [stations]
      }
      const normalized = stations.map((s) => this.normalizeStation(s, config.latitude, config.longitude))
      this.cache = normalized
      this.cacheTime = Date.now()
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
        const retryAttempts = (this.config && this.config.retryAttempts) || 3
        if (attempt < retryAttempts) {
          setTimeout(() => this.fetchStation(stationId, callback, attempt + 1), (this.config && this.config.retryDelay) || 5000)
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
    const ids = config.stationIds
    const results = []
    let completed = 0
    let hasError = false

    ids.forEach((stationId) => {
      this.fetchStation(stationId, (err, station) => {
        if (hasError) return
        if (err) {
          hasError = true
          this.sendSocketNotification('FUELNORWAY_ERROR', { message: `Failed to fetch station ${stationId}: ${err.message}` })
          return
        }
        results.push(this.normalizeStation(station, null, null))
        completed++
        if (completed === ids.length) {
          this.cache = results
          this.cacheTime = Date.now()
          this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', results)
        }
      })
    })
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
