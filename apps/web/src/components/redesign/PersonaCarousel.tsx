import { useState } from 'react'
import { PERSONAS, Avatar, type PersonaKey } from './brand'

interface PersonaCarouselProps {
  selected: PersonaKey
  onSelect: (persona: PersonaKey) => void
}

/**
 * S11: Box Boy persona carousel
 * Curved layout, selected center, neighbors fade
 * Swipe or tap to move
 */
export function PersonaCarousel({ selected, onSelect }: PersonaCarouselProps) {
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  
  const selectedIndex = PERSONAS.findIndex(p => p.key === selected)
  
  const handlePrev = () => {
    if (selectedIndex > 0) {
      setDirection('right')
      onSelect(PERSONAS[selectedIndex - 1].key)
      setTimeout(() => setDirection(null), 300)
    }
  }
  
  const handleNext = () => {
    if (selectedIndex < PERSONAS.length - 1) {
      setDirection('left')
      onSelect(PERSONAS[selectedIndex + 1].key)
      setTimeout(() => setDirection(null), 300)
    }
  }
  
  const selectedPersona = PERSONAS[selectedIndex]
  
  return (
    <div className="stack" style={{ gap: 32, alignItems: 'center' }}>
      {/* Carousel */}
      <div style={{ position: 'relative', width: '100%', height: 180, overflow: 'hidden' }}>
        <div 
          className="row" 
          style={{ 
            position: 'absolute', 
            left: '50%',
            top: 0,
            // Put the chosen persona's centre on the screen's centre:
            // each slot is 120px wide plus a 20px gap, so slot i's centre is i*140 + 60.
            transform: `translateX(-${selectedIndex * 140 + 60}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            gap: 20,
            paddingTop: 20
          }}
        >
          {PERSONAS.map((persona, i) => {
            const isSelected = i === selectedIndex
            const distance = Math.abs(i - selectedIndex)
            const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.25
            const scale = isSelected ? 1 : distance === 1 ? 0.85 : 0.7
            const y = isSelected ? 0 : distance === 1 ? 15 : 25
            
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
                  cursor: isSelected ? 'default' : 'pointer',
                  opacity,
                  transform: `scale(${scale}) translateY(${y}px)`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0
                }}
                aria-label={persona.title}
                aria-pressed={isSelected}
              >
                <Avatar persona={persona.key} size={120} ring={isSelected} />
              </button>
            )
          })}
        </div>
        
        {/* Navigation arrows */}
        {selectedIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="btn btn--sm btn--ghost-dark"
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
            aria-label="Previous persona"
          >
            ←
          </button>
        )}
        {selectedIndex < PERSONAS.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="btn btn--sm btn--ghost-dark"
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}
            aria-label="Next persona"
          >
            →
          </button>
        )}
      </div>
      
      {/* Selected persona details */}
      <div className="stack center" style={{ gap: 12, maxWidth: 320, width: '100%', margin: '0 auto', alignItems: 'center' }}>
        <h2 className="display" style={{ fontSize: 24, fontFamily: 'var(--font-headline, var(--font-display))' }}>
          {selectedPersona.title.toUpperCase()}
        </h2>
        <p className="t-14 muted" style={{ lineHeight: 1.5 }}>
          {selectedPersona.blurb}
        </p>
        <div className="row wrap" style={{ gap: 8, justifyContent: 'center', marginTop: 8 }}>
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

