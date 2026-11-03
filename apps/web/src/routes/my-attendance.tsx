import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, ListCard, ListRow } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'

export default function MyAttendanceRoute(){
  const [rows,setRows]=useState<any[]>([])
  useEffect(()=>{
    const sb = supabaseBrowser()
    if(!sb) return
    sb.auth.getUser().then(async ({data:{user}})=>{
      if(!user) return
      const {data} = await sb.from('attendance_records').select('course_code,scanned_at').eq('student_id',user.id)
      setRows(data||[])
    })
  },[])
  return (
    <Screen>
      <TopBar title="My attendance" />
      <div style={{ padding: 16 }}>
        <Card tone="light">
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <BoxBoy pose="readingStanding" width={80}/>
            <div>
              <h2 style={{margin:0, fontFamily:'var(--font-headline)'}}>Attendance history</h2>
              <p style={{color:'var(--u-text-2)', marginTop:4}}>All scans you’ve completed</p>
            </div>
          </div>
        </Card>
        <ListCard style={{ marginTop:16 }}>
          {rows.map(r=>(
            <ListRow key={r.scanned_at} title={r.course_code} sub={new Date(r.scanned_at).toLocaleDateString()} />
          ))}
          {rows.length===0 && <div style={{padding:16,color:'var(--u-text-2)'}}>No records yet</div>}
        </ListCard>
      </div>
    </Screen>
  )
}
