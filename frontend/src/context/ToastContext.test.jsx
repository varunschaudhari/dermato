import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
  const toast = useToast()
  return (
    <button onClick={() => toast.success('Patient added.')}>fire toast</button>
  )
}

describe('ToastContext', () => {
  it('shows a toast when pushed, and removes it on dismiss', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    await userEvent.click(screen.getByRole('button', { name: 'fire toast' }))
    expect(await screen.findByText('Patient added.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    await waitFor(() => expect(screen.queryByText('Patient added.')).not.toBeInTheDocument())
  })
})
