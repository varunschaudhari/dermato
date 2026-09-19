import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Badge, { SEVERITY } from './Badge'

describe('Badge', () => {
  it('renders its children text', () => {
    render(<Badge color="brand">mild</Badge>)
    expect(screen.getByText('mild')).toBeInTheDocument()
  })

  it('renders an icon when one is provided', () => {
    const { container } = render(<Badge icon={SEVERITY.severe.icon}>severe</Badge>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('defines a distinct color + icon for every severity level, not color alone', () => {
    expect(SEVERITY.mild.color).not.toBe(SEVERITY.moderate.color)
    expect(SEVERITY.moderate.color).not.toBe(SEVERITY.severe.color)
    expect(SEVERITY.mild.icon).not.toBe(SEVERITY.moderate.icon)
    expect(SEVERITY.moderate.icon).not.toBe(SEVERITY.severe.icon)
  })
})
