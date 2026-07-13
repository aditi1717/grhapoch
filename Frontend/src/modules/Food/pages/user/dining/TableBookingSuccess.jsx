import { useLocation, useNavigate } from "react-router-dom"
import { CheckCircle2, Calendar, Clock, Users, MapPin, Share2, Home, List, Info, Utensils } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { useEffect } from "react"

const getMediaUrl = (value) => {
    if (!value) return "";
    // If it's an object (e.g. profileImage: { url: "..." })
    if (typeof value === 'object') {
        const raw = value?.url || value?.secure_url || value?.imageUrl || value?.src || "";
        return getMediaUrl(raw);
    }
    if (typeof value !== 'string') return "";
    if (value.startsWith('http')) return value;
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
    const origin = apiBase.split('/api/v1')[0];
    return `${origin}${value.startsWith('/') ? value : '/' + value}`;
}

export default function TableBookingSuccess() {
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        // Trigger confetti on mount
        const duration = 3 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

        const randomInRange = (min, max) => Math.random() * (max - min) + min

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now()

            if (timeLeft <= 0) {
                return clearInterval(interval)
            }

            const particleCount = 50 * (timeLeft / duration)
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 250)

        return () => clearInterval(interval)
    }, [])

    const rawBooking = location.state?.booking || null
    const restaurantRef = location.state?.restaurantRef || null

    // Resolve the restaurant object from all possible sources
    const resolveRestaurant = () => {
        // Priority 1: backend-populated restaurant on booking
        const fromBooking = rawBooking?.restaurant
        // Priority 2: the restaurant ref passed from the confirmation page
        const fromRef = restaurantRef

        const source = fromBooking || fromRef || null
        if (!source) return null

        // Normalize all possible field name variations
        const name =
            source.name ||
            source.restaurantName ||
            source.restaurant?.name ||
            source.restaurant?.restaurantName ||
            ''

        const image =
            source.image ||
            source.logo ||
            source.profileImage ||
            source.coverImage ||
            source.restaurantImage ||
            (Array.isArray(source.coverImages) && source.coverImages[0]) ||
            (typeof source.profileImage === 'object' ? source.profileImage?.url : null) ||
            ''

        const location =
            source.location ||
            source.address ||
            source.formattedAddress ||
            ''

        return { ...source, name, image, location }
    }

    const booking = rawBooking || {
        bookingId: "—",
        status: "pending",
        date: new Date(),
        timeSlot: "—",
        guests: 1,
    }

    const restaurant = resolveRestaurant() || booking.restaurant || null

    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <AnimatedPage className="bg-white dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-4 pb-6 transition-colors">
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-14 h-14 ${booking.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-[#F9F9FB] dark:bg-slate-900'} rounded-full flex items-center justify-center mb-4 transition-colors`}
            >
                {booking.status === 'pending' ? (
                    <Clock className="w-8 h-8 text-amber-500" />
                ) : (
                    <CheckCircle2 className="w-8 h-8 text-gray-900 dark:text-slate-100" />
                )}
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-1.5 mb-6"
            >
                <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100">
                    {booking.status === 'pending' ? 'Booking Requested!' : 'Seat Confirmed!'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium tracking-wide italic">
                    {booking.status === 'pending' ? 'Waiting for restaurant approval' : 'Your table is ready for you'}
                </p>
                <div className="pt-1">
                    <span className="bg-[#F9F9FB] dark:bg-slate-900 text-gray-900 dark:text-slate-100 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest border border-gray-200 dark:border-slate-700">
                        BOOKING ID: {booking.bookingId}
                    </span>
                </div>

                {booking.status === 'pending' && (
                    <div className="mt-4 mx-auto max-w-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-left flex gap-2.5 shadow-sm shadow-amber-100/50 dark:shadow-none transition-colors">
                        <div className="bg-amber-100 p-1.5 rounded-lg h-fit">
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900 dark:text-amber-300 text-xs">Waiting for Confirmation</p>
                            <p className="text-amber-700 dark:text-amber-400/80 text-[10px] mt-0.5 leading-relaxed">
                                The restaurant will review and approve your request shortly. You'll be notified of the status.
                            </p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Ticket Card */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-full max-w-xs bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200 dark:shadow-none transition-colors"
            >
                <div className="p-4 space-y-4 relative">
                    {/* Circle cutouts for ticket look */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>

                    <div className="flex items-center gap-3 text-left">
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex-shrink-0 p-0.5 relative flex items-center justify-center">
                            <Utensils className="w-6 h-6 text-slate-300 dark:text-slate-600 absolute" />
                            {restaurant?.image ? (
                                <img
                                    src={getMediaUrl(restaurant.image)}
                                    className="w-full h-full object-cover rounded-lg relative z-10"
                                    alt={restaurant.name || 'restaurant'}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                    }}
                                />
                            ) : null}
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-black text-sm text-gray-900 dark:text-slate-100 truncate">
                                {restaurant?.name || '—'}
                            </h2>
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">
                                    {typeof restaurant?.location === 'string'
                                        ? restaurant.location
                                        : (restaurant?.location?.formattedAddress || restaurant?.location?.address || `${restaurant?.location?.city || ''}${restaurant?.location?.area ? ', ' + restaurant.location.area : ''}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                     <div className="grid grid-cols-2 gap-3 py-4 border-y border-dashed border-slate-200 dark:border-slate-800 text-left">
                        <div className="space-y-0.5">
                            <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Date</p>
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 dark:text-slate-200">
                                <Calendar className="w-3.5 h-3.5 text-red-500" />
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Time</p>
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 dark:text-slate-200">
                                <Clock className="w-3.5 h-3.5 text-red-500" />
                                <span>{booking.timeSlot}</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Guests</p>
                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 dark:text-slate-200">
                                <Users className="w-3.5 h-3.5 text-red-500" />
                                <span>{booking.guests} People</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Status</p>
                            <div className={`${booking.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'} px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest w-fit uppercase`}>
                                {booking.status === 'pending' ? 'PENDING' : 'CONFIRMED'}
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 w-full max-w-xs space-y-2.5"
            >
                <Button
                    onClick={() => navigate("/food/user/bookings")}
                    className="w-full h-11 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-100 flex items-center justify-center gap-1.5"
                >
                    <List className="w-4 h-4" />
                    View My Bookings
                </Button>
                <Button
                    onClick={() => navigate("/food/user")}
                    variant="outline"
                    className="w-full h-11 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-all flex items-center justify-center gap-1.5"
                >
                    <Home className="w-4 h-4" />
                    Go to Home
                </Button>
            </motion.div>

            <p className="mt-4 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-6 text-center">
                Show this ticket at the restaurant for a smooth entry
            </p>
        </AnimatedPage>
    )
}
