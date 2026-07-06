import { describe, it, expect } from 'vitest'
import { subState } from './subscription'

describe('subState', () => {
  it('expired takes precedence over everything', () => {
    expect(subState({ is_expired: true, is_active: true, paid_until: '2030-01-01' })).toBe('expired')
  })
  it('none when inactive', () => {
    expect(subState({ is_active: false })).toBe('none')
    expect(subState({})).toBe('none')
  })
  it('active when active with a paid_until date', () => {
    expect(subState({ is_active: true, paid_until: '2030-01-01' })).toBe('active')
  })
  it('lifetime when active with no paid_until (key access)', () => {
    expect(subState({ is_active: true, paid_until: null })).toBe('lifetime')
    expect(subState({ is_active: true })).toBe('lifetime')
  })
})
