import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { MapPin, Search, Save, Loader2, ArrowLeft } from "lucide-react"
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const parseCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getSavedLocationCoords = (location) => {
  if (!location) return null

  let lat = null
  let lng = null

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = parseCoordinate(location.coordinates[0])
    lat = parseCoordinate(location.coordinates[1])
  }

  if (lat === null || lng === null) {
    lat = parseCoordinate(location.latitude)
    lng = parseCoordinate(location.longitude)
  }

  if (lat === null || lng === null) return null

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const swappedLat = lng
    const swappedLng = lat

    if (
      swappedLat >= -90 && swappedLat <= 90 &&
      swappedLng >= -180 && swappedLng <= 180
    ) {
      return { lat: swappedLat, lng: swappedLng }
    }

    return null
  }

  return { lat, lng }
}

export default function ZoneSetup() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const autocompleteServiceRef = useRef(null)
  const placesServiceRef = useRef(null)
  const geocoderRef = useRef(null)
  const suggestionsDebounceRef = useRef(null)
  const zonePolygonsRef = useRef([])
  const serviceZonesRef = useRef([])
  const lastValidLocationRef = useRef(null)
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [serviceZones, setServiceZones] = useState([])
  const [zoneValidationMessage, setZoneValidationMessage] = useState("")
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedAddress, setSelectedAddress] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mapError, setMapError] = useState("")
  const [zonesDrawnCount, setZonesDrawnCount] = useState(0)
  const [isSelectedInZone, setIsSelectedInZone] = useState(false)

  const OUTSIDE_ZONE_MESSAGE =
    "Selected location is outside the service zone. Please pin inside a blue zone boundary."

  useEffect(() => {
    fetchRestaurantData()
    fetchServiceZones()
    loadGoogleMaps()
  }, [])

  const fetchServiceZones = async () => {
    try {
      const response = await zoneAPI.getPublicZones()
      const zones =
        (response?.data?.success && Array.isArray(response?.data?.data?.zones)
          ? response.data.data.zones
          : null) ||
        response?.data?.data?.zones ||
        response?.data?.zones ||
        []
      const list = Array.isArray(zones) ? zones.filter((zone) => zone?.isActive !== false) : []
      serviceZonesRef.current = list
      setServiceZones(list)
    } catch (error) {
      debugWarn("Failed to load service zones:", error)
      serviceZonesRef.current = []
      setServiceZones([])
    }
  }

  const getZonePaths = (zone) => {
    const coordinates = Array.isArray(zone?.coordinates) ? zone.coordinates : []
    return coordinates
      .map((coord) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const lng = Number(coord[0])
          const lat = Number(coord[1])
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
          return null
        }
        const lat = Number(coord?.latitude ?? coord?.lat)
        const lng = Number(coord?.longitude ?? coord?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { lat, lng }
      })
      .filter(Boolean)
  }

  const isPointInZonePolygon = (lat, lng, polygon = []) => {
    if (!Array.isArray(polygon) || polygon.length < 3) return false
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = Number(polygon[i]?.longitude ?? polygon[i]?.lng)
      const yi = Number(polygon[i]?.latitude ?? polygon[i]?.lat)
      const xj = Number(polygon[j]?.longitude ?? polygon[j]?.lng)
      const yj = Number(polygon[j]?.latitude ?? polygon[j]?.lat)
      if (![xi, yi, xj, yj].every(Number.isFinite)) continue
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  const findLocalZoneAt = (lat, lng) => {
    const zones = serviceZonesRef.current
    if (!Array.isArray(zones) || zones.length === 0) return null
    return (
      zones.find((zone) => isPointInZonePolygon(lat, lng, zone?.coordinates)) || null
    )
  }

  const drawServiceZonesOnMap = (map, zones = serviceZonesRef.current, focusPoints = []) => {
    if (!map || !window.google?.maps) return 0

    zonePolygonsRef.current.forEach((polygon) => {
      if (polygon) polygon.setMap(null)
    })
    zonePolygonsRef.current = []

    const bounds = new window.google.maps.LatLngBounds()
    let drawnCount = 0

    ;(Array.isArray(zones) ? zones : []).forEach((zone) => {
      const path = getZonePaths(zone)
      if (path.length < 3) return

      path.forEach((point) => bounds.extend(point))

      const polygon = new window.google.maps.Polygon({
        paths: path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
        clickable: false,
        zIndex: 1,
      })
      polygon.setMap(map)
      zonePolygonsRef.current.push(polygon)
      drawnCount += 1
    })

    ;(Array.isArray(focusPoints) ? focusPoints : []).forEach((point) => {
      if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) {
        bounds.extend(point)
      }
    })

    if (!bounds.isEmpty()) {
      if (drawnCount > 0 || focusPoints.length > 0) {
        map.fitBounds(bounds, 56)
      }
    }

    return drawnCount
  }

  const validateZoneAt = async (lat, lng) => {
    const localZone = findLocalZoneAt(lat, lng)
    if (serviceZonesRef.current.length > 0) {
      if (!localZone) {
        setZoneValidationMessage(OUTSIDE_ZONE_MESSAGE)
        setIsSelectedInZone(false)
        return { ok: false, message: OUTSIDE_ZONE_MESSAGE }
      }
      const zoneName = localZone.name || localZone.zoneName || "Service zone"
      setZoneValidationMessage("")
      setIsSelectedInZone(true)
      return { ok: true, zoneId: String(localZone._id), zoneName }
    }

    try {
      const response = await zoneAPI.detectZone(lat, lng)
      const payload = response?.data?.data
      const isInService = payload?.status === "IN_SERVICE" && !!payload?.zoneId
      if (isInService) {
        const zoneName =
          payload?.zone?.name ||
          payload?.zone?.zoneName ||
          payload?.zoneName ||
          "Service zone"
        setZoneValidationMessage("")
        setIsSelectedInZone(true)
        return { ok: true, zoneId: String(payload.zoneId), zoneName }
      }
      setZoneValidationMessage(OUTSIDE_ZONE_MESSAGE)
      setIsSelectedInZone(false)
      return { ok: false, message: OUTSIDE_ZONE_MESSAGE }
    } catch (error) {
      debugError("Zone validation failed:", error)
      const message = "Could not verify zone for this location. Please try again."
      setZoneValidationMessage(message)
      setIsSelectedInZone(false)
      return { ok: false, message }
    }
  }

  useEffect(() => {
    return () => {
      if (suggestionsDebounceRef.current) {
        clearTimeout(suggestionsDebounceRef.current)
        suggestionsDebounceRef.current = null
      }
    }
  }, [])

  const isCoordinateAddress = (value) => {
    const text = String(value || "").trim()
    if (!text) return true
    return /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(text)
  }

  const normalizeAddressLabel = (value) => {
    const text = String(value || "").trim()
    if (!text || isCoordinateAddress(text)) return ""
    return text
  }

  const ensurePlacesLibrary = async () => {
    if (!window.google?.maps) return false
    try {
      if (!window.google.maps.places && typeof window.google.maps.importLibrary === "function") {
        await window.google.maps.importLibrary("places")
      }
      return Boolean(window.google.maps.places)
    } catch (error) {
      debugError("Failed to load Google Places library:", error)
      return false
    }
  }

  const reverseGeocodeCoordinates = async (lat, lng) => {
    if (!window.google?.maps) return ""

    try {
      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder()
      }

      const result = await geocoderRef.current.geocode({
        location: { lat, lng }
      })

      const formatted = result?.results?.[0]?.formatted_address || ""
      return normalizeAddressLabel(formatted)
    } catch (error) {
      debugWarn("Reverse geocode failed:", error)
      return ""
    }
  }

  const applySelectedLocation = async (lat, lng, rawAddress = "", { showAlert = true } = {}) => {
    const zoneCheck = await validateZoneAt(lat, lng)
    if (!zoneCheck.ok) {
      if (showAlert) alert(zoneCheck.message || OUTSIDE_ZONE_MESSAGE)
      return false
    }

    const address = normalizeAddressLabel(rawAddress) || "Pinned location on map"
    setLocationSearch(address)
    setSelectedAddress(address)
    const nextLocation = { lat, lng, address, zoneId: zoneCheck.zoneId, zoneName: zoneCheck.zoneName }
    setSelectedLocation(nextLocation)
    lastValidLocationRef.current = { lat, lng, address }
    setIsSelectedInZone(true)
    setShowSuggestions(false)
    setSearchSuggestions([])
    if (mapInstanceRef.current && window.google?.maps) {
      updateMarker(lat, lng, address)
    }
    return true
  }

  const handleSuggestionSelect = async (suggestion) => {
    if (!suggestion) return

    // Fallback suggestions (e.g. Nominatim) can directly provide coordinates.
    const fallbackLat = Number(suggestion.lat)
    const fallbackLng = Number(suggestion.lng)
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: fallbackLat, lng: fallbackLng })
        mapInstanceRef.current.setZoom(17)
      }
      await applySelectedLocation(fallbackLat, fallbackLng, suggestion.description || suggestion.main_text || "")
      return
    }

    if (!suggestion?.place_id || !placesServiceRef.current) return

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ["geometry", "formatted_address", "name"]
      },
      async (place, status) => {
        if (
          status === window.google?.maps?.places?.PlacesServiceStatus?.OK &&
          place?.geometry?.location &&
          mapInstanceRef.current
        ) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const address = place.formatted_address || place.name || ""
          mapInstanceRef.current.setCenter({ lat, lng })
          mapInstanceRef.current.setZoom(17)
          await applySelectedLocation(lat, lng, address)
        }
      }
    )
  }

  const fetchSearchSuggestions = async (query) => {
    const q = String(query || "").trim()
    if (!q) {
      setSearchSuggestions([])
      return
    }

    if (autocompleteServiceRef.current) {
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: q,
          componentRestrictions: { country: "in" },
          types: ["geocode"]
        },
        (predictions = [], status) => {
          const ok = status === window.google?.maps?.places?.PlacesServiceStatus?.OK
          setSearchSuggestions(ok ? predictions.slice(0, 6) : [])
        }
      )
      return
    }

    // Fallback: lightweight suggestions from Nominatim when Google Places is unavailable.
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      )
      if (!response.ok) throw new Error(`Nominatim ${response.status}`)
      const rows = await response.json()
      const normalized = Array.isArray(rows)
        ? rows.map((item, idx) => ({
            place_id: `nominatim-${item.place_id || idx}`,
            description: item.display_name || "",
            main_text: String(item.display_name || "").split(",")[0] || "Location",
            lat: Number(item.lat),
            lng: Number(item.lon)
          }))
        : []
      setSearchSuggestions(normalized)
    } catch (error) {
      debugWarn("Fallback suggestions failed:", error)
      setSearchSuggestions([])
    }
  }

  const handleSearchChange = (event) => {
    const value = event.target.value
    setLocationSearch(value)
    setShowSuggestions(true)

    if (suggestionsDebounceRef.current) {
      clearTimeout(suggestionsDebounceRef.current)
      suggestionsDebounceRef.current = null
    }

    suggestionsDebounceRef.current = setTimeout(() => {
      fetchSearchSuggestions(value).catch(() => {})
    }, 180)
  }

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    let isMounted = true

    const setupPlaces = async () => {
      if (mapLoading || !autocompleteInputRef.current || autocompleteRef.current) {
        return
      }

      const placesReady = await ensurePlacesLibrary()
      if (!isMounted || !placesReady) return

      if (window.google?.maps?.places?.AutocompleteService) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      }
      if (window.google?.maps?.places?.PlacesService) {
        const host = mapInstanceRef.current || document.createElement("div")
        placesServiceRef.current = new window.google.maps.places.PlacesService(host)
      }

      if (window.google?.maps?.places?.Autocomplete) {
        const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
          componentRestrictions: { country: "in" }
        })

        autocomplete.addListener("place_changed", async () => {
          const place = autocomplete.getPlace()
          if (place.geometry && place.geometry.location) {
            const location = place.geometry.location
            const lat = location.lat()
            const lng = location.lng()
            const address = place.formatted_address || place.name || ""
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(location)
              mapInstanceRef.current.setZoom(17)
            }
            await applySelectedLocation(lat, lng, address)
          }
        })

        autocompleteRef.current = autocomplete
      }
    }

    setupPlaces()
    return () => {
      isMounted = false
    }
  }, [mapLoading])

  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading || !window.google?.maps) return

    const focusPoints = []
    if (restaurantData?.location) {
      const savedCoords = getSavedLocationCoords(restaurantData.location)
      if (savedCoords) focusPoints.push(savedCoords)
    }

    const drawn = drawServiceZonesOnMap(mapInstanceRef.current, serviceZones, focusPoints)
    setZonesDrawnCount(drawn)
  }, [serviceZones, mapLoading, restaurantData])

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location
      const savedCoords = getSavedLocationCoords(location)

      if (savedCoords) {
        const { lat, lng } = savedCoords
        const address = normalizeAddressLabel(
          location.formattedAddress || location.address || formatAddress(location) || ""
        )
        setLocationSearch(address)
        setSelectedAddress(address)

        updateMarker(lat, lng, address)
        void applySelectedLocation(lat, lng, address, { showAlert: false })
      }
    }
  }, [restaurantData, mapLoading])

  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
      }
    } catch (error) {
      debugError("Error fetching restaurant data:", error)
    }
  }

  const loadGoogleMaps = async () => {
    try {
      debugLog("?? Starting Google Maps load...")
      
      // Fetch API key from database
      let apiKey = null
      try {
        apiKey = await getGoogleMapsApiKey()
        debugLog("?? API Key received:", apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : "No")
        
        if (!apiKey || apiKey.trim() === "") {
          debugError("? API key is empty or not found in database")
          setMapLoading(false)
          setMapError("Map unavailable: Google Maps API key missing. Search suggestions still work.")
          return
        }
      } catch (apiKeyError) {
        debugError("? Error fetching API key from database:", apiKeyError)
        setMapLoading(false)
        setMapError("Map unavailable right now. Search suggestions still work.")
        return
      }
      
      setGoogleMapsApiKey(apiKey)
      
      // Wait for Google Maps to be loaded from main.jsx if it's loading
      let retries = 0
      const maxRetries = 100 // Wait up to 10 seconds
      
      debugLog("?? Waiting for Google Maps to load from main.jsx...")
      while (!window.google && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      // Wait for mapRef to be available (retry mechanism)
      let refRetries = 0
      const maxRefRetries = 50 // Wait up to 5 seconds for ref
      while (!mapRef.current && refRetries < maxRefRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        refRetries++
      }

      if (!mapRef.current) {
        debugError("? mapRef.current is still null after waiting")
        setMapLoading(false)
        setMapError("Map failed to initialize. Search suggestions still work.")
        return
      }

      // If Google Maps is already loaded, use it directly
      if (window.google && window.google.maps) {
        debugLog("? Google Maps already loaded from main.jsx, initializing map...")
        initializeMap(window.google)
        return
      }

      // If Google Maps is not loaded yet and we have an API key, use Loader as fallback
      if (apiKey) {
        debugLog("?? Google Maps not loaded from main.jsx, loading with Loader...")
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        })

        const google = await loader.load()
        debugLog("? Google Maps loaded via Loader, initializing map...")
        initializeMap(google)
      } else {
        debugError("? No API key available")
        setMapLoading(false)
        setMapError("Map unavailable right now. Search suggestions still work.")
      }
    } catch (error) {
      debugError("? Error loading Google Maps:", error)
      setMapLoading(false)
      setMapError("Failed to load map. Search suggestions still work.")
    }
  }

  const initializeMap = (google) => {
    try {
      if (!mapRef.current) {
        debugError("? mapRef.current is null in initializeMap")
        setMapLoading(false)
        return
      }

      debugLog("?? Initializing map...")
      // Initial location (India center)
      const initialLocation = { lat: 20.5937, lng: 78.9629 }

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false,
      })

      mapInstanceRef.current = map
      setMapError("")
      const drawn = drawServiceZonesOnMap(map, serviceZonesRef.current)
      setZonesDrawnCount(drawn)
      debugLog("? Map initialized successfully")

      // Add click listener to place marker
      map.addListener('click', async (event) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        const address = await reverseGeocodeCoordinates(lat, lng)
        await applySelectedLocation(lat, lng, address)
      })

      setMapLoading(false)
      debugLog("? Map loading complete")
    } catch (error) {
      debugError("? Error in initializeMap:", error)
      setMapLoading(false)
      setMapError("Map failed to initialize. Search suggestions still work.")
    }
  }

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })

    // Update location when marker is dragged
    marker.addListener('dragend', async (event) => {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      const newAddress = await reverseGeocodeCoordinates(newLat, newLng)
      const ok = await applySelectedLocation(newLat, newLng, newAddress)
      if (!ok && lastValidLocationRef.current && markerRef.current) {
        const { lat, lng } = lastValidLocationRef.current
        markerRef.current.setPosition({ lat, lng })
      }
    })

    markerRef.current = marker
  }

  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim()
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    if (location.state) parts.push(location.state.trim())
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim())
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const getCurrentPinCoordinates = () => {
    if (markerRef.current?.getPosition) {
      const position = markerRef.current.getPosition()
      if (position) {
        return { lat: position.lat(), lng: position.lng() }
      }
    }
    if (selectedLocation?.lat != null && selectedLocation?.lng != null) {
      return { lat: selectedLocation.lat, lng: selectedLocation.lng }
    }
    return null
  }

  const handleSaveLocation = async () => {
    const coords = getCurrentPinCoordinates()
    if (!coords) {
      alert("Please select a location on the map first")
      return
    }

    const zoneCheck = await validateZoneAt(coords.lat, coords.lng)
    if (!zoneCheck.ok) {
      alert(zoneCheck.message || OUTSIDE_ZONE_MESSAGE)
      if (lastValidLocationRef.current && markerRef.current) {
        const { lat, lng } = lastValidLocationRef.current
        markerRef.current.setPosition({ lat, lng })
      }
      return
    }

    try {
      setSaving(true)

      const { lat, lng } = coords
      const address =
        normalizeAddressLabel(selectedLocation?.address || selectedAddress) ||
        "Pinned location on map"
      const hasPublishedLocation = Boolean(getSavedLocationCoords(restaurantData?.location))

      const response = await restaurantAPI.updateProfile({
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat],
          formattedAddress: address,
        },
        zoneId: zoneCheck.zoneId,
      })

      if (response?.data?.data?.restaurant) {
        setRestaurantData(response.data.data.restaurant)
        if (hasPublishedLocation) {
          alert("Location update submitted for admin approval. Customers will continue to see your current address until it is approved.")
        } else {
          alert("Location saved successfully!")
        }
        window.dispatchEvent(new CustomEvent("addressUpdated"))
      } else {
        throw new Error("Failed to save location")
      }
    } catch (error) {
      debugError("Error saving location:", error)
      alert(error.response?.data?.message || "Failed to save location. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const coords = getCurrentPinCoordinates()
    if (!coords || serviceZones.length === 0) return
    void validateZoneAt(coords.lat, coords.lng)
  }, [serviceZones])

  const locationUpdateStatus = String(restaurantData?.locationUpdateStatus || "none").toLowerCase()
  const hasPendingLocationUpdate = locationUpdateStatus === "pending"
  const pendingLocationLabel =
    restaurantData?.pendingLocation?.formattedAddress ||
    restaurantData?.pendingLocation?.address ||
    formatAddress(restaurantData?.pendingLocation) ||
    ""

  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            {/* Back Button */}
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zone Setup</h1>
              <p className="text-sm text-gray-600">Set your restaurant location on the map</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          {hasPendingLocationUpdate ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Location update pending admin approval.
              {pendingLocationLabel ? ` Requested address: ${pendingLocationLabel}` : ""}
              {" "}Customers still see your current approved address.
            </div>
          ) : null}
          {zoneValidationMessage ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {zoneValidationMessage}
            </div>
          ) : null}
          <p className="mb-3 text-xs text-gray-500">
            Blue shaded areas are admin service zones. Pin your restaurant inside a zone boundary.
            {serviceZones.length > 0
              ? ` ${zonesDrawnCount > 0 ? `${zonesDrawnCount} zone(s) visible on map.` : `${serviceZones.length} zone(s) loaded — zoom or pan if not visible.`}`
              : " No active zones loaded yet."}
          </p>
          {mapError ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {mapError}
            </div>
          ) : null}
          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteInputRef}
                type="text"
                value={locationSearch}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (searchSuggestions.length > 0) setShowSuggestions(true)
                }}
                placeholder="Search for your restaurant location..."
                className="w-full pl-10 pr-3 sm:pr-4 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-64 overflow-y-auto">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.place_id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-b-0 border-gray-100"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <p className="text-sm text-gray-800 truncate">
                        {suggestion.structured_formatting?.main_text || suggestion.main_text || suggestion.description}
                      </p>
                      {(suggestion.structured_formatting?.secondary_text || suggestion.description) && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {suggestion.structured_formatting?.secondary_text || suggestion.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSaveLocation}
              disabled={!selectedLocation || !isSelectedInZone || saving}
              className="shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline sm:inline">Save</span>
                  <span className="hidden sm:inline">Location</span>
                </>
              )}
            </button>
          </div>
          {selectedLocation && (
            <div className={`mt-3 p-3 rounded-lg border ${isSelectedInZone ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200"}`}>
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong>{" "}
                {normalizeAddressLabel(selectedAddress) || "Pinned location on map"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
              {!isSelectedInZone ? (
                <p className="text-xs text-rose-700 mt-2 font-medium">
                  This pin is outside the service zone. Move it inside a blue zone to save.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to set your location:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Search for your location using the search bar above, or</li>
            <li>Click anywhere on the map to place a pin at that location</li>
            <li>You can drag the pin to adjust the exact position</li>
            <li>Click "Save Location" to save your restaurant location</li>
          </ul>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Always render the map div, show loading overlay on top */}
          <div ref={mapRef} className="w-full h-[600px]" style={{ minHeight: '600px' }} />
          {mapLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-400 mt-2">If this takes too long, please refresh the page</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

