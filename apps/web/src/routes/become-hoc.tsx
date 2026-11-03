import { useState } from 'react'
import { supabaseBrowser } from '../lib/supabase'
import { toastSuccess, toastError } from '../lib/toast'
import { useNavigate } from 'react-router-dom'

export default function BecomeHocRoute(){
  const [saving,setSaving]=useState(false)
  const navigate=useNavigate()
  const request = async ()=>{
    setSaving(true)
    try{
      const sb=supabaseBrowser()
      if(!sb) throw new Error('Not authenticated')
      const {data:{user}} = await sb.auth.getUser()
      if(!user) throw new Error('Not authenticated')
      const {error}=await sb.from('role_requests').insert({user_id:user.id,role:'head_of_class',status:'pending'})
      if(error) throw error
      toastSuccess('Request sent to admin')
      navigate('/profile')
    }catch(e:any){toastError(e.message)}finally{setSaving(false)}
  }
  return <div style={{padding:24}}><h1>Become Head of Class</h1><button onClick={request} disabled={saving}>{saving?'Sending...':'Request'}</button></div>
}
