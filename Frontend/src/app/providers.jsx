import { BrowserRouter, HashRouter, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { StrictMode } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from './store'
import { UserNotificationProvider } from '../modules/Food/context/UserNotificationContext'
import { RestaurantNotificationProvider } from '../modules/Food/context/RestaurantNotificationContext'
import { DeliveryNotificationProvider } from '../modules/Food/context/DeliveryNotificationContext'


function shouldUseHashRouter() {
  if (typeof window === 'undefined') return false

  const protocol = String(window.location?.protocol || '').toLowerCase()
  const userAgent = String(window.navigator?.userAgent || '').toLowerCase()

  return (
    Boolean(window.flutter_inappwebview) ||
    Boolean(window.ReactNativeWebView) ||
    protocol === 'file:' ||
    userAgent.includes(' wv') ||
    userAgent.includes('; wv')
  )
}

function RouteScopedNotificationProviders({ children }) {
  const location = useLocation()
  const pathname = String(location?.pathname || '')

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/food/admin')
  const isDeliveryRoute = pathname.startsWith('/delivery') || pathname.startsWith('/food/delivery')
  const isRestaurantRoute =
    (pathname.startsWith('/restaurant') || pathname.startsWith('/food/restaurant')) &&
    !pathname.startsWith('/food/restaurants')
  const isUserRoute = !isAdminRoute && !isDeliveryRoute && !isRestaurantRoute

  let content = children

  if (isUserRoute) {
    content = <UserNotificationProvider>{content}</UserNotificationProvider>
  }

  if (isRestaurantRoute) {
    content = <RestaurantNotificationProvider>{content}</RestaurantNotificationProvider>
  }

  if (isDeliveryRoute) {
    content = <DeliveryNotificationProvider>{content}</DeliveryNotificationProvider>
  }

  return (
    <>
      {content}
      <Toaster position="top-right" richColors offset="80px" closeButton />
    </>
  )
}

import { useState, useEffect } from 'react'
import OfflineScreen from '../shared/components/OfflineScreen'

function OfflineHandler({ children }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    const handleNetworkError = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('appNetworkError', handleNetworkError)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('appNetworkError', handleNetworkError)
    }
  }, [])

  if (isOffline) {
    return (
      <OfflineScreen
        onRetry={() => {
          setIsOffline(!navigator.onLine)
          if (navigator.onLine) {
            window.location.reload()
          }
        }}
      />
    )
  }

  return children
}

export function AppProviders({ children }) {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

  return (
    <StrictMode>
      <ReduxProvider store={store}>
        <Router>
          <OfflineHandler>
            <RouteScopedNotificationProviders>{children}</RouteScopedNotificationProviders>
          </OfflineHandler>
        </Router>
      </ReduxProvider>
    </StrictMode>
  )
}
