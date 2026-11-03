import { useState } from 'react'
import { Screen, TopBar } from '../components/redesign/chrome'
import { Card, Button } from '../components/redesign/ui'
import { BoxBoy } from '../components/redesign/brand'
import { supabaseBrowser } from '../lib/supabase'
import { importPublicKey, verifyPayload } from '../lib/crypto'

export default function ScannerRoute(){
  const [log,setLog]=useState<string[]>([])
  const [verifying,setVerifying]=useState(false)

  const simulateScan = async ()=>{
    setVerifying(true)
    try{
      // demo payload: in real app decode QR
      const demo = { uid:'demo-user', seed:1, date:new Date().toISOString().slice(0,10) }
      const payload = JSON.stringify(demo)
      const sig = 'demo-sig'
      // fetch public key
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
    <Screen>
      <TopBar title="Scan attendance" />
      <div style={{padding:16, display:'grid', gap:16}}>
        <Card tone="light">
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <BoxBoy pose="teaching" width={80}/>
            <div>
              <h3 style={{margin:0, fontFamily:'var(--font-headline)'}}>Camera scan</h3>
              <p style={{color:'var(--u-text-2)', marginTop:4}}>Point at student pass – QR contains signed payload</p>
            </div>
          </div>
        </Card>
        <div style={{height:300,borderRadius:24,background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {verifying ? 'Verifying...' : 'Camera placeholder'}
        </div>
        <Card tone="light">
          <ul style={{margin:0,paddingLeft:16}}>
            {log.map((l,i)=><li key={i}>{l}</li>)}
          </ul>
        </Card>
        <Button variant="amber" onClick={simulateScan} disabled={verifying}>Simulate scan</Button>
      </div>
    </Screen>
  )
}
