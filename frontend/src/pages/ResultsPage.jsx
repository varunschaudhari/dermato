import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactCompareImage from 'react-compare-image'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'
import { Cpu, FlaskConical, ScanFace, TrendingUp, Home, Pill, Stethoscope, FileText, ChevronDown, ChevronUp, ArrowUpCircle, ArrowDownRight, ArrowUpRight, Minus, CalendarPlus, AlertTriangle, Images } from 'lucide-react'
import { getPatientSessions } from '../services/api'
import { computeSkinScoreFromSeverities, scoreMeta } from '../utils/skinScore'
import Card from '../components/ui/Card'
import Badge, { SEVERITY } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ClinicalFooter from '../components/ui/ClinicalFooter'

const REC_TYPE_ICON = {
  'Home remedy': Home,
  'OTC Cosmeceutical': Pill,
  Referral: Stethoscope,
}

const DELTA_META = {
  improved: { color: 'text-green-600 dark:text-green-400', icon: ArrowDownRight, label: 'improved' },
  same: { color: 'text-gray-400 dark:text-gray-500', icon: Minus, label: 'unchanged' },
  worsened: { color: 'text-red-600 dark:text-red-400', icon: ArrowUpRight, label: 'worsened' },
}

// The acne-detection model and the skin-problems model return two overlapping label
// vocabularies (lowercase acne lesion types vs. capitalized skin-problem classes) —
// this maps both onto our four tracked conditions (plus "other") for consistent box colors.
const DETECTION_CATEGORY = {
  blackheads: 'acne', nodules: 'acne', papules: 'acne', pustules: 'acne', whiteheads: 'acne',
  'dark spot': 'pigmentation',
  Acne: 'acne', Blackheads: 'acne', Whiteheads: 'acne',
  'Dark-Spots': 'pigmentation',
  Wrinkles: 'wrinkle',
  'Enlarged-Pores': 'pore',
  'Dry-Skin': 'other', Eyebags: 'other', 'Oily-Skin': 'other', 'Skin-Redness': 'other',
}

// Classical-CV measurement overlays: acne lesion boxes, pigmented-patch
// outlines, and wrinkle lines, plotted over the uploaded photo on demand.
const OVERLAY_META = {
  acne: { label: 'Acne', color: '#ef4444' },
  pigmentation: { label: 'Pigmentation', color: '#a855f7' },
  wrinkle: { label: 'Wrinkles', color: '#0ea5e9' },
}

const CATEGORY_META = {
  acne: { label: 'Acne', border: 'border-red-500', chip: 'bg-red-600' },
  pigmentation: { label: 'Pigmentation', border: 'border-purple-500', chip: 'bg-purple-600' },
  wrinkle: { label: 'Wrinkles', border: 'border-sky-500', chip: 'bg-sky-600' },
  pore: { label: 'Pores', border: 'border-amber-500', chip: 'bg-amber-600' },
  other: { label: 'Other', border: 'border-gray-400', chip: 'bg-gray-500' },
}

function TriageBanner({ severityToShow, recommendationsToShow }) {
  const hasReferral = Object.entries(recommendationsToShow).some(
    ([k, rec]) => k !== 'disclaimer' && rec.type === 'Referral'
  )
  const hasSevere = Object.values(severityToShow).some((level) => level === 'severe')
  const needsAttention = hasReferral || hasSevere

  return (
    <Card
      className={
        needsAttention
          ? 'flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          : 'flex items-start gap-3 bg-brand-50/60 dark:bg-brand-900/20'
      }
    >
      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">
          {needsAttention
            ? 'One or more areas are worth a professional look — see the recommendation below.'
            : 'Your results look manageable — see your personalized recommendations below.'}
        </p>
        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
          This is not a diagnosis and does not replace a clinical visit. See a doctor promptly if any area is bleeding, rapidly changing, or not healing — regardless of this result.
        </p>
      </div>
    </Card>
  )
}

export default function ResultsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(true)
  const [activeOverlays, setActiveOverlays] = useState([])

  if (!state?.results) {
    navigate('/')
    return null
  }

  const { severity, recommendations, model_powered: modelPowered, ml_detections: mlDetections, session_id: sessionId, previous_severity: previousSeverity = {}, flags = {}, wsi = {}, overlays = {} } = state.results
  const patientId = state.patientId
  const imageUrl = state.imageUrl
  const detections = mlDetections?.detections ?? []

  // The just-created session is already the last entry here; the one before
  // it is this scan's "before" photo, so a returning patient sees whether
  // their treatment worked without navigating to Progress separately.
  const { data: patientSessions = [] } = useQuery({
    queryKey: ['sessions', String(patientId)],
    queryFn: () => getPatientSessions(patientId).then((r) => r.data),
    enabled: !!patientId,
  })
  const previousSession = patientSessions.length >= 2 ? patientSessions[patientSessions.length - 2] : null

  // Staff always see the full breakdown; a patient sees only what they asked to be checked.
  const selectedConditions = state.selectedConditions
  const severityToShow = selectedConditions
    ? Object.fromEntries(Object.entries(severity).filter(([k]) => selectedConditions.includes(k)))
    : severity
  const recommendationsToShow = selectedConditions
    ? Object.fromEntries(
        Object.entries(recommendations).filter(([k]) => k === 'disclaimer' || selectedConditions.includes(k))
      )
    : recommendations

  const overlayChoices = Object.keys(OVERLAY_META).filter(
    (k) => (overlays[k]?.length ?? 0) > 0 && (!selectedConditions || selectedConditions.includes(k))
  )

  const SEVERITY_NUM = { mild: 1, moderate: 2, severe: 3 }
  const radarData = Object.entries(severityToShow).map(([condition, level]) => ({
    subject: condition.charAt(0).toUpperCase() + condition.slice(1),
    value: SEVERITY_NUM[level] ?? 0,
  }))

  const skinScore = computeSkinScoreFromSeverities(severity)
  const previousScore = computeSkinScoreFromSeverities(previousSeverity)
  const scoreMetaInfo = scoreMeta(skinScore)
  const scoreDelta = previousScore != null && skinScore != null ? skinScore - previousScore : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Analysis Results</h1>
        <Badge color={modelPowered ? 'brand' : 'gray'} icon={modelPowered ? Cpu : FlaskConical}>
          {modelPowered ? 'AI model-powered' : 'Classical CV'}
        </Badge>
      </div>

      <TriageBanner severityToShow={severityToShow} recommendationsToShow={recommendationsToShow} />

      {/* Skin Health Score */}
      {skinScore != null && (
        <Card hero className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">Skin Health Score</p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-semibold tabular-nums">{skinScore}</span>
              <span className="text-sm text-white/60">/ 100</span>
            </div>
            <span className="inline-block mt-2 text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1">{scoreMetaInfo.label}</span>
          </div>
          {scoreDelta != null && scoreDelta !== 0 && (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${scoreDelta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {scoreDelta > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {scoreDelta > 0 ? '+' : ''}{scoreDelta} vs. last visit
            </div>
          )}
        </Card>
      )}

      {/* Photo with AI detection overlay */}
      {imageUrl && (
        <Card className="flex flex-col items-center">
          <div className="relative inline-block max-w-full">
            <img src={imageUrl} alt="Analyzed skin" className="max-h-96 max-w-full rounded-xl block" />
            {detections.map((d, i) => {
              const meta = CATEGORY_META[DETECTION_CATEGORY[d.label] ?? 'other']
              return (
                <div
                  key={i}
                  className={`absolute border-2 rounded-sm ${meta.border}`}
                  style={{
                    left: `${d.box[0] * 100}%`,
                    top: `${d.box[1] * 100}%`,
                    width: `${(d.box[2] - d.box[0]) * 100}%`,
                    height: `${(d.box[3] - d.box[1]) * 100}%`,
                  }}
                >
                  <span className={`absolute -top-5 left-0 text-[10px] leading-tight ${meta.chip} text-white px-1 rounded whitespace-nowrap capitalize`}>
                    {d.label}
                  </span>
                </div>
              )
            })}
            {activeOverlays.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {activeOverlays.includes('acne') &&
                  (overlays.acne ?? []).map((r, i) => (
                    <rect
                      key={`a${i}`}
                      x={r.box[0] * 100}
                      y={r.box[1] * 100}
                      width={(r.box[2] - r.box[0]) * 100}
                      height={(r.box[3] - r.box[1]) * 100}
                      fill="none"
                      stroke={OVERLAY_META.acne.color}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {activeOverlays.includes('pigmentation') &&
                  (overlays.pigmentation ?? []).map((r, i) => (
                    <polygon
                      key={`p${i}`}
                      points={r.polygon.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                      fill={OVERLAY_META.pigmentation.color}
                      fillOpacity="0.18"
                      stroke={OVERLAY_META.pigmentation.color}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {activeOverlays.includes('wrinkle') &&
                  (overlays.wrinkle ?? []).map((r, i) => (
                    <polyline
                      key={`w${i}`}
                      points={r.line.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                      fill="none"
                      stroke={OVERLAY_META.wrinkle.color}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
              </svg>
            )}
          </div>
          {overlayChoices.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">Show measured regions:</span>
              {overlayChoices.map((k) => {
                const active = activeOverlays.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setActiveOverlays((prev) => (active ? prev.filter((x) => x !== k) : [...prev, k]))
                    }
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                      active
                        ? 'border-transparent text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={active ? { backgroundColor: OVERLAY_META[k].color } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: active ? 'white' : OVERLAY_META[k].color }}
                    />
                    {OVERLAY_META[k].label} ({overlays[k].length})
                  </button>
                )
              })}
            </div>
          )}
          {detections.length > 0 && (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{detections.length} feature{detections.length === 1 ? '' : 's'} detected by AI</p>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {[...new Set(detections.map((d) => DETECTION_CATEGORY[d.label] ?? 'other'))].map((cat) => (
                  <span key={cat} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_META[cat].chip}`} />
                    {CATEGORY_META[cat].label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Before vs. After — how this scan compares to the previous one */}
      {previousSession && imageUrl && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Images className="w-5 h-5 text-brand-600" />
            Before vs. After
          </h2>
          <ReactCompareImage
            leftImage={previousSession.image_url}
            rightImage={imageUrl}
            leftImageLabel="Previous visit"
            rightImageLabel="Today"
          />
        </Card>
      )}

      {/* Severity badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {Object.entries(severityToShow).map(([condition, level]) => {
          const s = SEVERITY[level] ?? SEVERITY.mild
          const prev = previousSeverity[condition]
          const delta = prev
            ? DELTA_META[SEVERITY_NUM[level] < SEVERITY_NUM[prev] ? 'improved' : SEVERITY_NUM[level] > SEVERITY_NUM[prev] ? 'worsened' : 'same']
            : null
          return (
            <Card key={condition} className="text-center p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mb-2">{condition}</p>
              <Badge color={s.color} icon={s.icon}>{level}</Badge>
              {wsi[condition] != null && (
                <p className="text-[11px] font-mono tabular-nums text-gray-400 dark:text-gray-500 mt-1">WSI {wsi[condition].toFixed(2)}</p>
              )}
              {delta && (
                <p className={`text-xs mt-2 flex items-center justify-center gap-1 capitalize ${delta.color}`}>
                  <delta.icon className="w-3.5 h-3.5" />
                  {delta.label} vs. last visit
                </p>
              )}
              {flags[condition] && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
                  {flags[condition]}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Radar chart */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Severity Overview</h2>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
            <Radar dataKey="value" stroke="#0d9488" fill="#0d9488" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* AI detections */}
      {mlDetections && (
        <Card className={showDetails ? 'space-y-4' : undefined}>
          <button
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detected Features</h2>
            {showDetails ? (
              <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
            )}
          </button>

          {showDetails && (
            <>
              {mlDetections.acne_lesion_types && Object.keys(mlDetections.acne_lesion_types).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Acne lesion types</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mlDetections.acne_lesion_types).map(([type, count]) => (
                      <Badge key={type} color="brand">{type}: {count}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {mlDetections.skin_problem_counts && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Skin feature counts</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mlDetections.skin_problem_counts)
                      .filter(([, count]) => count > 0)
                      .map(([feature, count]) => (
                        <Badge key={feature} color="gray">{feature.replace(/-/g, ' ')}: {count}</Badge>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Recommendations */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recommendations</h2>
        {Object.entries(recommendationsToShow).filter(([k]) => k !== 'disclaimer').map(([condition, rec]) => {
          const RecIcon = REC_TYPE_ICON[rec.type] ?? Pill
          return (
            <Card key={condition} className="p-5">
              <div className="flex justify-between items-center mb-2 gap-2">
                <h3 className="font-medium capitalize text-gray-900 dark:text-gray-100">{condition}</h3>
                <div className="flex items-center gap-1.5">
                  {rec.escalated && (
                    <Badge color="amber" icon={ArrowUpCircle}>Escalated</Badge>
                  )}
                  <Badge color="gray" icon={RecIcon}>{rec.type}</Badge>
                </div>
              </div>
              {rec.escalated && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Previous remedies for this condition haven't helped, so this recommendation was bumped up a tier.
                </p>
              )}
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {rec.examples.map((e) => <li key={e}>{e}</li>)}
              </ul>
              {rec.duration_weeks && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Duration: {rec.duration_weeks} weeks</p>
              )}
              {rec.type === 'Referral' && (
                <Button as={Link} to="/appointments" size="sm" icon={CalendarPlus} className="mt-3">
                  Book Appointment
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <ClinicalFooter modelPowered={modelPowered} disclaimer={recommendations.disclaimer} />

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/')} icon={ScanFace}>
          New Analysis
        </Button>
        {sessionId && (
          <Button as={Link} to={`/report/${sessionId}`} variant="outline" icon={FileText}>
            View Report
          </Button>
        )}
        {patientId && (
          <Button as={Link} to={`/progress/${patientId}`} variant="outline" icon={TrendingUp}>
            View Progress
          </Button>
        )}
      </div>
    </div>
  )
}
