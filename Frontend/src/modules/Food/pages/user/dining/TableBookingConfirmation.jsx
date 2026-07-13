import { useMemo, useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, Users, MapPin, Ticket, ChevronRight, Edit2, ShieldCheck, Info, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { diningAPI, authAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { toast } from "sonner"
import Loader from "@food/components/Loader"

const debugError = (...args) => {}

const BOOKING_DRAFT_KEY = "food_dining_booking_draft_v1"

export default function TableBookingConfirmation() {
    const location = useLocation()
    const navigate = useNavigate()
    const goBack = useAppBackNavigation()

    const fallbackDraft = useMemo(() => {
        try {
            const raw = sessionStorage.getItem(BOOKING_DRAFT_KEY)
            return raw ? JSON.parse(raw) : null
        } catch {
            return null
        }
    }, [])

    const resolvedState = location.state || fallbackDraft || {}
    const { restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods } = resolvedState

    const [specialRequest, setSpecialRequest] = useState(() => resolvedState?.specialRequest || fallbackDraft?.specialRequest || "")
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [showUserModal, setShowUserModal] = useState(false)
    const [showPolicyModal, setShowPolicyModal] = useState(false)
    const [policyType, setPolicyType] = useState("")
    const [tempRequest, setTempRequest] = useState("")
    const [tempUser, setTempUser] = useState({ name: "", phone: "" })
    const [user, setUser] = useState(() => resolvedState?.user || fallbackDraft?.user || null)
    
    const handleTempUserNameChange = (e) => {
        const value = e.target.value;
        const filteredValue = value.replace(/[^a-zA-Z\s]/g, "");
        setTempUser({ ...tempUser, name: filteredValue });
    };
    
    const handleTempUserPhoneChange = (e) => {
        const value = e.target.value;
        const filteredValue = value.replace(/\D/g, "").slice(0, 10);
        setTempUser({ ...tempUser, phone: filteredValue });
    };
    
    const isValidTempName = tempUser.name.trim().length > 0;
    const isValidTempPhone = tempUser.phone.length === 10;
    const [loading, setLoading] = useState(true)
    const [bookingInProgress, setBookingInProgress] = useState(false)

    // Sync state to sessionStorage
    useEffect(() => {
        if (!restaurant) return
        try {
            const currentDraft = { restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, specialRequest, user }
            sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(currentDraft))
        } catch (err) {
            debugError("Error saving draft to session:", err)
        }
    }, [restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, specialRequest, user])

    // Fetch logged-in user on mount
    useEffect(() => {
        if (!restaurant) {
            navigate("/food/user/dining")
            return
        }

        const fetchUser = async () => {
            try {
                const response = await authAPI.getCurrentUser()
                if (response.data.success) {
                    const userData =
                        response?.data?.data?.user ||
                        response?.data?.data ||
                        response?.data?.user ||
                        null

                    setUser((prevUser) => {
                        if (prevUser && (prevUser.name || prevUser.phone)) {
                            return { ...userData, ...prevUser }
                        }
                        return userData
                    })
                }
            } catch (error) {
                debugError("Error fetching user:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchUser()
    }, [restaurant, navigate])

    const handleBooking = async () => {
        try {
            setBookingInProgress(true)
            const restaurantId =
                restaurant?._id ||
                restaurant?.id ||
                restaurant?.restaurant?._id ||
                restaurant?.restaurant?.id ||
                restaurant?.restaurantId ||
                null

            if (!restaurantId) {
                toast.error("Unable to proceed. Restaurant ID is missing.")
                return
            }

            const response = await diningAPI.createBooking({
                restaurant: restaurantId,
                restaurantRef: restaurant,
                userRef: user,
                guests,
                date,
                timeSlot,
                mealPreference,
                mealPeriods,
                specialRequest
            })

            if (response.data.success) {
                toast.success("Table booked successfully!")
                try {
                    sessionStorage.removeItem(BOOKING_DRAFT_KEY)
                } catch {}
                // Merge the frontend restaurant ref as fallback so success page always shows correct data
                const bookingData = response.data.data
                if (bookingData && !bookingData.restaurant && restaurant) {
                    bookingData.restaurant = restaurant
                }
                navigate("/food/user/dining/book-success", { state: { booking: bookingData, restaurantRef: restaurant } })
            }
        } catch (error) {
            debugError("Booking error:", error)
            toast.error(error.response?.data?.message || "Failed to confirm booking")
        } finally {
            setBookingInProgress(false)
        }
    }

    if (loading) return <Loader />

    const bookingDate = new Date(date)
    const formattedDate = Number.isNaN(bookingDate.getTime())
        ? "Today"
        : bookingDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

    return (
        <AnimatedPage className="bg-slate-50 dark:bg-slate-950 min-h-screen pb-20 transition-colors">
            {/* Header */}
            <div className="bg-slate-900 text-white px-3 py-2.5 sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={goBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <p className="font-semibold text-xs leading-snug">Reach the restaurant 15 minutes before your booking time for a hassle-free experience</p>
                </div>
            </div>

            <div className="p-3.5 space-y-3">
                {/* Booking Summary Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-3.5 space-y-3.5">
                        {/* Restaurant Name and Address */}
                        <div className="flex items-start gap-3">
                            <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-xl shrink-0">
                                <MapPin className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="font-bold text-sm text-gray-900 dark:text-slate-100 leading-tight truncate">{restaurant.name}</h2>
                                <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5 truncate">
                                    {typeof restaurant.location === 'string'
                                        ? restaurant.location
                                        : (restaurant.location?.formattedAddress || restaurant.location?.address || `${restaurant.location?.city || ''}${restaurant.location?.area ? ', ' + restaurant.location.area : ''}`)}
                                </p>
                            </div>
                        </div>

                        {/* Booking Info Grid */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800">
                            {/* Date & Time */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl flex flex-col justify-between min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Date &amp; Time</span>
                                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">{formattedDate}, {timeSlot}</span>
                                </div>
                            </div>
                            {/* Guests */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl flex flex-col justify-between min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Guests</span>
                                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                    <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">{guests} guests</span>
                                </div>
                            </div>
                            {/* Meal Preference */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl flex flex-col justify-between min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Meal Pref</span>
                                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                    <Ticket className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">
                                        {mealPreference ? String(mealPreference).charAt(0).toUpperCase() + String(mealPreference).slice(1) : "None"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Special Request */}
                <button
                    onClick={() => {
                        setTempRequest(specialRequest)
                        setShowRequestModal(true)
                    }}
                    className="w-full bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group transition-colors"
                >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${specialRequest ? 'bg-purple-50 dark:bg-purple-950/30' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                            <Info className={`w-4 h-4 ${specialRequest ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`} />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                            <span className="font-bold text-xs text-gray-700 dark:text-slate-200 block truncate">
                                {specialRequest ? 'Special Request Added' : 'Add special request'}
                            </span>
                            {specialRequest && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{specialRequest}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                        {specialRequest && (
                            <span className="text-[10px] font-black text-slate-950 dark:text-slate-50 uppercase tracking-widest">Edit</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                </button>

                {/* Preferences Section */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Guest Preferences</span>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                const targetSlug = restaurant?.slug || restaurant?._id || restaurant?.id || 'restaurant'
                                navigate(`/food/user/dining/book/${targetSlug}`, {
                                    state: { restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, isModifying: true, specialRequest, user }
                                })
                            }}
                            className="bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between active:scale-[0.98] transition-all min-w-0"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="text-slate-900 dark:text-slate-100 shrink-0">
                                    <Edit2 className="w-4 h-4" />
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                    <p className="font-bold text-gray-800 dark:text-slate-100 text-xs truncate">Modification</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">Valid till slot start</p>
                                </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1" />
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                navigate("/food/user/profile/cancellation", {
                                    state: {
                                        returnTo: "/food/user/dining/book-confirmation",
                                        originalState: { restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, specialRequest, user }
                                    }
                                })
                            }}
                            className="bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between active:scale-[0.98] transition-all min-w-0"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="text-red-400 shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                    <p className="font-bold text-gray-800 dark:text-slate-100 text-xs truncate">Cancellation</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">Free cancellation</p>
                                </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 ml-1" />
                        </button>
                    </div>
                </div>

                {/* Details Section */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Your Details</span>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg text-slate-600 dark:text-slate-400 shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                                <p className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">
                                    {user?.name || "—"} <span className="mx-1 text-slate-300 dark:text-slate-700">|</span> <span className="font-normal text-[11px] text-slate-500 dark:text-slate-400">{user?.phone || user?.email || "No contact"}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                navigate("/food/user/dining/edit-user", {
                                    state: { restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, specialRequest, user }
                                })
                            }}
                            className="text-red-500 text-xs font-bold hover:underline px-2 py-1 shrink-0 ml-2"
                        >
                            Change
                        </button>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Terms and Conditions</span>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                        <ul className="space-y-1.5">
                            {[
                                "Please arrive 15 minutes prior to your reservation time.",
                                mealPreference ? `Selected meal preference: ${String(mealPreference).toLowerCase()}.` : "Choose a meal preference before confirming your table.",
                                "Booking valid for the specified number of guests entered during reservation",
                                "Cover charges upon entry are subject to the discretion of the restaurant",
                                "House rules are to be observed at all times",
                                "Special requests will be accommodated at the restaurant's discretion",
                                "Cover charges cannot be refunded if slot is cancelled within 30 minutes of slot start time",
                                "Additional service charges on the bill are at the restaurant's discretion"
                            ].map((term, i) => (
                                <li key={i} className="flex gap-2 items-start">
                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 flex-shrink-0"></div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">{term}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Sticky Action Button */}
            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 transition-colors">
                <Button
                    onClick={handleBooking}
                    disabled={bookingInProgress || !user?.name?.trim() || user?.phone?.length !== 10}
                    className="w-full h-12 bg-[#ef4444] hover:bg-red-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {bookingInProgress ? "Confirming..." : "Confirm your seat"}
                </Button>
            </div>

            {/* Special Request Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRequestModal(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">Special Request</h3>
                            <button onClick={() => setShowRequestModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                <ArrowLeft className="w-4 h-4 rotate-90" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                Let the restaurant know if you have any allergies or special requirements (e.g. Birthday, Anniversary).
                            </p>
                            <textarea
                                value={tempRequest}
                                onChange={(e) => setTempRequest(e.target.value)}
                                placeholder="E.g. I have a peanut allergy, or we are celebrating a birthday..."
                                className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107] transition-all resize-none"
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={() => setShowRequestModal(false)} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setSpecialRequest(tempRequest)
                                        setShowRequestModal(false)
                                    }}
                                    className="h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 font-bold text-sm uppercase tracking-widest shadow-lg shadow-slate-200/50 active:scale-95 transition-all"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Policy Modal */}
            {showPolicyModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPolicyModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                {policyType === 'cancellation' ? 'Cancellation Policy' : 'Modification Policy'}
                            </h3>
                            <button onClick={() => setShowPolicyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 py-2">
                            <div className="flex gap-4 p-4 rounded-2xl bg-orange-50 border border-orange-100">
                                <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div className="text-sm font-medium text-orange-800">
                                    {policyType === 'cancellation'
                                        ? `You can cancel your booking until ${timeSlot} today without any charges.`
                                        : `You can modify your booking details until ${timeSlot} today for free.`}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Detailed Terms</p>
                                <ul className="space-y-2">
                                    {[
                                        "Refunds (if any) will be processed within 5-7 business days.",
                                        "Modifications are subject to table availability at the chosen restaurant.",
                                        "Frequent cancellations might lead to temporary booking restrictions.",
                                        "Partial refunds are not applicable for no-shows."
                                    ].map((term, i) => (
                                        <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                                            <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                            {term}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <button onClick={() => setShowPolicyModal(false)} className="w-full mt-6 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUserModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Edit Your Details</h3>
                            <button onClick={() => setShowUserModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                                <input
                                    type="text"
                                    value={tempUser.name}
                                    onChange={handleTempUserNameChange}
                                    className={`w-full h-12 px-4 rounded-xl bg-slate-50 border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 transition-all ${tempUser.name && !isValidTempName ? "border-red-500" : "border-slate-100 focus:border-red-500"}`}
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={tempUser.phone}
                                    onChange={handleTempUserPhoneChange}
                                    maxLength={10}
                                    className={`w-full h-12 px-4 rounded-xl bg-slate-50 border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 transition-all ${tempUser.phone && !isValidTempPhone ? "border-red-500" : "border-slate-100 focus:border-red-500"}`}
                                    placeholder="Enter 10 digit phone number"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <button onClick={() => setShowUserModal(false)} className="h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                                <button
                                    onClick={() => {
                                        setUser({ ...user, name: tempUser.name, phone: tempUser.phone })
                                        setShowUserModal(false)
                                    }}
                                    disabled={!isValidTempName || !isValidTempPhone}
                                    className="h-12 rounded-xl bg-red-500 text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatedPage>
    )
}
