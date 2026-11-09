import { useState } from 'react'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, Button, Segmented } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'

export default function LecturerHome() {
  const [tab,setTab]=useState<'home'|'timetable'|'course'|'actions'|'attendance'|'me'>('home')
  return (
    <Screen>
      <TopBar title="Lecturer" />
      <div style={{padding:16, display:'grid', gap:16}}>
        <Card tone="light">
          <Segmented options={['home','timetable','course','actions','attendance','me']} value={tab} onChange={v=>setTab(v as any)} />
        </Card>
        {tab==='home' && (
          <Card tone="dark">
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <BoxBoy pose="teaching" width={80}/>
              <div style={{flex:1}}>
                <h2 style={{margin:0, fontFamily:'var(--font-headline)'}}>Today</h2>
                <p style={{color:'var(--u-on-dark-2)'}}>One main action per screen</p>
              </div>
              <Button variant="amber" onClick={()=>{}}>Confirm class / Open scan</Button>
            </div>
          </Card>
        )}
        {tab==='timetable' && <Card tone="light"><h3 style={{fontFamily:'var(--font-headline)'}}>Timetable view</h3><p>Week view with amber CTA for new class</p></Card>}
        {tab==='course' && <Card tone="light"><h3 style={{fontFamily:'var(--font-headline)'}}>Course weeks</h3><p>Weeks / Report / Attendance tabs</p></Card>}
        {tab==='actions' && <Card tone="light"><h3 style={{fontFamily:'var(--font-headline)'}}>Actions</h3><p>Review week / Send materials / Post to students</p><Button variant="amber">Post materials</Button></Card>}
        {tab==='attendance' && <Card tone="light"><h3 style={{fontFamily:'var(--font-headline)'}}>Attendance</h3><p>List with export CSV</p></Card>}
        {tab==='me' && <Card tone="light"><h3 style={{fontFamily:'var(--font-headline)'}}>Me</h3><p>Lecturer profile settings</p></Card>}
      </div>
    </Screen>
  )
}

