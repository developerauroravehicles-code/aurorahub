import { describe, expect, it } from 'vitest'
import { isNovaCamera, resolveDashcamAppLinks } from '@/lib/dashcam-app-links'

describe('dashcam-app-links', () => {
  it('routes Nova cameras to HikDashcam', () => {
    const links = resolveDashcamAppLinks('AURORA NOVA / 2 Channel')
    expect(links.appName).toBe('HikDashcam')
    expect(links.androidUrl).toContain('com.hikvision.dashcam.foreign')
    expect(links.iosUrl).toContain('hikdashcam')
  })

  it('routes non-Nova cameras to Viidure', () => {
    const links = resolveDashcamAppLinks('Hawk Vision')
    expect(links.appName).toBe('Viidure')
    expect(links.androidUrl).toContain('com.vidure.app')
    expect(links.iosUrl).toContain('viidure')
  })

  it('defaults null or empty model to Viidure', () => {
    expect(resolveDashcamAppLinks(null).appName).toBe('Viidure')
    expect(resolveDashcamAppLinks('').appName).toBe('Viidure')
    expect(resolveDashcamAppLinks(undefined).appName).toBe('Viidure')
  })

  it('detects Nova case-insensitively', () => {
    expect(isNovaCamera('nova pro')).toBe(true)
    expect(isNovaCamera('NOVA')).toBe(true)
    expect(isNovaCamera('Hawk Vision')).toBe(false)
  })
})
