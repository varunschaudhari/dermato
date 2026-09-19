import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, Waves, Palette, CircleDot, UploadCloud, Camera, ScanFace, Users,
  CheckCircle2, RotateCcw, ScanLine, TrendingUp, Image as ImageIcon, X, Aperture, Plus,
  SwitchCamera, Zap, ZapOff, Timer, ClipboardList,
} from 'lucide-react'
import { analyzeImage, getPatients, getPatientSessions, getPatient, updateSkinHistory } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { compressImage } from '../utils/compressImage'
import { assessVideoFrame, qualityHint } from '../utils/photoQuality'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

const CONDITIONS = [
  { key: 'acne', label: 'Acne', icon: Sparkles },
  { key: 'wrinkle', label: 'Wrinkles', icon: Waves },
  { key: 'pigmentation', label: 'Pigmentation', icon: Palette },
  { key: 'pore', label: 'Pores', icon: CircleDot },
]

const HOW_IT_WORKS = [
  { icon: Camera, label: 'Capture', description: 'Take or upload a clear skin photo' },
  { icon: ScanLine, label: 'Analyze', description: 'AI checks it against your selected conditions' },
  { icon: TrendingUp, label: 'Track', description: 'See severity and progress over time' },
]

const ANGLES = [
  { key: 'front', label: 'Front', required: true },
  { key: 'left', label: 'Left angle', required: false },
  { key: 'right', label: 'Right angle', required: false },
]

const EMPTY_PHOTOS = { front: null, left: null, right: null }

const ANALYSIS_STAGES = [
  'Verifying image quality',
  'Detecting skin regions',
  'Scoring conditions',
  'Comparing to your last visit',
  'Preparing your results',
]

const SKIN_HISTORY_FIELDS = [
  ['allergies', 'Allergies'],
  ['current_products', 'Current skincare products'],
  ['known_conditions', 'Known conditions'],
  ['medications', 'Medications'],
]

export default function AnalyzePage() {
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const isPatient = user.role === 'patient'

  const [photos, setPhotos] = useState(EMPTY_PHOTOS)
  const [activeAngle, setActiveAngle] = useState('front')
  const [compressing, setCompressing] = useState(false)
  const [justCaptured, setJustCaptured] = useState(false)
  const [patientId, setPatientId] = useState(isPatient ? String(user.patient_id) : '')
  const [selectedConditions, setSelectedConditions] = useState(CONDITIONS.map((c) => c.key))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisStage, setAnalysisStage] = useState(0)
  const [error, setError] = useState('')
  const [isQualityError, setIsQualityError] = useState(false)
  const [showCaptureChoice, setShowCaptureChoice] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [qualityHintText, setQualityHintText] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [timerOn, setTimerOn] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [flashActive, setFlashActive] = useState(false)
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const qualityIntervalRef = useRef(null)
  const analysisStageIntervalRef = useRef(null)
  const countdownTimeoutRef = useRef(null)

  const file = photos.front?.file || null
  const preview = photos.front?.preview || null

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients().then((r) => r.data),
    enabled: !isPatient,
  })

  const { data: ownSessions = [] } = useQuery({
    queryKey: ['sessions', user.patient_id],
    queryFn: () => getPatientSessions(user.patient_id).then((r) => r.data),
    enabled: isPatient,
  })
  const isFirstRun = isPatient && ownSessions.length === 0

  const { data: ownPatient } = useQuery({
    queryKey: ['patient', String(user.patient_id)],
    queryFn: () => getPatient(user.patient_id).then((r) => r.data),
    enabled: isPatient,
  })

  const [showSkinHistoryPrompt, setShowSkinHistoryPrompt] = useState(false)
  const [skinHistoryForm, setSkinHistoryForm] = useState({
    allergies: '', current_products: '', known_conditions: '', medications: '',
  })
  const skinHistorySkipKey = `dermato_skin_history_skipped_${user.patient_id}`

  useEffect(() => {
    if (!isPatient || !ownPatient) return
    const hasAny = SKIN_HISTORY_FIELDS.some(([key]) => ownPatient.skin_history?.[key])
    if (hasAny || localStorage.getItem(skinHistorySkipKey)) return
    setShowSkinHistoryPrompt(true)
  }, [isPatient, ownPatient, skinHistorySkipKey])

  const skinHistoryMutation = useMutation({
    mutationFn: (data) => updateSkinHistory(user.patient_id, data),
    onSuccess: () => {
      qc.invalidateQueries(['patient', String(user.patient_id)])
      toast.success('Skin history saved.')
      setShowSkinHistoryPrompt(false)
    },
    onError: () => toast.error('Could not save skin history.'),
  })

  const skipSkinHistory = () => {
    localStorage.setItem(skinHistorySkipKey, '1')
    setShowSkinHistoryPrompt(false)
  }

  useEffect(() => {
    if (!justCaptured) return
    const timer = setTimeout(() => setJustCaptured(false), 1200)
    return () => clearTimeout(timer)
  }, [justCaptured])

  const processFile = useCallback(async (original, angle) => {
    if (!original) return
    setError('')
    setCompressing(true)
    try {
      const compressed = await compressImage(original)
      const objectUrl = URL.createObjectURL(compressed)
      setPhotos((prev) => ({ ...prev, [angle]: { file: compressed, preview: objectUrl } }))
      if (angle === 'front') setJustCaptured(true)
      if (navigator.vibrate) navigator.vibrate(40)
    } finally {
      setCompressing(false)
    }
  }, [])

  const removePhoto = (angle) => {
    setPhotos((prev) => ({ ...prev, [angle]: null }))
  }

  const onDrop = useCallback((accepted) => processFile(accepted[0], 'front'), [processFile])

  const handleCapturedFile = (e) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    processFile(selected, activeAngle)
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    clearInterval(qualityIntervalRef.current)
    qualityIntervalRef.current = null
    clearTimeout(countdownTimeoutRef.current)
    countdownTimeoutRef.current = null
    setQualityHintText(null)
    setCountdown(null)
    setTorchOn(false)
    setTorchSupported(false)
    setCameraOpen(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const openCaptureChoice = (angle) => {
    setActiveAngle(angle)
    setShowCaptureChoice(true)
  }

  const openCamera = async (mode = facingMode) => {
    setShowCaptureChoice(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } })
      streamRef.current = stream
      setFacingMode(mode)
      setTorchSupported(!!stream.getVideoTracks()[0]?.getCapabilities?.().torch)
      setTorchOn(false)
      setCameraOpen(true)
    } catch {
      toast.error('Could not access the camera. Check permissions, or choose from gallery instead.')
    }
  }

  const flipCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    openCamera(facingMode === 'environment' ? 'user' : 'environment')
  }

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn((prev) => !prev)
    } catch {
      toast.error('Flash is not supported on this device.')
    }
  }

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      qualityIntervalRef.current = setInterval(() => {
        setQualityHintText(qualityHint(assessVideoFrame(videoRef.current)))
      }, 600)
    }
    return () => {
      clearInterval(qualityIntervalRef.current)
      qualityIntervalRef.current = null
      setQualityHintText(null)
    }
  }, [cameraOpen])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) processFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }), activeAngle)
    }, 'image/jpeg', 0.92)
  }

  const triggerCapture = () => {
    setFlashActive(true)
    capturePhoto()
    setTimeout(() => {
      setFlashActive(false)
      stopCamera()
    }, 180)
  }

  const startCapture = () => {
    if (!timerOn) {
      triggerCapture()
      return
    }
    let count = 3
    setCountdown(count)
    const tick = () => {
      count -= 1
      if (count === 0) {
        setCountdown(null)
        triggerCapture()
      } else {
        setCountdown(count)
        countdownTimeoutRef.current = setTimeout(tick, 1000)
      }
    }
    countdownTimeoutRef.current = setTimeout(tick, 1000)
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  })

  const toggleCondition = (key) => {
    setSelectedConditions((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))
  }

  const handleAnalyze = async () => {
    if (!file || !patientId || selectedConditions.length === 0) return
    setLoading(true)
    setError('')
    setIsQualityError(false)
    setProgress(0)
    setAnalysisStage(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (photos.left?.file) formData.append('file_left', photos.left.file)
      if (photos.right?.file) formData.append('file_right', photos.right.file)
      formData.append('patient_id', patientId)
      analysisStageIntervalRef.current = setInterval(() => {
        setAnalysisStage((prev) => Math.min(prev + 1, ANALYSIS_STAGES.length - 1))
      }, 1200)
      const { data } = await analyzeImage(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      navigate('/results', { state: { results: data, imageUrl: preview, patientId, selectedConditions } })
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.message) {
        setIsQualityError(true)
        setError(detail.message)
      } else {
        setIsQualityError(false)
        setError(detail || 'Analysis failed. Check your connection and try again.')
      }
    } finally {
      clearInterval(analysisStageIntervalRef.current)
      analysisStageIntervalRef.current = null
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Skin Analysis" subtitle="Upload a clear, well-lit photo to get started" />

      {isFirstRun && (
        <Card className="mb-5 bg-brand-50/60 dark:bg-brand-900/20 border-brand-100 dark:border-brand-800">
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-300 mb-3">How it works</p>
          <div className="grid grid-cols-3 gap-3">
            {HOW_IT_WORKS.map(({ icon: Icon, label, description }) => (
              <div key={label} className="text-center">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{label}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isPatient && (
        <Card className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Patient</label>
          {patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No patients yet"
              description="Add a patient before running an analysis."
              action={
                <Button as={Link} to="/patients" variant="outline" size="sm">
                  Add a patient
                </Button>
              }
            />
          ) : (
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Age {p.age})</option>
              ))}
            </select>
          )}
        </Card>
      )}

      {isPatient && (
        <Card className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">What would you like checked?</label>
          <div className="grid grid-cols-2 gap-2.5">
            {CONDITIONS.map(({ key, label, icon: Icon }) => {
              const active = selectedConditions.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCondition(key)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 border transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              )
            })}
          </div>
          {selectedConditions.length === 0 && (
            <p className="text-xs text-red-500 mt-2">Select at least one condition to check.</p>
          )}
        </Card>
      )}

      <div
        {...getRootProps({
          onClick: () => {
            if (compressing) return
            if (isPatient) openCaptureChoice('front')
            else open()
          },
        })}
        role="button"
        aria-label={isPatient ? 'Take a photo or choose one from your gallery' : 'Drag and drop a skin image, or click to select'}
        className={`relative bg-white dark:bg-gray-900 border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition
          ${isDragActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-brand-400'}`}
      >
        <input {...getInputProps()} />
        {compressing ? (
          <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Preparing photo…</p>
          </div>
        ) : preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="preview" className="mx-auto max-h-64 rounded-xl object-contain" />
            {justCaptured && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                <div className="bg-white rounded-full p-3 animate-pop-in">
                  <CheckCircle2 className="w-8 h-8 text-brand-600" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
            <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              {isPatient ? <Camera className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
            </div>
            <p className="text-sm">
              {isPatient
                ? 'Take a photo or choose one from your gallery'
                : 'Drag & drop a skin image here, or click to select'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Optional: add left/right angles for a fuller record
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ANGLES.filter((a) => !a.required).map(({ key, label }) => {
            const photo = photos[key]
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                aria-label={photo ? `Replace ${label} photo` : `Add ${label} photo`}
                onClick={() => openCaptureChoice(key)}
                onKeyDown={(e) => e.key === 'Enter' && openCaptureChoice(key)}
                className="relative bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-brand-400 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer text-gray-400 dark:text-gray-500"
              >
                {photo ? (
                  <>
                    <img src={photo.preview} alt={`${label} preview`} className="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      aria-label={`Remove ${label} photo`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removePhoto(key)
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mb-1" />
                    <span className="text-xs">{label}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showCaptureChoice && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowCaptureChoice(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-80 sm:p-5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">
              Add {ANGLES.find((a) => a.key === activeAngle)?.label.toLowerCase()} photo
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={openCamera}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium text-sm"
              >
                <Camera className="w-5 h-5" />
                Take a photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCaptureChoice(false)
                  galleryInputRef.current?.click()
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm"
              >
                <ImageIcon className="w-5 h-5" />
                Choose from gallery
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCaptureChoice(false)}
              className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapturedFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCapturedFile}
      />

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="flex-1 w-full h-full object-cover" />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div
              className="w-[68%] aspect-[3/4] max-h-[60%] rounded-[50%] border-2 border-white"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
            />
            <p className="mt-4 text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
              Fit your face inside the outline
            </p>
          </div>

          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span key={countdown} className="text-white text-8xl font-bold drop-shadow-lg animate-pop-in">
                {countdown}
              </span>
            </div>
          )}

          {flashActive && <div className="absolute inset-0 bg-white animate-camera-flash" />}

          {qualityHintText && !countdown && (
            <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] inset-x-0 flex justify-center pointer-events-none">
              <span className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                {qualityHintText}
              </span>
            </div>
          )}

          <div className="absolute top-4 inset-x-4 flex items-center justify-between pt-safe">
            <button
              aria-label="Close camera"
              onClick={stopCamera}
              className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                aria-label={timerOn ? 'Disable 3-second timer' : 'Enable 3-second timer'}
                aria-pressed={timerOn}
                onClick={() => setTimerOn((t) => !t)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                  timerOn ? 'bg-brand-600 text-white' : 'bg-black/50 text-white'
                }`}
              >
                <Timer className="w-4.5 h-4.5" />
              </button>
              {torchSupported && (
                <button
                  aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                  aria-pressed={torchOn}
                  onClick={toggleTorch}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                    torchOn ? 'bg-brand-600 text-white' : 'bg-black/50 text-white'
                  }`}
                >
                  {torchOn ? <Zap className="w-4.5 h-4.5" /> : <ZapOff className="w-4.5 h-4.5" />}
                </button>
              )}
              <button
                aria-label="Switch camera"
                onClick={flipCamera}
                className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <SwitchCamera className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent">
            <button
              aria-label="Capture photo"
              onClick={startCapture}
              disabled={!!countdown}
              className="w-16 h-16 rounded-full bg-white ring-4 ring-white/40 active:scale-95 transition flex items-center justify-center disabled:opacity-60"
            >
              <Aperture className="w-7 h-7 text-gray-900" />
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">
            {progress < 100 ? `Uploading… ${progress}%` : ANALYSIS_STAGES[analysisStage]}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          {isQualityError ? (
            <Button
              size="sm"
              variant="outline"
              icon={Camera}
              onClick={() => {
                removePhoto('front')
                setError('')
                openCaptureChoice('front')
              }}
              className="shrink-0"
            >
              Retake Photo
            </Button>
          ) : (
            <Button size="sm" variant="outline" icon={RotateCcw} onClick={handleAnalyze} className="shrink-0">
              Retry
            </Button>
          )}
        </div>
      )}

      {file && !loading && (
        <Button
          onClick={() => setShowReview(true)}
          disabled={!patientId || selectedConditions.length === 0}
          icon={ScanFace}
          fullWidth
          className="mt-5 py-3"
        >
          Analyze Image
        </Button>
      )}

      {showReview && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowReview(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-96 sm:p-5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">
              Review your photo
            </p>
            <div className="flex items-center justify-center gap-4 mb-4">
              {ANGLES.filter((a) => a.key === 'front' || photos[a.key]).map(({ key, label }) => (
                <div key={key} className="text-center">
                  <img
                    src={photos[key]?.preview}
                    alt={`${label} preview`}
                    className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowReview(false)
                      openCaptureChoice(key)
                    }}
                    className="mt-1.5 text-xs font-medium text-brand-600 dark:text-brand-400"
                  >
                    Retake
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
              This estimates severity to help you decide next steps. It does not diagnose melanoma, cancer, or any medical condition.
            </p>
            <Button
              onClick={() => {
                setShowReview(false)
                handleAnalyze()
              }}
              fullWidth
              icon={ScanFace}
              className="py-3"
            >
              Looks good — Analyze
            </Button>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {showSkinHistoryPrompt && (
        <>
          <button aria-label="Close" className="fixed inset-0 z-40 bg-black/40" onClick={skipSkinHistory} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-96 sm:p-5 sm:max-h-[85vh] sm:overflow-y-auto">
            <div className="flex items-center gap-2 mb-1.5 justify-center">
              <ClipboardList className="w-5 h-5 text-brand-600 shrink-0" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Before your first scan</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
              A quick note on allergies or current products helps us avoid recommending something that won't work for you. Optional, but worth 30 seconds.
            </p>
            <div className="space-y-3">
              {SKIN_HISTORY_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                  <input
                    value={skinHistoryForm[key]}
                    onChange={(e) => setSkinHistoryForm({ ...skinHistoryForm, [key]: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={() => skinHistoryMutation.mutate(skinHistoryForm)}
              disabled={skinHistoryMutation.isPending}
              fullWidth
              className="mt-4 py-2.5"
            >
              Save and continue
            </Button>
            <button
              type="button"
              onClick={skipSkinHistory}
              className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400"
            >
              Skip for now
            </button>
          </div>
        </>
      )}
    </div>
  )
}
