import { useState } from 'react'
import { BoxBoy } from '../components/redesign/brand'
import { supabaseBrowser } from '../lib/supabase'
import { importPublicKey, verifyPayload } from '../lib/crypto'

export default function ScannerRoute(){
  const [log,setLog]=useState<string[]>([])
  const [verifying,setVerifying]=useState(false)

  const simulateScan = async ()=>{
    setVerifying(true)
    try{
      const demo = { uid:'demo-user', seed:1, date:new Date().toISOString().slice(0,10) }
      const payload = JSON.stringify(demo)
      const sig = 'demo-sig'
      const sb = supabaseBrowser()
      if(!sb) throw new Error('no supabase')
      const { data } = await sb.from('device_keys').select('device_pubkey').eq('user_id','demo-user').maybeSingle()
      if(!data) throw new Error('no key')
      const pub = await importPublicKey(data.device_pubkey)
      const ok = await verifyPayload(payload, sig, pub)
      setLog(l=>[...l, `Scanned ${demo.uid} – verified: ${ok}`])
    }catch(e:any){
      setLog(l=>[...l, `Scan error: ${e.message}`])
    }finally{
      setVerifying(false)
    }
  }

  return (
    <div style={{padding:24}}>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
        <BoxBoy pose="teaching" width={64}/>
        <h1 style={{margin:0,fontFamily:'var(--font-headline)'}}>Scan attendance</h1>
      </div>
      <div style={{height:300,borderRadius:24,background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
        {verifying ? 'Verifying...' : 'Camera placeholder'}
      </div>
      <ul style={{marginBottom:16}}>
        {log.map((l,i)=><li key={i}>{l}</li>)}
      </ul>
      <button onClick={simulateScan} disabled={verifying} style={{padding:'10px 16px',background:'var(--u-amber)',borderRadius:12,border:'none',fontWeight:700}}>Simulate scan</button>
    </div>
  )
}

