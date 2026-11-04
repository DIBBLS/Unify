import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase'
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
    <div style={{padding:24}}>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <BoxBoy pose="readingStanding" width={64}/>
        <h1 style={{margin:0,fontFamily:'var(--font-headline)'}}>My Attendance</h1>
      </div>
      <ul style={{listStyle:'none',padding:0}}>
        {rows.map(r=><li key={r.scanned_at} style={{padding:'12px 0',borderBottom:'1px solid var(--u-border)'}}>{r.course_code} - {new Date(r.scanned_at).toLocaleDateString()}</li>)}
      </ul>
      {rows.length===0 && <p style={{color:'var(--u-text-2)'}}>No records yet</p>}
    </div>
  )
}
