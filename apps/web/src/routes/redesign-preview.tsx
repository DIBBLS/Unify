import { Screen, TopBar } from '../components/redesign/chrome'
import { BoxBoy } from '../components/redesign/brand'
import { Card, Button } from '../components/redesign/ui'

export default function RedesignPreview(){
  return (
    <Screen>
      <div style={{ padding: 16 }}>
        <TopBar title="Unify Learn v2 Preview" />
        <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <BoxBoy pose="cheer" width={120} />
              <div>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-headline)' }}>New mascot & brand</h2>
                <p>Box Boy avatars default in onboarding. Photo upload optional in Settings.</p>
              </div>
            </div>
          </Card>
          <Card>
            <h3>Color tokens</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 80, height: 80, background: 'var(--u-amber)', borderRadius: 16 }} />
              <div style={{ width: 80, height: 80, background: 'var(--u-green)', borderRadius: 16 }} />
              <div style={{ width: 80, height: 80, background: 'var(--u-black)', borderRadius: 16 }} />
              <div style={{ width: 80, height: 80, background: 'var(--u-red)', borderRadius: 16 }} />
            </div>
            <p style={{ marginTop: 12 }}>Primary CTA = amber #fbbf24. Dark mode live.</p>
          </Card>
          <Card>
            <h3>Typography</h3>
            <p style={{ fontFamily: 'var(--font-display)' }}>Playfair Display — hero</p>
            <p style={{ fontFamily: 'var(--font-body)' }}>DM Sans / Nunito — body</p>
            <p style={{ fontFamily: 'var(--font-headline)' }}>Bowlby One SC — new headlines</p>
          </Card>
          <Button>Primary CTA amber</Button>
          <div style={{ marginTop: 32 }}>
            <h3>Screens remaining for redesign polish</h3>
            <ul>
              <li>/attendance/setup, /attendance/pass, /attendance/my, /attendance/scanner — apply Screen/TopBar/Button/Card</li>
              <li>/hoc/request and HOC dashboard — redesign tokens, amber CTA</li>
              <li>/online-class — wrap Meet/Zoom UI with redesign</li>
              <li>/lecturer/redesign — finish L01-L20 flow with new tokens</li>
              <li>PWA cache bust instructions for users</li>
            </ul>
          </div>
        </div>
      </div>
    </Screen>
  )
}