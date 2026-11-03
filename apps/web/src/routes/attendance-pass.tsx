import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, Button } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'
import { generateKeyPair, exportPublicKey, signPayload } from '../lib/crypto'

export default function AttendancePassRoute() {
  const [seed, setSeed] = useState(1)
  const [left, setLeft] = useState(30)
  const [payload, setPayload] = useState('')

  useEffect(()=>{
    const t = setInterval(()=> {
      setLeft(s=>{ if(s<=1){ setSeed(x=>x+1); return 30 } return s-1 })
    },1000)
    return ()=>clearInterval(t)
  },[])

  useEffect(()=>{
    const init = async ()=>{
      const sb = supabaseBrowser()
      if(!sb) return
      const { data:{ user } } = await sb.auth.getUser()
      if(!user) return
      // load or create keypair
      let priv = localStorage.getItem('attendance_priv')
      let pub = localStorage.getItem('attendance_pub')
      if(!priv || !pub){
        const kp = await generateKeyPair()
        const pubB64 = await exportPublicKey(kp.publicKey)
        // store private key as JWK string for demo
        const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
        localStorage.setItem('attendance_priv', JSON.stringify(jwk))
        localStorage.setItem('attendance_pub', pubB64)
        // register pubkey
        await sb.from('device_keys').upsert({ user_id: user.id, device_pubkey: pubB64 })
      }
      const date = new Date().toISOString().slice(0,10)
      const pl = JSON.stringify({ uid: user.id, seed, date })
      // sign
      const jwk = JSON.parse(localStorage.getItem('attendance_priv')||'{}')
      const privKey = await crypto.subtle.importKey('jwk', jwk, { name:'ECDSA', namedCurve:'P-256'}, true, ['sign'])
      const sig = await signPayload(pl, privKey)
      setPayload(JSON.stringify({ payload: pl, sig, pub }))
    }
    init()
  },[seed])

  const PassCode = ({seed}:{seed:number})=>{
    const cells = Array.from({length:21*21},(_,i)=>((i*7919+seed*104729)%13)<6)
    return <div style={{display:'grid',gridTemplateColumns:'repeat(21,1fr)',width:220,height:220,background:'#fff',padding:10,borderRadius:16}}>
      {cells.map((on,i)=><span key={i} style={{background:on?'#0a0a0a':'#fff',width:8,height:8}}/>)}
    </div>
  }

  return (
    <Screen>
      <TopBar title="Attendance pass" />
      <div style={{ padding: 16, display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <Card tone="dark" pad={24}>
          <div style={{ textAlign:'center', display:'grid', placeItems:'center', gap:12 }}>
            <BoxBoy pose="wavePhone" width={100}/>
            <PassCode seed={seed}/>
            <p style={{color:'var(--u-on-dark-2)'}}>New code in {left}s</p>
            <p style={{color:'var(--u-on-dark-2)'}}>Crypto-signed · valid today</p>
            <details style={{color:'var(--u-on-dark-2)', fontSize:12}}>
              <summary>Debug payload</summary>
              <pre style={{whiteSpace:'pre-wrap', wordBreak:'break-all'}}>{payload}</pre>
            </details>
          </div>
        </Card>
        <Button variant="amber">Refresh</Button>
      </div>
    </Screen>
  )
}
