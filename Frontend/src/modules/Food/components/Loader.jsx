import { useLocation } from "react-router-dom"
import { AppShellSkeleton } from "@food/components/ui/loading-skeletons"

export default function Loader() {
  const location = useLocation()
  const path = location.pathname

  if (path === '/food/user' || path === '/food/user/' || path === '/') {
    return <AppShellSkeleton />
  }

  const isDark = path.includes('/delivery') || path.includes('/admin')
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-orange-500 font-bold uppercase tracking-widest text-xs">Loading...</p>
      </div>
    </div>
  )
}
