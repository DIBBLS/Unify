import { useState } from 'react'
import { BoxBoy } from '../components/redesign/brand'

export default function HocDashboard(){
  const [posts,setPosts]=useState([{id:1,title:'Announcement',content:'Welcome'}])
  return (
    <div style={{padding:24}}>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <BoxBoy pose="teaching" width={64}/>
        <h1 style={{margin:0,fontFamily:'var(--font-headline)'}}>Head of Class</h1>
      </div>
      <ul style={{listStyle:'none',padding:0}}>
        {posts.map(p=><li key={p.id} style={{padding:'12px 0',borderBottom:'1px solid var(--u-border)'}}><strong>{p.title}:</strong> {p.content}</li>)}
      </ul>
      <button onClick={()=>setPosts(p=>[...p,{id:Date.now(),title:'New post',content:'...'}])} style={{marginTop:16,padding:'10px 16px',background:'var(--u-amber)',borderRadius:12,border:'none',fontWeight:700}}>New post</button>
    </div>
  )
}

