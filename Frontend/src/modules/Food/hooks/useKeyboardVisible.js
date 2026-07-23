import { useState, useEffect } from "react"

/**
 * Custom hook to detect when the virtual keyboard is open or a text input is focused on mobile/desktop devices.
 * Helps prevent fixed bottom navigation bars from popping up over the virtual keyboard.
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    const isInputElement = (el) => {
      if (!el) return false
      const tagName = el.tagName?.toUpperCase()
      if (tagName === "TEXTAREA" || el.isContentEditable) return true
      if (tagName === "INPUT") {
        const type = (el.type || "text").toLowerCase()
        return !["button", "checkbox", "radio", "submit", "reset", "file", "image"].includes(type)
      }
      return false
    }

    let timer = null

    const checkKeyboardState = () => {
      const activeEl = document.activeElement
      const inputFocused = isInputElement(activeEl)

      let viewportShrunk = false
      if (typeof window !== "undefined" && window.visualViewport) {
        viewportShrunk = window.visualViewport.height < window.innerHeight * 0.85
      }

      setIsKeyboardVisible(inputFocused || viewportShrunk)
    }

    const handleFocusIn = (e) => {
      if (isInputElement(e.target)) {
        setIsKeyboardVisible(true)
      }
    }

    const handleFocusOut = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        checkKeyboardState()
      }, 60)
    }

    const handleResize = () => {
      checkKeyboardState()
    }

    // Run initial check
    checkKeyboardState()

    window.addEventListener("focusin", handleFocusIn)
    window.addEventListener("focusout", handleFocusOut)

    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener("focusin", handleFocusIn)
      window.removeEventListener("focusout", handleFocusOut)
      if (typeof window !== "undefined" && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return isKeyboardVisible
}

export default useKeyboardVisible
