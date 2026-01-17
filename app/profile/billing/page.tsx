// app/profile/billing/page.tsx
import { createClient } from '../../../utils/supabaseServer'
import { redirect } from 'next/navigation'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const supabase = await createClient()
  
  // 1. Kontrollera om användaren är inloggad
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Kontrollera om användaren faktiskt är en betalande kund
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_paying')
    .eq('id', user.id)
    .single()

  if (!profile?.is_paying) {
    // Om de inte betalar, skicka dem till prissidan
    redirect('/pricing')
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Din Prenumeration</h1>
      <div className="bg-white shadow rounded-2xl p-6 border border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500 uppercase font-semibold">Status</p>
            <p className="text-lg font-medium text-green-600">Aktiv (Pro)</p>
          </div>
          <BillingClient />
        </div>
      </div>
    </div>
  )
}