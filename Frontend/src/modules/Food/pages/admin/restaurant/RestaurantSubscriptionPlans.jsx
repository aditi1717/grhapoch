import { useState, useMemo, useEffect } from "react"
import { 
  Search, Plus, Edit, Trash2, ArrowUpDown, 
  DollarSign, Percent, Loader2, X, Building2, Calendar, Clock, Tag
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

export default function RestaurantSubscriptionPlans() {
  const [activeTab, setActiveTab] = useState("plans")
  const [searchQuery, setSearchQuery] = useState("")
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    durationValue: "1",
    durationUnit: "months",
    commissionRate: "0",
    description: ""
  })
  const [formErrors, setFormErrors] = useState({})

  const [activePlan, setActivePlan] = useState(null)
  const [alertDays, setAlertDays] = useState(3)
  const [alertTemplate, setAlertTemplate] = useState("")
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Pagination for subscriptions
  const [subPage, setSubPage] = useState(1)
  const [subTotalPages, setSubTotalPages] = useState(1)

  useEffect(() => {
    if (activeTab === "plans") {
      fetchPlans()
    } else if (activeTab === "subscriptions") {
      fetchSubscriptions()
    } else if (activeTab === "settings") {
      fetchSettings()
    }
  }, [activeTab, subPage])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurantSubscriptionSettings()
      const data = response?.data?.data
      setAlertDays(data?.daysBefore || 3)
      setAlertTemplate(data?.messageTemplate || "")
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch alert settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    if (!alertTemplate.trim()) {
      toast.error("Message template cannot be empty")
      return
    }
    if (alertDays < 1) {
      toast.error("Warning threshold must be at least 1 day")
      return
    }

    try {
      setSettingsSaving(true)
      await adminAPI.updateRestaurantSubscriptionSettings({
        daysBefore: Number(alertDays),
        messageTemplate: alertTemplate
      })
      toast.success("Alert settings updated successfully")
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save alert settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurantSubscriptionPlans()
      setPlans(response?.data?.data?.plans || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch subscription plans')
      setPlans([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscriptions = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurantSubscriptions({ page: subPage, limit: 10 })
      setSubscriptions(response?.data?.data?.subscriptions || [])
      setSubTotalPages(response?.data?.data?.pagination?.pages || 1)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch subscriptions')
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (plan) => {
    try {
      await adminAPI.updateRestaurantSubscriptionPlan(plan._id, { isActive: !plan.isActive })
      await fetchPlans()
      toast.success('Plan status updated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update plan status')
    }
  }

  const handleAdd = () => {
    setSelectedPlan(null)
    setFormData({
      name: "",
      price: "",
      durationValue: "1",
      durationUnit: "months",
      commissionRate: "0",
      description: ""
    })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleEdit = (plan) => {
    setSelectedPlan(plan)
    setFormData({
      name: plan.name,
      price: plan.price.toString(),
      durationValue: plan.durationValue.toString(),
      durationUnit: plan.durationUnit,
      commissionRate: plan.commissionRate.toString(),
      description: plan.description || ""
    })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.name.trim()) errors.name = "Plan name is required"
    
    const priceVal = parseFloat(formData.price)
    if (isNaN(priceVal) || priceVal <= 0) {
      errors.price = "Price must be greater than zero"
    }
    
    if (!formData.durationValue || parseInt(formData.durationValue, 10) < 1) {
      errors.durationValue = "Duration must be at least 1"
    }
    
    const rateVal = parseFloat(formData.commissionRate)
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      errors.commissionRate = "Commission rate must be between 0% and 100%"
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    try {
      setSaving(true)
      const payload = {
        name: formData.name,
        price: parseFloat(formData.price),
        durationValue: parseInt(formData.durationValue, 10),
        durationUnit: formData.durationUnit,
        commissionRate: parseFloat(formData.commissionRate),
        description: formData.description
      }

      if (selectedPlan) {
        await adminAPI.updateRestaurantSubscriptionPlan(selectedPlan._id, payload)
        toast.success('Plan updated successfully')
      } else {
        await adminAPI.createRestaurantSubscriptionPlan(payload)
        toast.success('Plan created successfully')
      }

      await fetchPlans()
      setIsAddEditOpen(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save subscription plan')
    } finally {
      setSaving(false)
    }
  }

  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return plans
    const q = searchQuery.toLowerCase()
    return plans.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
  }, [plans, searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Restaurant Subscriptions</h1>
              <p className="text-slate-500 text-sm mt-1">Manage subscription plans and view logs of restaurant subscriptions.</p>
            </div>
            {activeTab === "plans" && (
              <button 
                onClick={handleAdd}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Plan
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => { setActiveTab("plans"); setLoading(true); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "plans" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Subscription Plans
            </button>
            <button
              onClick={() => { setActiveTab("subscriptions"); setLoading(true); setSubPage(1); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "subscriptions" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Active Subscriptions & Logs
            </button>
            <button
              onClick={() => { setActiveTab("settings"); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "settings" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Alert Settings
            </button>
          </div>

          {/* Search bar (only for plans tab) */}
          {activeTab === "plans" && (
            <div className="mb-6 relative max-w-md">
              <input
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : activeTab === "plans" ? (
            /* PLANS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Plan Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Commission Rate</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredPlans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No subscription plans found</td>
                    </tr>
                  ) : (
                    filteredPlans.map((plan) => (
                      <tr key={plan._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                            {plan.description && <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{plan.description}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-900">₹{plan.price.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{plan.durationValue} {plan.durationUnit}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-emerald-600">{plan.commissionRate}%</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(plan)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                              plan.isActive ? "bg-blue-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                plan.isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(plan)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === "subscriptions" ? (
            /* SUBSCRIPTIONS LOGS */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Restaurant</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Plan Details</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Payment</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No subscriptions found</td>
                      </tr>
                    ) : (
                      subscriptions.map((sub) => (
                        <tr key={sub._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-slate-900">
                                  {sub.restaurantId?.restaurantName || "Deleted Restaurant"}
                                </span>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Owner: {sub.restaurantId?.ownerName || "N/A"} ({sub.restaurantId?.ownerPhone || "N/A"})
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <span className="text-sm font-medium text-slate-900">{sub.planId?.name || "Deleted Plan"}</span>
                              <p className="text-xs text-slate-500 mt-0.5">Paid: ₹{sub.pricePaid.toLocaleString('en-IN')}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-slate-700 space-y-1">
                              <p className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Start: {new Date(sub.startDate).toLocaleDateString()}</span>
                              </p>
                              <p className="flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>End: {new Date(sub.endDate).toLocaleDateString()}</span>
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              sub.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {sub.paymentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              sub.status === "active" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {subTotalPages > 1 && (
                <div className="flex justify-end items-center gap-2 mt-4">
                  <button
                    onClick={() => setSubPage(p => Math.max(1, p - 1))}
                    disabled={subPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {subPage} of {subTotalPages}</span>
                  <button
                    onClick={() => setSubPage(p => Math.min(subTotalPages, p + 1))}
                    disabled={subPage === subTotalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* SETTINGS FORM */
            <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-4">
              <h3 className="text-base font-extrabold text-slate-900 mb-5">Subscription Expiry Warnings</h3>
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Warning Threshold (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={alertDays}
                    onChange={(e) => setAlertDays(e.target.value)}
                    className="w-full max-w-[200px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-950 font-medium"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Start sending daily push notification reminders to restaurants this many days before expiration.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Push Notification Message Template
                  </label>
                  <textarea
                    value={alertTemplate}
                    onChange={(e) => setAlertTemplate(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-950 font-medium resize-none"
                    placeholder="Enter message template..."
                  />
                  <div className="mt-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 block mb-1">Supported Dynamic Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      <code className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">{`{planName}`}</code>
                      <code className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">{`{daysRemaining}`}</code>
                      <code className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">{`{endDate}`}</code>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow shadow-blue-500/10 flex items-center gap-2 disabled:opacity-50"
                  >
                    {settingsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-xl bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {selectedPlan ? "Edit Subscription Plan" : "Add Subscription Plan"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Commission Free Plan"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                  formErrors.name ? "border-red-500" : "border-slate-300"
                }`}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="e.g., 999"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                    formErrors.price ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {formErrors.price && <p className="text-xs text-red-500 mt-1">{formErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Commission Rate (%) *</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                    placeholder="e.g., 0 for free"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                      formErrors.commissionRate ? "border-red-500" : "border-slate-300"
                    }`}
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                {formErrors.commissionRate && <p className="text-xs text-red-500 mt-1">{formErrors.commissionRate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration Value *</label>
                <input
                  type="number"
                  value={formData.durationValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, durationValue: e.target.value }))}
                  placeholder="e.g., 1, 30"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                    formErrors.durationValue ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {formErrors.durationValue && <p className="text-xs text-red-500 mt-1">{formErrors.durationValue}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration Unit *</label>
                <select
                  value={formData.durationUnit}
                  onChange={(e) => setFormData(prev => ({ ...prev, durationUnit: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief details about the plan advantages..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedPlan ? "Update" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
