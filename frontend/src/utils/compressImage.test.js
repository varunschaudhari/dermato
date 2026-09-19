import { describe, it, expect } from 'vitest'
import { compressImage } from './compressImage'

function makeFile({ type = 'image/jpeg', sizeBytes = 100 } = {}) {
  const bytes = new Uint8Array(sizeBytes)
  return new File([bytes], 'photo.jpg', { type })
}

describe('compressImage', () => {
  it('returns the original file unchanged if already under the size threshold', async () => {
    const file = makeFile({ sizeBytes: 1000 })
    const result = await compressImage(file, { maxSizeBytes: 5000 })
    expect(result).toBe(file)
  })

  it('returns the original file unchanged for non-image types', async () => {
    const file = makeFile({ type: 'application/pdf', sizeBytes: 10 * 1024 * 1024 })
    const result = await compressImage(file, { maxSizeBytes: 1000 })
    expect(result).toBe(file)
  })
})
