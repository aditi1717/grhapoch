import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { ArrowLeft, Calendar, Clock, Users, MapPin, ChevronRight, Utensils } from "lucide-react"
import { diningAPI } from "@food/api"
import Loader from "@food/components/Loader"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Badge } from "@food/components/ui/badge"
import { Star, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const getMediaUrl = (url) => {
    if (!url || typeof url !== 'string') return "";
    if (url.startsWith('http')) return url;
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
    const origin = apiBase.split('/api/v1')[0];
    return `${origin}${url.startsWith('/') ? url : '/' + url}`;
}


function ReviewModal({ booking, onClose, onSubmit }) {
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!comment.trim()) {
            toast.error("Please add a comment")
            return
        }
        setSubmitting(true)
        await onSubmit({ bookingId: booking._id, rating, comment })
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Review your experience</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center">
                        <p className="text-sm font-medium text-slate-500 dark:text-gray-400 mb-3">How was your visit to {booking.restaurant?.name}?</p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform active:scale-90"
                                >
                                    <Star
                                        className={`w-10 h-10 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200 dark:text-slate-700"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-gray-300">Share your feedback</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Write about the food, service, and atmosphere..."
                            className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-red-500 transition-all text-sm resize-none dark:text-white dark:placeholder:text-gray-500"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-2xl shadow-lg shadow-red-200"
                    >
                        {submitting ? "Submitting..." : "Submit Review"}
                    </Button>
                </div>
            </div>
        </div>
    )
}

function BookingDetailModal({ booking, onClose, onRateReview }) {
    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    })

    const statusLabel = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "pending") return "Pending"
        if (key === "accepted" || key === "confirmed") return "Confirmed"
        if (key === "checked-in") return "Checked-in"
        if (key === "completed") return "Completed"
        if (key === "cancelled") return "Cancelled"
        return String(status || "unknown")
    }

    const getStatusBadgeClass = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
        if (key === "accepted" || key === "confirmed") return "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400 font-bold"
        if (key === "checked-in") return "bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-yellow-400"
        if (key === "completed") return "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
        if (key === "cancelled") return "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400"
        return "bg-slate-100 text-slate-700"
    }

    // Scroll lock when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = ''
        }
    }, [])

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={onClose}></div>

            {/* Content card */}
            <div className="bg-white dark:bg-[#1a1a1a] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col text-slate-900 dark:text-white">
                {/* Drawer handle for mobile */}
                <div className="flex justify-center py-2 sm:hidden flex-shrink-0">
                    <div className="w-12 h-1 bg-slate-200 dark:bg-slate-750 rounded-full"></div>
                </div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-['Outfit']">Booking Details</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {/* Restaurant Info */}
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0 p-0.5 relative flex items-center justify-center overflow-hidden">
                            <Utensils className="w-6 h-6 text-slate-300 dark:text-slate-600 absolute" />
                            <img
                                src={getMediaUrl(booking.restaurant?.image || booking.restaurant?.profileImage?.url || booking.restaurant?.profileImage || "")}
                                className="w-full h-full object-cover relative z-10"
                                alt={booking.restaurant?.name}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                }}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-extrabold text-base text-gray-900 dark:text-slate-100 truncate">
                                {booking.restaurant?.name}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400 flex items-start gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                <span className="break-words whitespace-normal text-left">
                                    {typeof booking.restaurant?.location === 'string'
                                        ? booking.restaurant.location
                                        : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Booking Ticket Box */}
                    <div className="bg-slate-50/50 dark:bg-[#202022] rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-4 space-y-4 relative overflow-hidden">
                        {/* Circle cutouts */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-[#1a1a1a] rounded-full border border-slate-200 dark:border-slate-855"></div>
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-[#1a1a1a] rounded-full border border-slate-200 dark:border-slate-855"></div>

                        {/* Booking ID and Status */}
                        <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
                            <div className="font-semibold text-slate-500 dark:text-slate-400">
                                BOOKING ID: <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider">{booking.bookingId || booking._id?.slice(-8)}</span>
                            </div>
                            <Badge className={`${getStatusBadgeClass(booking.status)} px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider`}>
                                {statusLabel(booking.status)}
                            </Badge>
                        </div>

                        {/* Booking Details Grid */}
                        <div className="grid grid-cols-2 gap-4 py-2 text-left">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-red-500" />
                                    Date
                                </p>
                                <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{formattedDate}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-red-500" />
                                    Time Slot
                                </p>
                                <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{booking.timeSlot}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider flex items-center gap-1">
                                    <Users className="w-3 h-3 text-red-500" />
                                    Guests
                                </p>
                                <p className="font-bold text-sm text-gray-800 dark:text-slate-200">{booking.guests} People</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider flex items-center gap-1">
                                    <Utensils className="w-3 h-3 text-red-500" />
                                    Table Status
                                </p>
                                <p className="font-bold text-sm text-gray-800 dark:text-slate-200 uppercase tracking-wide">{booking.status}</p>
                            </div>
                        </div>
                    </div>

                    {/* Review Section if Completed */}
                    {booking.status === 'completed' && (
                        booking.review?.rating ? (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Your Review</span>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={`w-3.5 h-3.5 ${
                                                    star <= booking.review.rating
                                                        ? "fill-yellow-400 text-yellow-400"
                                                        : "text-slate-200 dark:text-slate-700"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {booking.review.comment && (
                                    <p className="mt-2 text-xs text-gray-650 dark:text-gray-300 italic leading-relaxed">
                                        "{booking.review.comment}"
                                    </p>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={onRateReview}
                                className="w-full py-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold rounded-2xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 transition-colors"
                            >
                                RATE & REVIEW VISIT
                            </button>
                        )
                    )}

                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest text-center mt-2">
                        Show this ticket details at the restaurant for smooth entry
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function MyBookings() {
    const navigate = useNavigate()
    const location = useLocation()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedBooking, setSelectedBooking] = useState(null)
    const [detailBooking, setDetailBooking] = useState(null)

    const handleCardClick = (booking) => {
        setDetailBooking(booking);
    };

    const getStatusLabel = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "pending") return "Approval Reqd"
        if (key === "accepted" || key === "confirmed") return "Confirmed"
        if (key === "checked-in") return "Checked-in"
        if (key === "completed") return "Completed"
        if (key === "cancelled") return "Cancelled"
        return String(status || "unknown")
    }

    const getStatusBadgeClass = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "pending") return "bg-amber-100 text-amber-700"
        if (key === "accepted" || key === "confirmed") return "bg-green-100 text-green-700 font-bold"
        if (key === "checked-in") return "bg-[#F9F9FB] text-[#FFC107]"
        if (key === "completed") return "bg-blue-100 text-blue-700"
        if (key === "cancelled") return "bg-red-100 text-red-700"
        return "bg-slate-100 text-slate-700"
    }

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const response = await diningAPI.getBookings()
                if (response.data.success) {
                    setBookings(response.data.data)
                }
            } catch (error) {
                debugError("Error fetching bookings:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchBookings()
    }, [])

    useEffect(() => {
        const handleStatusUpdateEvent = (event) => {
            const { bookingId, status } = event.detail || {};
            if (bookingId && status) {
                setBookings((prev) =>
                    prev.map((b) => (b._id === bookingId ? { ...b, status } : b))
                );
            }
        };

        window.addEventListener("diningBookingStatusUpdate", handleStatusUpdateEvent);
        return () => {
            window.removeEventListener("diningBookingStatusUpdate", handleStatusUpdateEvent);
        };
    }, []);

    const handleReviewSubmit = async (reviewData) => {
        try {
            const response = await diningAPI.createReview(reviewData)
            if (response.data.success) {
                toast.success("Review submitted! Thank you for your feedback.")
                setBookings((prev) =>
                    prev.map((booking) =>
                        booking._id === reviewData.bookingId
                            ? {
                                  ...booking,
                                  review: response.data.data?.review || {
                                      rating: reviewData.rating,
                                      comment: reviewData.comment,
                                      createdAt: new Date().toISOString(),
                                  },
                              }
                            : booking
                    )
                )
                setSelectedBooking(null)
            }
        } catch (error) {
            debugError("Error submitting review:", error)
            toast.error(error.response?.data?.message || "Failed to submit review")
        }
    }

    if (loading) return <Loader />

    return (
        <AnimatedPage className="bg-slate-50 dark:bg-[#0a0a0a] min-h-screen transition-colors">
            {/* Fixed header with backdrop blur */}
            <div className="bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl p-3 flex items-center shadow-sm sticky top-0 z-40 border-b border-slate-200 dark:border-gray-800">
                <button onClick={() => {
                    if (location.pathname.startsWith("/food")) {
                        navigate("/food/user/profile")
                    } else {
                        navigate("/user/profile")
                    }
                }}>
                    <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-white cursor-pointer" />
                </button>
                <h1 className="ml-3 text-base font-bold text-gray-800 dark:text-white">Table Bookings</h1>
            </div>

            {/* Scrollable content with padding */}
            <div className="p-3 space-y-3 pb-6">
                {bookings.length > 0 ? (
                    bookings.map((booking) => (
                        <div 
                            key={booking._id} 
                            onClick={() => handleCardClick(booking)}
                            className="bg-white dark:bg-[#1a1a1a] rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-200 dark:border-gray-800 hover:border-red-100/50 dark:hover:border-red-955/30 flex items-start gap-3 transition-all duration-300 cursor-pointer group"
                        >
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-gray-800 relative flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                <Utensils className="w-6 h-6 text-slate-300 dark:text-slate-600 absolute" />
                                <img
                                    src={getMediaUrl(booking.restaurant?.image || booking.restaurant?.profileImage?.url || booking.restaurant?.profileImage || "")}
                                    className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-105"
                                    alt={booking.restaurant?.name}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                    }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-red-500 transition-colors">
                                            {booking.restaurant?.name}
                                        </h3>
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                    </div>
                                    <Badge className={`${getStatusBadgeClass(booking.status)} dark:opacity-80 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider`}>
                                        {getStatusLabel(booking.status)}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                    <span className="truncate">
                                        {typeof booking.restaurant?.location === 'string'
                                            ? booking.restaurant.location
                                            : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}${booking.restaurant?.location?.area ? ', ' + booking.restaurant.location.area : ''}`)}
                                    </span>
                                </p>

                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-955/30 px-1.5 py-0.5 rounded-md">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/20 border border-amber-100/50 dark:border-amber-955/30 px-1.5 py-0.5 rounded-md">
                                        <Clock className="w-2.5 h-2.5" />
                                        {booking.timeSlot}
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-955/20 border border-sky-100/50 dark:border-sky-955/30 px-1.5 py-0.5 rounded-md">
                                        <Users className="w-2.5 h-2.5" />
                                        {booking.guests} Guests
                                    </div>
                                </div>

                                {booking.status === 'completed' && (
                                    booking.review?.rating ? (
                                        <div 
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Your Review</span>
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Star
                                                            key={star}
                                                            className={`w-3 h-3 ${
                                                                star <= booking.review.rating
                                                                    ? "fill-yellow-400 text-yellow-400"
                                                                    : "text-slate-200 dark:text-slate-700"
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            {booking.review.comment && (
                                                <p className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-300 italic">
                                                    "{booking.review.comment}"
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedBooking(booking);
                                            }}
                                            className="mt-2 w-full py-1.5 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-[10px] font-bold rounded-md border border-red-100 dark:border-red-900/30 hover:bg-red-100 transition-colors"
                                        >
                                            RATE & REVIEW
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16">
                        <div className="bg-slate-100 dark:bg-gray-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Utensils className="w-7 h-7 text-slate-300 dark:text-gray-600" />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 dark:text-white">No bookings yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">Book your favorite restaurant for a great dining experience!</p>
                        <Link to="/food/user/dining">
                            <button className="mt-5 bg-red-500 text-white font-bold px-5 py-2 rounded-lg shadow-md shadow-red-200">
                                Book a table
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            {selectedBooking && (
                <ReviewModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onSubmit={handleReviewSubmit}
                />
            )}

            {detailBooking && (
                <BookingDetailModal
                    booking={detailBooking}
                    onClose={() => setDetailBooking(null)}
                    onRateReview={() => {
                        setSelectedBooking(detailBooking);
                        setDetailBooking(null);
                    }}
                />
            )}
        </AnimatedPage>
    )
}
