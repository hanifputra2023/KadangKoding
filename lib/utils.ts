import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Mengkompres foto di sisi client menggunakan Canvas.
 * - Resize max 1024px pada sisi terpanjang
 * - Kualitas JPEG 0.8
 * - Mengembalikan File baru yang lebih kecil
 */
export async function compressImage(
  file: File,
  maxDim = 1024,
  quality = 0.8
): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  let w = width
  let h = height
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height)
    w = Math.round(width * ratio)
    h = Math.round(height * ratio)
  }

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(
          new File([blob!], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
        )
      },
      "image/jpeg",
      quality
    )
  })
}
