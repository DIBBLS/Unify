import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERSONAS, Avatar, type PersonaKey } from './brand'

interface PersonaCarouselProps {
  selected: PersonaKey
  onSelect: (persona: PersonaKey) => void
}

/**
 * S11 / Review 3 C15: Box Boy persona picker.
 * One big avatar with arrow buttons right beside it, "1 of 5" with dots
 * (each dot jumps to that persona), and swipe left/right on the avatar.
 */
export function PersonaCarousel({ selected, onSelect }: PersonaCarouselProps) {
  const selectedIndex = Math.max(0, PERSONAS.findIndex(p => p.key === selected))
  const go = (i: number) => { if (i >= 0 && i < PERSONAS.length) onSelect(PERSONAS[i].key) }
  const touchX = useRef<number | null>(null)
  const selectedPersona = PERSONAS[selectedIndex]
  const arrow = (dir: -1 | 1) => {
    const off = dir < 0 ? selectedIndex === 0 : selectedIndex === PERSONAS.length - 1
    const Icon = dir < 0 ? ChevronLeft : ChevronRight
    return (
      <button
        type="button"
        onClick={() => go(selectedIndex + dir)}
        disabled={off}
        aria-label={dir < 0 ? 'Previous persona' : 'Next persona'}
        style={{
          width: 48, height: 48, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', opacity: off ? 0.3 : 1,
        }}
      >
        <Icon size={24} />
      </button>
    )
  }

  return (
    <div className="stack" style={{ gap: 16, alignItems: 'center' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 40) go(selectedIndex + (dx < 0 ? 1 : -1))
        }}
      >
        {arrow(-1)}
        <Avatar key={selectedPersona.key} persona={selectedPersona.key} size={168} />
        {arrow(1)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="t-13 w-7" aria-live="polite">{selectedIndex + 1} of {PERSONAS.length}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {PERSONAS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`${p.name} (${i + 1} of ${PERSONAS.length})`}
              aria-current={i === selectedIndex}
              style={{ width: i === selectedIndex ? 20 : 8, height: 8, padding: 0, border: 0, borderRadius: 9999, background: i === selectedIndex ? 'var(--text)' : 'var(--border)', transition: 'width .2s' }}
            />
          ))}
        </span>
      </div>

      <div className="stack center" style={{ gap: 8, maxWidth: 320, width: '100%', margin: '0 auto', alignItems: 'center', textAlign: 'center' }}>
        <span className="t-12 w-7 muted" style={{ textTransform: 'uppercase', letterSpacing: 1.5 }}>{selectedPersona.name}</span>
        <h2 className="display" style={{ fontSize: 24, fontFamily: 'var(--font-headline, var(--font-display))' }}>
          {selectedPersona.title.toUpperCase()}
        </h2>
        <p className="t-14 muted" style={{ lineHeight: 1.5 }}>
          {selectedPersona.blurb}
        </p>
        <div className="row wrap" style={{ gap: 8, justifyContent: 'center', marginTop: 4 }}>
          {selectedPersona.traits.map(trait => (
            <span key={trait} className="pill pill--grey">
              {trait}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Lightweight version for settings/profile edit
 * Shows all 5 in a row, no carousel
 */
export function PersonaPicker({ selected, onSelect }: PersonaCarouselProps) {
  return (
    <div className="row wrap" style={{ gap: 16, justifyContent: 'center' }}>
      {PERSONAS.map(persona => {
        const isSelected = persona.key === selected
        return (
          <button
            key={persona.key}
            type="button"
            onClick={() => onSelect(persona.key)}
            className="no-select"
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              opacity: isSelected ? 1 : 0.5,
              transition: 'opacity 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}
            aria-label={persona.title}
            aria-pressed={isSelected}
          >
            <Avatar persona={persona.key} size={80} ring={isSelected} />
            <span className="t-12 w-6" style={{ color: isSelected ? 'var(--u-text)' : 'var(--u-text-2)' }}>
              {persona.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

