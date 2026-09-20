import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from './Button'

// Shared "the request failed" state, extracted from the pattern originally
// duplicated in ReportPage/PatientChartPage. Pass either `onRetry` (shows a
// "Try again" button, typically a query's `refetch`) or leave it out to get
// a "Go back" button instead — most list pages want retry, detail pages
// keyed off a route param (a patient/session that may not exist) want back.
export default function QueryError({ message = "Couldn't load this.", onRetry }) {
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <AlertTriangle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
      <p className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {onRetry ? 'Something went wrong loading this. Please try again.' : 'It may not exist, or you may not have access to it.'}
      </p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry} icon={RotateCcw}>
          Try again
        </Button>
      ) : (
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)} icon={ArrowLeft}>
          Go back
        </Button>
      )}
    </div>
  )
}
