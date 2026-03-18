/**
 * Resize and compress an image file to a square WebP data URL.
 * - SVGs are kept as-is (lossless, scalable)
 * - Raster images: center-crops to square, resizes to maxSize × maxSize, compresses as WebP
 */
export function resizeImage(file: File, maxSize = 200, quality = 0.8): Promise<string> {
  // SVGs don't need rasterization — return as data URL directly
  if (file.type === "image/svg+xml") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Failed to read SVG"))
      reader.readAsDataURL(file)
    })
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement("canvas")
      canvas.width = maxSize
      canvas.height = maxSize

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas not supported"))
        return
      }

      // Center-crop to square
      const srcSize = Math.min(img.naturalWidth, img.naturalHeight)
      const srcX = (img.naturalWidth - srcSize) / 2
      const srcY = (img.naturalHeight - srcSize) / 2

      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, maxSize, maxSize)

      resolve(canvas.toDataURL("image/webp", quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }

    img.src = url
  })
}
