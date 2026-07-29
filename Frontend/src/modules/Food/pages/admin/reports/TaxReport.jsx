import { useState, useEffect } from "react"
import { Download, ChevronDown, FileText, DollarSign, FileSpreadsheet, Loader2, Calendar } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportReportsToExcel, exportReportsToPDF } from "@food/components/admin/reports/reportsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const DEFAULT_FILTERS = {
  dateRangeType: "All Time",
  fromDate: "",
  toDate: "",
  calculateTax: "Percentage",
  taxRate: "Select Tax Rate",
}

function buildTaxReportDateRange(filters) {
  let fromDate = null
  let toDate = null
  const now = new Date()

  if (filters.dateRangeType === "Custom Range") {
    if (filters.fromDate) {
      fromDate = new Date(`${filters.fromDate}T00:00:00`)
    }
    if (filters.toDate) {
      toDate = new Date(`${filters.toDate}T23:59:59`)
    }
    return { fromDate, toDate }
  }

  if (filters.dateRangeType === "Today") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  } else if (filters.dateRangeType === "This Week") {
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek
    fromDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999)
  } else if (filters.dateRangeType === "This Month") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  } else if (filters.dateRangeType === "This Year") {
    fromDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
  }

  return { fromDate, toDate }
}

function buildTaxReportParams(filters) {
  const { fromDate, toDate } = buildTaxReportDateRange(filters)

  // Normalize calculateTax to lowercase with underscores — matches backend normalizeTaxReportCalculateTax
  const calculateTaxNormalized = String(filters.calculateTax || "Percentage")
    .toLowerCase()
    .replace(/\s+/g, "_")

  const params = {
    fromDate: fromDate ? fromDate.toISOString() : undefined,
    toDate: toDate ? toDate.toISOString() : undefined,
    limit: 1000,
    calculateTax: calculateTaxNormalized,
  }

  // Only send taxRate when Percentage mode and a rate is selected
  if (
    filters.calculateTax === "Percentage" &&
    filters.taxRate &&
    filters.taxRate !== "Select Tax Rate"
  ) {
    params.taxRate = parseInt(filters.taxRate.replace("%", ""), 10)
  }

  return params
}


export default function TaxReport() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState({
    totalIncome: "₹0.00",
    totalTax: "₹0.00"
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reportDetail, setReportDetail] = useState(null)

  const fetchTaxReport = async (activeFilters = filters, isSubmit = false) => {
    try {
      if (activeFilters.dateRangeType === "Custom Range") {
        if (!activeFilters.fromDate || !activeFilters.toDate) {
          toast.error("Please select both From Date and To Date")
          return
        }
        if (activeFilters.fromDate > activeFilters.toDate) {
          toast.error("From Date cannot be after To Date")
          return
        }
      }

      if (isSubmit) setSubmitting(true)
      else setLoading(true)

      const params = buildTaxReportParams(activeFilters)
      const response = await adminAPI.getTaxReport(params)

      if (response?.data?.success && response.data.data) {
        setReports(response.data.data.reports || [])
        setStats(response.data.data.stats || {
          totalIncome: "₹0.00",
          totalTax: "₹0.00"
        })
        if (isSubmit) {
          setAppliedFilters({ ...activeFilters })
          toast.success("Tax report updated successfully")
        }
      } else {
        setReports([])
        if (response?.data?.message) {
          toast.error(response.data.message)
        }
      }
    } catch (error) {
      debugError("Error fetching tax report:", error)
      toast.error("Failed to fetch tax report")
      setReports([])
    } finally {
      setLoading(false)
      setSubmitting(false)
    }
  }

  useEffect(() => {
    fetchTaxReport(DEFAULT_FILTERS)
  }, [])

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setAppliedFilters(null)
    fetchTaxReport(DEFAULT_FILTERS)
  }

  const handleSubmit = () => {
    fetchTaxReport(filters, true)
  }

  const handleViewDetails = async (report) => {
    setSelectedReport(report)
    setReportDetail(null)
    setDetailLoading(true)
    try {
      const params = buildTaxReportParams(filters)
      delete params.limit

      const response = await adminAPI.getTaxReportDetail(report.id, params)
      if (response?.data?.success) {
        setReportDetail(response.data.data)
      } else {
        toast.error(response?.data?.message || "Failed to fetch details")
      }
    } catch (error) {
      debugError("Error fetching tax detail:", error)
      toast.error("An error occurred while fetching details")
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExport = (format) => {
    if (reports.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "incomeSource", label: "Income Source" },
      { key: "totalIncome", label: "Total Earnings" },
      { key: "totalTax", label: "Total Tax" },
    ]
    switch (format) {
      case "excel": exportReportsToExcel(reports, headers, "tax_report"); break
      case "pdf": exportReportsToPDF(reports, headers, "tax_report", "Tax Report"); break
    }
  }

  if (loading && !submitting) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading tax report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Generate Tax Report</h1>
        </div>

        {/* Admin Tax Report Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Admin Tax Report</h2>
          <p className="text-sm text-slate-600 mb-6">
            To generate you tax report please select & input following field and submit for the result.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Date Range Type
              </label>
              <select
                value={filters.dateRangeType}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  dateRangeType: e.target.value,
                  ...(e.target.value !== "Custom Range" ? { fromDate: "", toDate: "" } : {}),
                }))}
                className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
                <option value="Custom Range">Custom Range</option>
              </select>
              <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select How to calculate tax
              </label>
              <select
                value={filters.calculateTax}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  calculateTax: e.target.value,
                  taxRate: "Select Tax Rate",
                }))}
                className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Percentage">Percentage (%)</option>
                <option value="Fixed Amount">Fixed Amount (stored tax)</option>
                <option value="Tiered">Tiered (stored tax)</option>
              </select>
              <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {filters.calculateTax === "Percentage" ? (
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Tax Rates
                </label>
                <select
                  value={filters.taxRate}
                  onChange={(e) => setFilters(prev => ({ ...prev, taxRate: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Select Tax Rate">Select Tax Rate</option>
                  <option value="5%">5%</option>
                  <option value="10%">10%</option>
                  <option value="15%">15%</option>
                  <option value="18%">18%</option>
                  <option value="20%">20%</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            ) : (
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Tax Rates
                </label>
                <div className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 italic">
                  Uses stored tax from orders
                </div>
              </div>
            )}
          </div>

          {filters.dateRangeType === "Custom Range" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  From Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  To Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Applied filter indicator */}
          {appliedFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs font-semibold text-blue-700">Active filters:</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                📅 {appliedFilters.dateRangeType}
                {appliedFilters.dateRangeType === "Custom Range" && appliedFilters.fromDate && appliedFilters.toDate && (
                  <span className="ml-1">({appliedFilters.fromDate} → {appliedFilters.toDate})</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                {appliedFilters.calculateTax}
                {appliedFilters.calculateTax === "Percentage" && appliedFilters.taxRate !== "Select Tax Rate" && (
                  <span className="ml-1">@ {appliedFilters.taxRate}</span>
                )}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleReset}
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-60"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-70"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Generating..." : "Submit"}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Total Earnings Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalIncome}</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-yellow-100 flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Total Tax Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Tax</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalTax}</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-pink-100 flex items-center justify-center">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Report List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Tax Report List ({reports.length})</h2>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="text-black font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          {reports.length === 0 ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <FileText className="w-12 h-12 text-purple-600" />
                </div>
                <p className="text-lg font-semibold text-slate-700 mb-2">No Tax Report Generated</p>
                <p className="text-sm text-slate-500 max-w-md">
                  To generate your tax report please select & input above field and submit for the result
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      SI
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Income Source
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Earnings
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Tax
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{report.sl}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{report.incomeSource}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalIncome}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalTax}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleViewDetails(report)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Tax Details: {selectedReport?.incomeSource}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-600">Fetching order details...</p>
              </div>
            ) : reportDetail?.orders?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Order ID</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">Earnings</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportDetail.orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.orderId}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{new Date(order.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">{order.totalAmount}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{order.taxAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">No detailed orders found for this period.</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-slate-500">Total Tax: </span>
              <span className="font-bold text-red-600">{selectedReport?.totalTax}</span>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

