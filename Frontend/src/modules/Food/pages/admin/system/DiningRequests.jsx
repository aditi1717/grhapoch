import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Clock, UtensilsCrossed, Loader2, AlertCircle, CheckCircle2, ChevronRight, User, MapPin } from "lucide-react"
import { adminAPI } from "@food/api"
import { Button } from "@food/components/ui/button"
import { Badge } from "@food/components/ui/badge"
import { toast } from "sonner"

const debugError = (...args) => {}

export default function DiningRequests() {
    const [requests, setRequests] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)
    const [error, setError] = useState(null)

    const formatMealPeriod = (value) => {
        const normalized = String(value || "").trim().toLowerCase()
        if (normalized === "breakfast") return "Breakfast"
        if (normalized === "lunch") return "Lunch"
        if (normalized === "dinner") return "Dinner"
        return normalized
    }

    useEffect(() => {
        Promise.all([fetchRequests(), fetchCategories()])
    }, [])

    const fetchCategories = async () => {
        try {
            const response = await adminAPI.getDiningCategories()
            if (response.data.success) {
                setCategories(response.data.data.categories || [])
            }
        } catch (err) {
            debugError("Error fetching dining categories:", err)
        }
    }

    const fetchRequests = async () => {
        try {
            setLoading(true)
            const response = await adminAPI.getDiningRequests()
            if (response.data.success) {
                setRequests(response.data.data || [])
            }
        } catch (err) {
            debugError("Error fetching dining requests:", err)
            setError("Failed to load requests")
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (requestId) => {
        if (!window.confirm("Approve this dining settings update?")) return
        try {
            setProcessingId(requestId)
            const response = await adminAPI.approveDiningRequest(requestId)
            if (response.data.success) {
                toast.success("Request approved successfully")
                setRequests(requests.filter(r => r._id !== requestId))
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to approve request")
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (requestId) => {
        const reason = window.prompt("Enter rejection reason (optional):")
        if (reason === null) return // Cancelled prompt
        
        try {
            setProcessingId(requestId)
            const response = await adminAPI.rejectDiningRequest(requestId, reason)
            if (response.data.success) {
                toast.success("Request rejected")
                setRequests(requests.filter(r => r._id !== requestId))
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to reject request")
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="p-3 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-plum-600 flex items-center justify-center">
                            <UtensilsCrossed className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">Dining Category Requests</h1>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg flex items-center gap-2 max-w-2xl">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                        <Button variant="link" onClick={fetchRequests} className="text-red-850 font-bold p-0 ml-auto">Retry</Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-dashed border-slate-300">
                        <Loader2 className="w-8 h-8 animate-spin text-plum-600 mb-3" />
                        <p className="text-slate-500 font-medium text-sm">Loading pending requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-dashed border-slate-300">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">No Pending Requests</h3>
                        <p className="text-slate-500 text-center max-w-xs mt-1 text-sm">All dining settings updates have been processed.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {requests.map((request) => (
                            <div key={request._id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3">
                                            {request.restaurant?.profileImage?.url ? (
                                                <img 
                                                    src={request.restaurant.profileImage.url} 
                                                    alt={request.restaurant.name} 
                                                    className="w-10 h-10 rounded-md object-cover border border-slate-100" 
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center border border-slate-100">
                                                    <UtensilsCrossed className="w-4 h-4 text-slate-400" />
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">{request.restaurant?.name || "Unknown Restaurant"}</h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                    <MapPin className="w-3 h-3" />
                                                    {request.restaurant?.address || "No address provided"}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 py-0.5 px-2 text-xs">
                                            <Clock className="w-3 h-3" />
                                            Pending
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="font-semibold text-slate-900 text-sm">
                                            {(() => {
                                                const raw = request.requestedSettings?.diningType
                                                if (!raw) return "Not specified"
                                                const allSlugs = String(raw).split(",").map(s => s.trim()).filter(Boolean)
                                                const uniqueSlugs = [...new Set(allSlugs)]
                                                const categoryNames = uniqueSlugs.map(slug => {
                                                    const category = categories?.find(c => c.slug === slug)
                                                    return category ? category.name : slug
                                                })
                                                return categoryNames.join(", ")
                                            })()}
                                        </div>
                                        <div className="font-semibold text-slate-900 text-sm">{request.requestedSettings?.maxGuests || "No limit"} Guests</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(() => {
                                                const raw = request.requestedSettings?.mealPeriods
                                                const periods = Array.isArray(raw)
                                                    ? raw
                                                    : String(raw || "")
                                                        .split(",")
                                                        .map((item) => item.trim())
                                                        .filter(Boolean)
                                                if (periods.length === 0) return <span className="text-xs font-medium text-slate-500">Not specified</span>
                                                return [...new Set(periods.map((item) => String(item).trim().toLowerCase()))]
                                                    .filter(Boolean)
                                                    .map((period) => (
                                                        <span
                                                            key={period}
                                                            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                                                        >
                                                            {formatMealPeriod(period)}
                                                        </span>
                                                    ))
                                            })()}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                                        <div className="text-xs text-slate-500 italic">
                                            Requested on: {new Date(request.createdAt).toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                onClick={() => handleReject(request._id)}
                                                disabled={processingId === request._id}
                                                className="border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-semibold text-xs px-3 py-1.5"
                                            >
                                                {processingId === request._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reject"}
                                            </Button>
                                            <Button 
                                                onClick={() => handleApprove(request._id)}
                                                disabled={processingId === request._id}
                                                className="bg-primary hover:bg-primary/90 text-black font-bold px-4 py-1.5 shadow-sm transition-all text-xs"
                                            >
                                                {processingId === request._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
