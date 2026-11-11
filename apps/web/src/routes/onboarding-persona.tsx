import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonaCarousel } from '../components/redesign/PersonaCarousel'
import { type PersonaKey } from '../components/redesign/brand'
import { api } from '../lib/api'
import { errorToast } from '../lib/errors'
import { announcePicture } from '../lib/picture'
import { toastError, toastSuccess } from '../lib/toast'
import '@/styles/redesign/index.css'

/**
 * S11: Persona selection screen
 * Students pick their Box Boy persona during onboarding
 * Optional in Settings (photo upload is the alternative)
 */
export default function OnboardingPersonaRoute() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<PersonaKey>('go-getter')
  const [saving, setSaving] = useState(false)
  
  const handleContinue = async () => {
    setSaving(true)
    try {
      // Cache persona for offline (PWA requirement)
      try {
        localStorage.setItem('unify_persona', selected)
      } catch {
        // Ignore quota errors in private browsing
      }
      // Through the API: a browser-side profiles update is blocked by RLS.
      await api.setPersona(selected)
      announcePicture()
      toastSuccess('Persona selected!')

      // Continue to next onboarding step (or back to Me when editing)
      const isEdit = new URLSearchParams(window.location.search).get('edit') === '1'
      navigate(isEdit ? '/me' : '/onboarding/finish')
    } catch (err) {
      errorToast(err, 'save your Box Boy')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    // Skip is allowed (persona is optional, photo upload in Settings)
    const isEdit = new URLSearchParams(window.location.search).get('edit') === '1'
    navigate(isEdit ? '/me' : '/onboarding/finish')
  }
  
  return (
    <div className="screen">
      <div className="pad stack" style={{ flex: 1, justifyContent: 'center', gap: 40, paddingTop: 60, paddingBottom: 40 }}>
        <div className="stack center" style={{ gap: 12 }}>
          <h1 className="display" style={{ fontSize: 28, fontFamily: 'var(--font-headline, var(--font-display))' }}>
            PICK YOUR<br />PERSONA
          </h1>
          <p className="t-15 muted" style={{ maxWidth: 320 }}>
            This is who you are. Your notes, tips and stats will match.
          </p>
        </div>
        
        <PersonaCarousel selected={selected} onSelect={setSelected} />
        
        <div className="bottom-actions" style={{ position: 'relative', marginTop: 'auto' }}>
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="btn btn--amber btn--block"
            style={{ height: 56 }}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="link-btn"
            style={{ color: 'var(--u-text-3)', textAlign: 'center', width: '100%' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

