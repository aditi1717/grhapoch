import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { 
  ArrowLeft, Check, Sparkles, AlertTriangle, 
  Calendar, CreditCard, ShieldCheck, HelpCircle, Loader2 
} from "lucide-react"
import { restaurantAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"

export default function RestaurantSubscription() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  
  const [currentSub, setCurrentSub] = useState(null)
  const [plans, setPlans] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [subRes, plansRes] = await Promise.all([
        restaurantAPI.getCurrentSubscription(),
        restaurantAPI.getSubscriptionPlans()
      ])
      setCurrentSub(subRes?.data?.data?.subscription || null)
      setPlans(plansRes?.data?.data?.plans || [])
    } catch (error) {
      toast.error("Failed to load subscription details")
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (plan) => {
    try {
      setProcessingId(plan._id)
      const res = await restaurantAPI.subscribeToPlan(plan._id)
      const data = res?.data?.data

      if (data.isPaid) {
        // Free plan activated immediately
        toast.success("Subscription activated successfully!")
        fetchData()
        return
      }

      // Open Razorpay checkout for paid plan
      const options = {
        key: data.razorpayKeyId,
        amount: Math.round(data.price * 100),
        currency: "INR",
        order_id: data.orderId,
        name: "Grhapoch Restaurant Panel",
        description: `Subscription for ${plan.name}`,
        prefill: {
          name: "",
          email: "",
          contact: ""
        },
        handler: async (response) => {
          try {
            setLoading(true)
            await restaurantAPI.verifySubscriptionPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
            toast.success("Payment verified and subscription activated!")
            fetchData()
          } catch (err) {
            toast.error(err.response?.data?.message || "Payment verification failed")
            setLoading(false)
          }
        },
        onError: (err) => {
          toast.error("Payment failed. Please try again.")
        }
      }

      initRazorpayPayment(options)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to initiate subscription")
    } finally {
      setProcessingId(null)
    }
  }

  const getDaysRemaining = (endDateStr) => {
    const end = new Date(endDateStr)
    const now = new Date()
    const diffTime = end - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 font-sans text-slate-800">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl px-4 py-3 sticky top-0 z-50 border-b border-black/5 flex items-center gap-3">
        <button
          onClick={() => navigate("/food/restaurant/explore")}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-[19px] font-extrabold tracking-tight text-gray-900">Subscription Plans</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#FA0272]" />
        </div>
      ) : (
        <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
          
          {/* Current Subscription Status */}
          {currentSub ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-emerald-550 to-teal-650 text-white rounded-[24px] p-6 shadow-lg shadow-emerald-500/10 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
            >
              <div className="absolute right-[-20px] top-[-20px] opacity-10">
                <ShieldCheck className="w-40 h-40" />
              </div>
              
              <div className="flex items-center gap-2 mb-4 bg-white/20 w-fit px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Active Subscription
              </div>

              <h2 className="text-2xl font-extrabold leading-tight">{currentSub.planId?.name}</h2>
              <p className="text-white/85 text-sm mt-1">Enjoying {currentSub.planId?.commissionRate}% commission rate on orders!</p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                <div>
                  <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider">Expires On</p>
                  <p className="font-bold text-sm flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-4 h-4 text-white/85" />
                    {new Date(currentSub.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider">Days Remaining</p>
                  <p className="font-extrabold text-lg mt-0.5">{getDaysRemaining(currentSub.endDate)} Days</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] p-6 border border-amber-200 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[16px] text-slate-900 leading-tight">Standard Commission Mode</h3>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    You are currently operating under the standard commission structure. Subscribe to a commission-free plan below to optimize your business margins and retain 100% of your order value.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Browse Plans Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold tracking-wider text-slate-400 uppercase px-1">Available Plans</h3>

            {plans.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">There are no subscription plans available at the moment. Please check back later or contact partner support.</p>
            ) : (
              plans.map((plan, index) => {
                const isCurrent = currentSub?.planId?._id === plan._id
                return (
                  <motion.div
                    key={plan._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-white rounded-[24px] p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border transition-all relative overflow-hidden ${
                      isCurrent ? "border-[#FA0272] bg-[#FA0272]/[0.01]" : "border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-[18px] text-slate-900 leading-tight flex items-center gap-2">
                          {plan.name}
                          {isCurrent && (
                            <span className="bg-[#FA0272]/10 text-[#FA0272] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">{plan.durationValue} {plan.durationUnit} Validity</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[20px] font-extrabold text-slate-900">₹{plan.price.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <p className="text-slate-500 text-sm mt-3 leading-relaxed">{plan.description}</p>

                    <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </div>
                        <span>Commission: {plan.commissionRate}% during plan period</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </div>
                        <span>No hidden fee / Instant Activation</span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={isCurrent || !!currentSub || processingId === plan._id}
                        className={`w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          isCurrent 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : !!currentSub
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                            : "bg-[#FA0272] text-white hover:bg-[#FA0272]/90 shadow-md shadow-[#FA0272]/10"
                        }`}
                      >
                        {processingId === plan._id && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isCurrent ? "Active Plan" : `Subscribe Now (₹${plan.price})`}
                      </button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
