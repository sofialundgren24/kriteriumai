// app/profile/billing/BillingClient.tsx
'use client'
import { useState } from 'react'

export default function BillingClient() {
  const [loading, setLoading] = useState(false)

  const handleManage = async () => {
    setLoading(true)
    try {
      // Vi anropar en API-route som skapar en portal-länk (se punkt 3)
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json()
      
      if (data.url) {
        window.location.href = data.url // Skicka användaren till Stripe
      }
    } catch (err) {
      alert("Kunde inte öppna inställningar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleManage}
      disabled={loading}
      className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
    >
      {loading ? 'Laddar...' : 'Hantera Betalning'}
    </button>
  )
}