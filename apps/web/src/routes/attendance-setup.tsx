import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseBrowser } from '../lib/supabase'
import { toastError, toastSuccess } from '../lib/toast'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, Button, Field } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'

export default function AttendanceSetupRoute() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [matric, setMatric] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!fullName || !matric) return toastError('Fill name and matric')
    setSaving(true)
    try {
      const sb = supabaseBrowser()
      if (!sb) throw new Error('Not authenticated')
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await sb.from('profiles').update({
        attendance_full_name: fullName,
        attendance_matric: matric
      }).eq('id', user.id)
      if (error) throw error
      toastSuccess('Attendance set up')
      navigate('/attendance/pass')
    } catch (e: any) {
      toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <TopBar title="Attendance setup" />
      <div style={{ padding: 16 }}>
        <Card tone="light">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <BoxBoy pose="keyHandover" width={80} />
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-headline)' }}>Set your pass details</h2>
              <p style={{ color: 'var(--u-text-2)', marginTop: 4 }}>Heads of Class see this name when they scan your pass.</p>
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <Field label="Full name" value={fullName} placeholder="Your full name" />
          {/* Controlled input via simple state for now */}
          <input value={fullName} onChange={e=>setFullName(e.target.value)} style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid var(--u-border)', background:'var(--u-card)' }} />
          <input value={matric} onChange={e=>setMatric(e.target.value)} placeholder="Matric number" style={{ width:'100%', padding:12, borderRadius:12, border:'1px solid var(--u-border)', background:'var(--u-card)' }} />
          <Button onClick={save} disabled={saving} variant="amber">{saving?'Saving...':'Save and get pass'}</Button>
        </div>
      </div>
    </Screen>
  )
}
