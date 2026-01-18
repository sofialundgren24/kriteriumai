'use client'
import { useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useRouter } from 'next/navigation'

export default function EditProfileForm({ profile, userId }: { profile: any, userId: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [username, setUsername] = useState(profile?.username || '')
  const [grade, setGrade] = useState(profile?.grade || '')
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleSave = async () => {
    setLoading(true)
    
    const { error } = await supabase
      .from('profiles')
      .update({ username: username, grade: grade })
      .eq('id', userId)

    if (!error) {
      setIsEditing(false)
      router.refresh() 
    } else {
      alert("Kunde inte spara: " + error.message)
    }
    
    setLoading(false)
  }

  if (!isEditing) {
    return (
      <button 
        onClick={() => setIsEditing(true)}
        className="text-sm text-blue-600 hover:underline mt-1"
      >
        Redigera profil inställningar
      </button>
    )
  }

  return (
    <div className="mt-4 p-4 bg-white border rounded-xl space-y-3">
      <input 
        className="w-full p-2 border rounded" 
        value={username} 
        onChange={(e) => setUsername(e.target.value)} 
        placeholder={profile.username}
      />
      <select 
        className="w-full p-2 border rounded" 
        value={grade} 
        onChange={(e) => setGrade(e.target.value)}
      >
        <option value="">Välj årskurs</option>
        <option value="7">Årskurs 7</option>
        <option value="8">Årskurs 8</option>
        <option value="9">Årskurs 9</option>
      </select>
      <div className="flex gap-2">
        <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded">Spara</button>
        <button onClick={() => setIsEditing(false)} className="bg-slate-200 px-3 py-1 rounded">Avbryt</button>
      </div>
    </div>
  )
}