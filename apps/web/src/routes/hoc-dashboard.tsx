import { useState } from 'react'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, ListCard, ListRow, Button } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'

export default function HocDashboard(){
  const [posts,setPosts]=useState([{id:1,title:'Announcement',content:'Welcome'}])
  return (
    <Screen>
      <TopBar title="Head of Class" />
      <div style={{padding:16, display:'grid', gap:16}}>
        <Card tone="light">
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <BoxBoy pose="teaching" width={80}/>
            <div>
              <h2 style={{margin:0, fontFamily:'var(--font-headline)'}}>HOC Dashboard</h2>
              <p style={{color:'var(--u-text-2)', marginTop:4}}>Manage posts, attendance and materials</p>
            </div>
          </div>
        </Card>
        <ListCard>
          {posts.map(p=>(
            <ListRow key={p.id} title={p.title} sub={p.content} />
          ))}
        </ListCard>
        <Button variant="amber" onClick={()=>setPosts(p=>[...p,{id:Date.now(),title:'New post',content:'...'}])}>New post</Button>
      </div>
    </Screen>
  )
}
