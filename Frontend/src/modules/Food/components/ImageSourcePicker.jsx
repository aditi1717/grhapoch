import { Camera, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { openCamera, openGallery } from "@food/utils/imageUploadUtils"

/**
 * ImageSourcePicker component to choose between Camera and Gallery.
 * Works on both Flutter (native bridge) and plain web browsers (input capture).
 */
export const ImageSourcePicker = ({ 
  isOpen, 
  onClose, 
  onFileSelect, 
  title = "Update photo",
  description = "Choose how you want to upload your photo.",
  fileNamePrefix = "upload",
  galleryInputRef = null
}) => {
  const runAfterClose = (fn) => {
    onClose()
    window.setTimeout(fn, 80)
  }
  
  const handleOpenCamera = () => {
    runAfterClose(() => {
      void openCamera({
        onSelectFile: onFileSelect,
        fileNamePrefix: fileNamePrefix
      })
    })
  }

  const handlePickFromDevice = () => {
    runAfterClose(() => {
      void openGallery({
        onSelectFile: onFileSelect,
        fileNamePrefix: fileNamePrefix
      })
      // Extra fallback for plain web if galleryInputRef provided
      if (galleryInputRef && galleryInputRef.current) {
        window.setTimeout(() => {
          galleryInputRef.current?.click()
        }, 120)
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-base font-bold text-gray-900 text-center">{title}</DialogTitle>
          <DialogDescription className="text-xs text-gray-500 text-center mt-0.5">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          {/* Camera option */}
          <button
            type="button"
            onClick={handleOpenCamera}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50 transition-all active:scale-[0.97] group"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
              <Camera className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-gray-900">Use Camera</p>
              <p className="text-xs text-gray-500 mt-0.5">Take a photo right now</p>
            </div>
          </button>

          {/* Upload from device option */}
          <button
            type="button"
            onClick={handlePickFromDevice}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50 transition-all active:scale-[0.97] group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-gray-900">Upload from Device</p>
              <p className="text-xs text-gray-500 mt-0.5">Choose from your gallery</p>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-semibold text-gray-600 active:scale-[0.97]"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
