const THRESHOLDS = {
  tooDark: 60,
  tooBright: 200,
  tooBlurry: 15,
}

export function assessCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  const gray = new Float32Array(width * height)
  let brightnessSum = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gray[p] = value
    brightnessSum += value
  }
  const brightness = brightnessSum / gray.length

  let varianceSum = 0
  let varianceCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const laplacian =
        4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width]
      varianceSum += laplacian * laplacian
      varianceCount += 1
    }
  }
  const blurVariance = varianceCount ? varianceSum / varianceCount : 0

  return {
    brightness,
    blurVariance,
    tooDark: brightness < THRESHOLDS.tooDark,
    tooBright: brightness > THRESHOLDS.tooBright,
    tooBlurry: blurVariance < THRESHOLDS.tooBlurry,
  }
}

export function assessVideoFrame(video, sampleWidth = 160) {
  if (!video || !video.videoWidth || !video.videoHeight) return null

  const scale = sampleWidth / video.videoWidth
  const canvas = document.createElement('canvas')
  canvas.width = sampleWidth
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

  return assessCanvas(canvas)
}

export function qualityHint(assessment) {
  if (!assessment) return null
  if (assessment.tooDark) return 'Move to a brighter, well-lit area'
  if (assessment.tooBright) return 'Reduce direct light or flash glare'
  if (assessment.tooBlurry) return 'Hold steady for a sharper photo'
  return null
}
