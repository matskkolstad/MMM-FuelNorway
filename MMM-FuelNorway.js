'use strict'

Module.register('MMM-FuelNorway', {
  defaults: {
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
  },

  stationData: [],
  loading: true,
  error: null,
  updateTimer: null,

  getScripts() {
    return []
  },

  getStyles() {
    return ['MMM-FuelNorway.css']
  },

  getTranslations() {
    return {
      en: 'translations/en.json',
      no: 'translations/no.json',
      nb: 'translations/no.json',
      nn: 'translations/no.json'
    }
  },

  start() {
    Log.info(`[MMM-FuelNorway] Starting module`)
    this.stationData = []
    this.loading = true
    this.error = null
    this.sendSocketNotification('FUELNORWAY_FETCH_DATA', this.config)
    this.scheduleUpdate()
  },

  scheduleUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }
    this.updateTimer = setInterval(() => {
      this.loading = true
      this.updateDom()
      this.sendSocketNotification('FUELNORWAY_FETCH_DATA', this.config)
    }, this.config.updateInterval)
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FUELNORWAY_DATA_RECEIVED') {
      this.stationData = payload
      this.loading = false
      this.error = null
      this.updateDom()
    } else if (notification === 'FUELNORWAY_ERROR') {
      this.error = payload
      this.loading = false
      this.updateDom()
    }
  },

  getDom() {
    const wrapper = document.createElement('div')
    wrapper.className = 'MMM-FuelNorway'

    if (this.loading) {
      const loading = document.createElement('div')
      loading.className = 'mmm-fuelnorway-loading'
      loading.textContent = this.translate('LOADING')
      wrapper.appendChild(loading)
      return wrapper
    }

    if (this.error) {
      const errorEl = document.createElement('div')
      errorEl.className = 'mmm-fuelnorway-error'
      errorEl.textContent = this.translate('ERROR')
      wrapper.appendChild(errorEl)
      return wrapper
    }

    if (!this.stationData || this.stationData.length === 0) {
      const noData = document.createElement('div')
      noData.className = 'mmm-fuelnorway-empty'
      noData.textContent = this.translate('NO_STATIONS')
      wrapper.appendChild(noData)
      return wrapper
    }

    const container = document.createElement('div')
    const displayMode = this.config.displayMode === 'grid' ? 'mmm-fuelnorway-grid' : 'mmm-fuelnorway-list'
    const orientation = this.config.orientation === 'horizontal' ? 'mmm-fuelnorway-horizontal' : ''
    const size = `mmm-fuelnorway-${this.config.moduleSize}`
    container.className = [displayMode, orientation, size].filter(Boolean).join(' ')

    const cheapestByFuelType = this.findCheapest(this.stationData, this.config.fuelTypes)
    const stations = this.stationData.slice(0, this.config.maxStations)

    stations.forEach((station) => {
      const stationEl = this.buildStationElement(station, cheapestByFuelType)
      container.appendChild(stationEl)
    })

    wrapper.appendChild(container)
    return wrapper
  },

  findCheapest(stations, fuelTypes) {
    const cheapest = {}
    fuelTypes.forEach((fuelType) => {
      let minPrice = null
      stations.forEach((station) => {
        const price = station[fuelType]
        if (price !== null && price !== undefined) {
          if (minPrice === null || price < minPrice) {
            minPrice = price
          }
        }
      })
      cheapest[fuelType] = minPrice
    })
    return cheapest
  },

  buildStationElement(station, cheapestByFuelType) {
    const el = document.createElement('div')
    el.className = 'mmm-fuelnorway-station'

    if (this.config.showBrandLogo && station.logo) {
      const logoContainer = document.createElement('div')
      logoContainer.className = 'mmm-fuelnorway-logo'
      const logo = document.createElement('img')
      logo.src = station.logo
      logo.alt = station.name || ''
      logoContainer.appendChild(logo)
      el.appendChild(logoContainer)
    }

    const info = document.createElement('div')
    info.className = 'mmm-fuelnorway-info'

    if (this.config.showStationName && station.name) {
      const name = document.createElement('div')
      name.className = 'mmm-fuelnorway-name'
      name.textContent = station.name
      info.appendChild(name)
    }

    if (this.config.showAddress && station.address) {
      const address = document.createElement('div')
      address.className = 'mmm-fuelnorway-address'
      address.textContent = this.formatAddress(station.address, this.config.addressFormat)
      info.appendChild(address)
    }

    if (station.distance !== null && station.distance !== undefined) {
      const dist = document.createElement('div')
      dist.className = 'mmm-fuelnorway-distance'
      dist.textContent = `${Number(station.distance).toFixed(1)} ${this.translate('KM_AWAY')}`
      info.appendChild(dist)
    }

    el.appendChild(info)

    const prices = document.createElement('div')
    prices.className = 'mmm-fuelnorway-prices'

    this.config.fuelTypes.forEach((fuelType) => {
      const price = station[fuelType]
      const priceEl = document.createElement('div')
      const isCheapest = this.config.highlightCheapest && cheapestByFuelType[fuelType] !== null && price === cheapestByFuelType[fuelType]
      priceEl.className = 'mmm-fuelnorway-price' + (isCheapest ? ' mmm-fuelnorway-cheapest' : '')
      if (isCheapest) {
        priceEl.style.color = this.config.priceHighlightColor
      }

      const label = document.createElement('span')
      label.className = 'mmm-fuelnorway-fuel-label'
      label.textContent = this.getFuelLabel(fuelType)

      const value = document.createElement('span')
      value.className = 'mmm-fuelnorway-fuel-value'
      if (price !== null && price !== undefined) {
        value.textContent = this.formatPrice(price)
      } else {
        value.textContent = '-'
        priceEl.classList.add('mmm-fuelnorway-unavailable')
      }

      priceEl.appendChild(label)
      priceEl.appendChild(value)
      prices.appendChild(priceEl)
    })

    el.appendChild(prices)

    if (this.config.showLastUpdated && station.last_updated) {
      const updated = document.createElement('div')
      updated.className = 'mmm-fuelnorway-updated'
      updated.textContent = `${this.translate('LAST_UPDATED')}: ${this.formatTimestamp(station.last_updated, this.config.lastUpdatedFormat)}`
      el.appendChild(updated)
    }

    return el
  },

  formatAddress(address, format) {
    if (!address) return ''
    if (format === 'full') {
      return [address.street, address.zip, address.city].filter(Boolean).join(', ')
    }
    if (format === 'city') {
      return address.city || ''
    }
    return address.street || ''
  },

  formatPrice(price) {
    if (price === null || price === undefined) return '-'
    const formatted = Number(price).toFixed(this.config.decimalPlaces)
    if (this.config.compactPriceFormat) {
      return formatted
    }
    return `${formatted} ${this.config.currencyFormat}`
  },

  formatTimestamp(timestamp, format) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
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
  },

  getFuelLabel(fuelType) {
    const map = {
      gasoline_price: this.translate('FUEL_GASOLINE'),
      diesel_price: this.translate('FUEL_DIESEL'),
      hvo100_price: this.translate('FUEL_HVO100'),
      fd_price: this.translate('FUEL_FD')
    }
    return map[fuelType] || fuelType
  }
})
