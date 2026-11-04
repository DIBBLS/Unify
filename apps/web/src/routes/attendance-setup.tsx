import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseBrowser } from '../lib/supabase'
import { toastError, toastSuccess } from '../lib/toast'
import { Button } from '../components/redesign/ui'
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
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <BoxBoy pose="keyHandover" width={64} />
        <h1 style={{ margin: 0, fontFamily: 'var(--font-headline)' }}>Attendance setup</h1>
      </div>
      <p>This is for attendance. Heads of Class see this name when they scan your pass.</p>
      <label>Full name</label>
      <input value={fullName} onChange={e=>setFullName(e.target.value)} style={{ width:'100%', padding:8, margin:'8px 0', borderRadius:12, border:'1px solid var(--u-border)', background:'var(--u-card)' }} />
      <label>Matric number</label>
      <input value={matric} onChange={e=>setMatric(e.target.value)} style={{ width:'100%', padding:8, margin:'8px 0', borderRadius:12, border:'1px solid var(--u-border)', background:'var(--u-card)' }} />
      <Button onClick={save} disabled={saving} variant="amber" style={{ marginTop:12 }}>{saving?'Saving...':'Save and get pass'}</Button>
    </div>
  )
}
