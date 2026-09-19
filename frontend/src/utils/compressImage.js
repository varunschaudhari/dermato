const DEFAULTS = {
  maxDimension: 1600,
  maxSizeBytes: 1.5 * 1024 * 1024,
  initialQuality: 0.85,
  minQuality: 0.5,
}

// Resizes + re-encodes large phone-camera photos client-side before upload —
// cuts multi-MB shots down to ~1-2MB so analysis is fast on mobile data.
export async function compressImage(file, options = {}) {
  const { maxDimension, maxSizeBytes, initialQuality, minQuality } = { ...DEFAULTS, ...options }

  if (!file.type.startsWith('image/') || file.size <= maxSizeBytes) return file

  let source
  try {
    source = await loadImageSource(file)
  } catch {
    return file // if decoding fails for any reason, just upload the original
  }

  const width = source.width ?? source.naturalWidth
  const height = source.height ?? source.naturalHeight
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  canvas.getContext('2d').drawImage(source, 0, 0, targetWidth, targetHeight)

  let quality = initialQuality
  let blob = await canvasToBlob(canvas, quality)

  while (blob.size > maxSizeBytes && quality > minQuality) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size >= file.size) return file

  const newName = file.name.replace(/\.\w+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
}

async function loadImageSource(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file)
    } catch {
      // some browsers can't decode certain formats via createImageBitmap — fall back below
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}
