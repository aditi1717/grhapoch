import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { diningAPI, restaurantAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import Loader from "@food/components/Loader"
import { toast } from "sonner"

const BOOKING_DRAFT_KEY = "food_dining_booking_draft_v1"

const buildDates = (count = 7) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return date
  })

const formatTimeValue = (value) => {
  if (!value) return null
  if (/[ap]m/i.test(value)) return value.toUpperCase()
  const date = new Date(`2000-01-01T${String(value).padStart(5, "0")}`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const parseTimeToMinutes = (value) => {
  if (!value) return null
  const raw = String(value).trim()

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmmMatch) {
    return Number(hhmmMatch[1]) * 60 + Number(hhmmMatch[2])
  }

  const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!meridiemMatch) return null

  let hour = Number(meridiemMatch[1])
  const minute = Number(meridiemMatch[2] || 0)
  const meridiem = meridiemMatch[3].toUpperCase()

  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0

  return hour * 60 + minute
}

const getDayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" })

const buildSlots = (timing) => {
  if (!timing || timing.isOpen === false) return []
  const opening = parseTimeToMinutes(timing.openingTime)
  let closing = parseTimeToMinutes(timing.closingTime)
  if (opening === null || closing === null) return []

  // Handle case where closing time is earlier than opening time (e.g., 2:00 AM next day)
  if (closing <= opening) {
    closing += 24 * 60
  }

  const slots = []
  let cursor = opening

  while (cursor <= closing) {
    const hours = Math.floor((cursor % (24 * 60)) / 60)
    const minutes = cursor % 60
    slots.push(formatTimeValue(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`))
    cursor += 30
  }

  return slots
}

const buildFallbackTiming = (restaurant) => {
  const openingTime = String(
    restaurant?.openingTime ||
      restaurant?.diningSettings?.openingTime ||
      "12:00",
  ).trim()
  const closingTime = String(
    restaurant?.closingTime ||
      restaurant?.diningSettings?.closingTime ||
      "23:00",
  ).trim()

  return {
    isOpen: true,
    openingTime,
    closingTime,
  }
}

const getMealPeriod = (slot) => {
  if (!slot) return "all"
  const normalized = String(slot).toUpperCase()
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
  if (!match) return "all"

  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3]

  if (meridiem === "PM" && hour !== 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0

  const totalMinutes = hour * 60 + minute
  if (totalMinutes < 11 * 60) return "breakfast"
  if (totalMinutes < 17 * 60) return "lunch"
  return "dinner"
}

const getMealLabel = (period) => {
  const normalized = String(period || "").toLowerCase()
  if (normalized === "breakfast") return "Breakfast"
  if (normalized === "lunch") return "Lunch"
  if (normalized === "dinner") return "Dinner"
  return "Meal"
}

const normalizeMealPeriods = (value, fallback = ["breakfast", "lunch", "dinner"]) => {
  const allowed = new Set(["breakfast", "lunch", "dinner"])
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())

  const normalized = [...new Set(
    source
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => allowed.has(item))
  )]

  return normalized.length > 0 ? normalized : [...fallback]
}

const buildMealOptions = (slots = [], allowedPeriods = ["breakfast", "lunch", "dinner"]) => {
  const order = ["breakfast", "lunch", "dinner"]
  const allowed = new Set(normalizeMealPeriods(allowedPeriods))
  const availablePeriods = new Set(slots.map((slot) => getMealPeriod(slot)).filter((period) => period !== "all"))
  return order.filter((period) => allowed.has(period) && availablePeriods.has(period))
}

export default function TableBooking() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()

  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null)
  const [loading, setLoading] = useState(!location.state?.restaurant)
  const [outletTimings, setOutletTimings] = useState({})
  const [selectedGuests, setSelectedGuests] = useState(location.state?.guestCount || 2)
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = location.state?.selectedDate ? new Date(location.state.selectedDate) : new Date()
    return Number.isNaN(initial.getTime()) ? new Date() : initial
  })
  const [selectedSlot, setSelectedSlot] = useState(location.state?.selectedTime || null)
  const [selectedMealPeriod, setSelectedMealPeriod] = useState("lunch")
  const [currentBookings, setCurrentBookings] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // Real-time update for slots filtering
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const fetchRestaurant = async () => {
    try {
      setLoading(true)
      const response = await diningAPI.getRestaurantBySlug(slug)
      if (response?.data?.success) {
        const apiRestaurant = response?.data?.data?.restaurant || response?.data?.data
        setRestaurant(apiRestaurant || null)

        const restaurantId = apiRestaurant?._id || apiRestaurant?.id || slug
        
        // Fetch Bookings for Availability check
        try {
            const bookingsRes = await diningAPI.getRestaurantBookingsPublic(restaurantId)
            if (bookingsRes.data.success) {
                setCurrentBookings(Array.isArray(bookingsRes.data.data) ? bookingsRes.data.data : [])
            }
        } catch (err) {
            console.error("Error fetching bookings:", err)
        }

        const timingsResponse = await restaurantAPI.getOutletTimingsByRestaurantId(restaurantId)
        setOutletTimings(timingsResponse?.data?.data?.outletTimings || {})
      }
    } catch {
      setRestaurant(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.restaurant) {
      const restaurantId = location.state.restaurant?._id || location.state.restaurant?.id || slug
      restaurantAPI
        .getOutletTimingsByRestaurantId(restaurantId)
        .then((response) => setOutletTimings(response?.data?.data?.outletTimings || {}))
        .catch(() => setOutletTimings({}))
      
      // Still fetch bookings even if restaurant is in state
      diningAPI.getRestaurantBookingsPublic(restaurantId)
        .then(res => {
            if (res.data.success) setCurrentBookings(Array.isArray(res.data.data) ? res.data.data : [])
        })
        .catch(() => {})

      setLoading(false)
      return
    }

    fetchRestaurant()
  }, [location.state?.restaurant, slug])

  const dates = useMemo(() => buildDates(7), [])
  const restaurantMealPeriods = useMemo(
    () => normalizeMealPeriods(restaurant?.diningSettings?.mealPeriods),
    [restaurant?.diningSettings?.mealPeriods]
  )
  const selectedDayTiming = useMemo(() => {
    const fromOutletTimings = outletTimings?.[getDayName(selectedDate)] || null
    if (fromOutletTimings && fromOutletTimings.isOpen !== false) {
      return fromOutletTimings
    }
    return buildFallbackTiming(restaurant)
  }, [outletTimings, selectedDate, restaurant])
  const allSlots = useMemo(() => buildSlots(selectedDayTiming), [selectedDayTiming])

  const maxCapacity = restaurant?.diningSettings?.maxGuests || 10

  const maxAvailableSeatsOnSelectedDate = useMemo(() => {
    const targetDateStr = selectedDate.toDateString()

    // ── DEBUG ──────────────────────────────────────────────────────────────
    console.log('[SeatCalc] selectedDate:', selectedDate.toISOString(), '| targetDateStr:', targetDateStr)
    console.log('[SeatCalc] maxCapacity:', maxCapacity, '| selectedSlot:', selectedSlot)
    console.log('[SeatCalc] currentBookings count:', currentBookings.length)
    currentBookings.forEach((b, i) => {
      console.log(`  Booking[${i}]: date=${new Date(b.date).toISOString()} (local=${new Date(b.date).toDateString()}) | slot="${b.timeSlot}" | guests=${b.guests} | status=${b.status}`)
    })
    // ──────────────────────────────────────────────────────────────────────

    if (allSlots.length === 0) return maxCapacity

    const getSlotRemaining = (slot) => {
      const slotOccupiedSeats = currentBookings
        .filter(b => {
          const bookingDateStr = new Date(b.date).toDateString()
          if (bookingDateStr !== targetDateStr) return false

          const bookingSlot = String(b.timeSlot || '').trim().toLowerCase()
          const targetSlot = String(slot).trim().toLowerCase()
          if (bookingSlot !== targetSlot) return false

          // Only count confirmed bookings — pending are not yet approved by restaurant
          const status = String(b.status || '').toLowerCase()
          return ['accepted', 'confirmed', 'checked-in'].includes(status)
        })
        .reduce((sum, b) => sum + (Number(b.guests) || 0), 0)

      console.log(`[SeatCalc] slot="${slot}" → occupied=${slotOccupiedSeats}, remaining=${Math.max(0, maxCapacity - slotOccupiedSeats)}`)
      return Math.max(0, maxCapacity - slotOccupiedSeats)
    }

    // If a slot is selected, show remaining for that specific slot
    if (selectedSlot) {
      return getSlotRemaining(selectedSlot)
    }

    // When no slot is selected, show full capacity — each slot enforces its own
    // remaining seats once the user picks one.
    return maxCapacity
  }, [allSlots, selectedDate, currentBookings, maxCapacity, selectedSlot])

  const remainingSeats = maxAvailableSeatsOnSelectedDate
  const occupiedSeats = Math.max(0, maxCapacity - remainingSeats)

  const availableSlots = useMemo(() => {
    const isToday = selectedDate.toDateString() === currentTime.toDateString()
    
    // 1. Filter out past slots for today
    let baseSlots = allSlots
    if (isToday) {
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
      const buffer = 15 // Allow booking at least 15 minutes ahead
      baseSlots = allSlots.filter((slot) => {
        const slotMinutes = parseTimeToMinutes(slot)
        return slotMinutes > currentMinutes + buffer
      })
    }

    // 2. Filter slots based on remaining seat capacity vs requested guests
    return baseSlots.filter((slot) => {
      const targetDateStr = selectedDate.toDateString()

      const slotOccupiedSeats = currentBookings
        .filter(b => {
          const bookingDateStr = new Date(b.date).toDateString()
          if (bookingDateStr !== targetDateStr) return false

          const bookingSlot = String(b.timeSlot || '').trim().toLowerCase()
          const targetSlot = String(slot).trim().toLowerCase()
          if (bookingSlot !== targetSlot) return false

          // Only count confirmed bookings — pending are not yet approved by restaurant
          const status = String(b.status || '').toLowerCase()
          return ['accepted', 'confirmed', 'checked-in'].includes(status)
        })
        .reduce((sum, b) => sum + (Number(b.guests) || 0), 0)

      const slotRemainingSeats = Math.max(0, maxCapacity - slotOccupiedSeats)
      return slotRemainingSeats >= selectedGuests
    })
  }, [allSlots, selectedDate, currentTime, currentBookings, maxCapacity, selectedGuests])

  const mealOptions = useMemo(
    () => buildMealOptions(availableSlots, restaurantMealPeriods),
    [availableSlots, restaurantMealPeriods]
  )

  const filteredSlots = useMemo(
    () => availableSlots.filter((slot) => getMealPeriod(slot) === selectedMealPeriod),
    [availableSlots, selectedMealPeriod]
  )

  useEffect(() => {
    if (mealOptions.length === 0) return
    if (!mealOptions.includes(selectedMealPeriod)) {
      setSelectedMealPeriod(mealOptions[0])
    }
  }, [mealOptions, selectedMealPeriod])

  useEffect(() => {
    if (!selectedSlot && filteredSlots.length > 0) {
      setSelectedSlot(filteredSlots[0])
      return
    }

    if (selectedSlot && filteredSlots.length > 0 && !filteredSlots.includes(selectedSlot)) {
      setSelectedSlot(filteredSlots[0])
      return
    }

    if (filteredSlots.length === 0) {
      setSelectedSlot(null)
    }
  }, [filteredSlots, selectedSlot])

  if (loading) return <Loader />
  if (!restaurant) return <div className="p-6 text-center">Restaurant not found</div>

  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false
  const canProceed = Boolean(isDiningEnabled && restaurant && selectedSlot && selectedDate && selectedGuests)

  const handleProceed = () => {
    if (!isDiningEnabled) {
      toast.error("Dining bookings are currently paused for this restaurant.")
      return
    }
    if (!canProceed) {
      toast.error("Please select date, time, and guests to continue.")
      return
    }

    const bookingDraft = {
      restaurant: {
        _id: restaurant?._id || restaurant?.id || restaurant?.restaurant?._id || restaurant?.restaurant?.id || null,
        id: restaurant?.id || restaurant?._id || restaurant?.restaurant?.id || restaurant?.restaurant?._id || null,
        name: restaurant?.name || restaurant?.restaurantName || "Restaurant",
        restaurantName: restaurant?.restaurantName || restaurant?.name || "Restaurant",
        profileImage: restaurant?.profileImage || restaurant?.restaurant?.profileImage || null,
        image: restaurant?.image || restaurant?.restaurant?.image || restaurant?.profileImage?.url || "",
        location: restaurant?.location || restaurant?.restaurant?.location || null,
        slug: restaurant?.slug || slug || "",
        diningSettings: restaurant?.diningSettings || restaurant?.restaurant?.diningSettings || null,
      },
      guests: selectedGuests,
      date: selectedDate,
      timeSlot: selectedSlot,
      mealPreference: selectedMealPeriod,
      mealPeriods: restaurantMealPeriods,
      discount: selectedSlot,
      specialRequest: location.state?.specialRequest || "",
      user: location.state?.user || null
    }

    try {
      sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(bookingDraft))
    } catch {}

    navigate("/food/user/dining/book-confirmation", { state: bookingDraft })
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f6fb] pb-32">
      {/* Compact header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#ffe7c6] via-[#fff1d7] to-[#f5f6fb] px-4 pb-5 pt-4">
        <div className="absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_65%)]" />

        <div className="relative z-10">
          <button
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#383838] shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="mt-3 text-center">
            <h1 className="text-2xl font-black tracking-tight text-[#25314a]">Book a table</h1>
            <p className="mt-0.5 text-xs font-medium text-[#636363]">{restaurant.name || restaurant.restaurantName}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-3 max-w-md space-y-3 px-4">
        {!isDiningEnabled && (
          <section className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold text-amber-900">Dining bookings are paused by this restaurant.</p>
            <p className="mt-0.5 text-xs text-amber-800">You can still view details, but new table bookings are disabled right now.</p>
          </section>
        )}

        {/* Guests */}
        <section className="rounded-[18px] bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-semibold text-[#2f3545]">Select number of guests</span>
            <span className="text-xs font-bold text-[#FFC107] bg-[#fdfafc] px-2 py-0.5 rounded-lg">
              {remainingSeats} left{selectedSlot ? ` · ${selectedSlot}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: maxCapacity }, (_, index) => {
              const count = index + 1
              const isTooLarge = count > remainingSeats

              return (
                <button
                  key={count}
                  disabled={isTooLarge}
                  onClick={() => setSelectedGuests(count)}
                  className={`flex h-9 items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                    selectedGuests === count
                      ? "border-[#ef8f98] bg-[#fffaf9] text-[#d64f63] shadow-sm"
                      : isTooLarge
                        ? "border-gray-50 bg-gray-50 text-gray-200 cursor-not-allowed"
                        : "border-[#ececf2] bg-white text-[#444b5f] hover:border-[#ef8f98]/30"
                  }`}
                >
                  {count}
                </button>
              )
            })}
          </div>
        </section>

        {/* Date */}
        <section className="rounded-[18px] bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <h3 className="text-xs font-semibold text-[#2f3545]">Select date</h3>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {dates.slice(0, 3).map((date, index) => {
              const active = selectedDate.toDateString() === date.toDateString()
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-[14px] border px-2 py-2.5 text-center transition-colors ${
                    active
                      ? "border-[#ef8f98] bg-[#fffaf9]"
                      : "border-[#ececf2] bg-white"
                  }`}
                >
                  <span className="block text-xs font-semibold text-[#444b5f]">
                    {index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#7b8191]">
                    {date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Meal preference */}
        <section className="rounded-[18px] bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <h3 className="text-xs font-semibold text-[#2f3545]">Choose meal preference</h3>

          <p className="mt-1 text-[10px] font-medium text-[#7b8191]">
            Available options are based on the restaurant's serving hours.
          </p>

          <div className="mt-2.5 flex gap-2">
            {(mealOptions.length > 0 ? mealOptions : restaurantMealPeriods).map((period) => {
              const label = getMealLabel(period)
              const active = selectedMealPeriod === period
              return (
                <button
                  key={period}
                  onClick={() => setSelectedMealPeriod(period)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#ef8f98] bg-white text-[#d64f63]"
                      : "border-[#ececf2] bg-[#fafafc] text-[#666f82]"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {filteredSlots.length === 0 ? (
              <div className="col-span-3 rounded-[14px] border border-dashed border-[#e5e7ef] px-4 py-5 text-center text-xs text-[#7c8394]">
                No {getMealLabel(selectedMealPeriod).toLowerCase()} slots available for the selected date.
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const active = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-[12px] border px-2 py-2.5 text-center transition-colors ${
                      active
                        ? "border-[#ef8f98] bg-[#fffaf9]"
                        : "border-[#ececf2] bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-[#334155]">{slot}</span>
                    <span className="mt-0.5 block text-[10px] font-medium text-[#2d5ea8]">
                      {getMealLabel(getMealPeriod(slot))}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-[14px] bg-white px-4 py-3 text-center shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
          <p className="text-xs text-[#6f7687]">
            Select your preferred time slot to view available booking options
          </p>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[70] border-t border-[#e6e7ef] bg-[#f5f6fb]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <Button
            disabled={!canProceed}
            onClick={handleProceed}
            className={`h-12 w-full rounded-xl text-base font-bold ${
              canProceed
                ? "bg-[#eb4d60] text-white hover:bg-[#d73f52]"
                : "bg-[#a4abba] text-white/95"
            }`}
          >
            {!isDiningEnabled
              ? "Dining paused"
              : canProceed
                ? "Proceed to confirmation"
                : "Select a time slot to proceed"}
          </Button>
        </div>
      </div>
    </AnimatedPage>
  )
}
