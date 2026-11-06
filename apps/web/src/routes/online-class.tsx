import { useState } from 'react'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, Button, Pill } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'

export default function OnlineClassRoute(){
  const [checked,setChecked]=useState([true,false,false])
  const count = checked.filter(Boolean).length
  const ok = count>=2
  return (
    <Screen>
      <TopBar title="Online Class" />
      <div style={{padding:16, display:'grid', gap:16}}>
        <Card tone={ok?'green':'light'}>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <BoxBoy pose="phoneOut" width={80}/>
            <div>
              <h2 style={{margin:0, fontFamily:'var(--font-headline)'}}>Live session</h2>
              <p style={{color:'var(--u-text-2)', marginTop:4}}>Check-ins: {count}/3</p>
            </div>
            <Pill tone={ok?'good':'amber'} style={{marginLeft:'auto'}}>{ok?'Present':'Needs 2/3'}</Pill>
          </div>
        </Card>
        <Card tone="light">
          <p>Meet/Zoom wrapper will open here. Break handling and lost-connection reporting pending.</p>
          <Button variant="amber" onClick={()=>setChecked(c=>[...c.map((v,i)=>i===0?true:v)])}>Simulate check-in</Button>
        </Card>
      </div>
    </Screen>
  )
}

