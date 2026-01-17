'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const [isPaying, setIsPaying] = useState<boolean | null>(null) 
  const router = useRouter()

  useEffect(() => {
    async function checkProStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('is_paying')
          .eq('id', user.id)
          .single()
        setIsPaying(data?.is_paying || false)
      } else {
        setIsPaying(false)
      }
    }
    checkProStatus()
  }, [])

  const handleBuy = async () => {
    const res = await fetch('/api/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
    // Skickar användare till stripe checkout 
      window.location.href = data.url
    } else {
      alert("Kunde inte starta betalning. Är du inloggad?")
    }
  }

 
  if (isPaying === null) return <div className="flex justify-center mt-20">Laddar...</div>

  
  if (isPaying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-center p-4">
        <h1 className="text-3xl font-bold mb-4">Du är redan Pro</h1>
        <p className="text-slate-600 mb-8">Tack för att du använder Kriterium AI. Du har redan tillgång till allt.</p>
        <button 
          onClick={() => router.push('/chat')}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold"
        >
          Tillbaka till lektionerna
        </button>
      </div>
    )
  }

 
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-6">Lås upp din fulla potential</h1>
      <div className="p-8 bg-white shadow-xl rounded-2xl border border-slate-200 text-center max-w-sm">
        <h2 className="text-xl font-semibold">Pro Plan</h2>
        <ul className="text-left my-6 space-y-2 text-slate-600">
          <li>Obegränsat antal lektioner</li>
          <li>Spara din historik</li>
          <li>Personliga flashcards</li>
        </ul>
        <p className="text-2xl font-bold mb-6">99 kr <span className="text-sm font-normal text-slate-400">/ mån</span></p>
        <button 
          onClick={handleBuy}
          className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          Bli Pro Nu
        </button>
      </div>
    </div>
  )
}