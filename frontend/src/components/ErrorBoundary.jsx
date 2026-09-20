import { Component } from 'react'
import { AlertOctagon } from 'lucide-react'
import Button from './ui/Button'

// Catches render-time exceptions anywhere in the tree below it. Without
// this, an uncaught error white-screens the entire app with no recovery UI.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="max-w-sm text-center">
            <AlertOctagon className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
