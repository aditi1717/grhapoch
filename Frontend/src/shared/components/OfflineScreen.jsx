import React from "react"
import { WifiOff, RefreshCw } from "lucide-react"

export default function OfflineScreen({ onRetry }) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 dark:bg-zinc-950 items-center justify-center p-6 text-center select-none">
      <div className="flex flex-col items-center max-w-sm gap-6">
        <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 animate-pulse">
          <WifiOff className="w-10 h-10" />
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tight mb-2">
            Connection Lost
          </h2>
          <p className="text-[15px] font-medium text-slate-500 dark:text-zinc-400 leading-relaxed">
            Please check your internet connection. We'll get you back online as soon as possible.
          </p>
        </div>

        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-full shadow-lg shadow-rose-100 dark:shadow-none hover:scale-105 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  )
}
