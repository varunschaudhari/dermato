import { ShieldCheck } from 'lucide-react'

/**
 * Method attribution + medical disclaimer, shown at the bottom of every
 * analysis surface (Results, Report). One designed treatment app-wide
 * instead of a bare italic line.
 */
export default function ClinicalFooter({ modelPowered = false, analyzedAt, disclaimer }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/60 px-5 py-4 flex items-start gap-3">
      <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p className="font-semibold text-gray-600 dark:text-gray-300">
          Analyzed with the Dermato Weighted Severity Index (WSI)
          {modelPowered ? ' + AI detection models' : ' — classical computer vision'}
          {analyzedAt && (
            <span className="font-normal text-gray-400 dark:text-gray-500">
              {' · '}
              {new Date(analyzedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
        </p>
        <p>
          {disclaimer ||
            'For informational use only. This analysis is not a diagnosis and does not replace a clinical examination — please consult a dermatologist for medical advice.'}
        </p>
      </div>
    </div>
  )
}
