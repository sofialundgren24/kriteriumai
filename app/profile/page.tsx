import { createClient } from '../../utils/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EditProfileForm from './EditProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Hämta profildata (vi antar att du har dessa kolumner i 'profiles')
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, is_paying, grade')
    .eq('id', user.id)
    .single()


  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header med Profilbild och Namn */}
      <section className="flex-col md:flex-row flex items-center gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-3xl shadow-inner">
           👤
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile?.username || user.email?.split('@')[0]}</h1>
          <div className="text-sm text-gray-400">Årskurs: {profile?.grade || 'Ingen vald årskurs'}</div>
          {profile?.is_paying && (
            <span className="inline-block mt-2 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold">PRO-MEDLEM</span>
          )}
        </div>
        <EditProfileForm profile={profile} userId={user.id} />
      </section>

      {/* Stats & Badges Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100">
          <h2 className="font-bold mb-4 flex items-center gap-2">Plugg-statistik</h2>
          
          <p className="text-sm text-slate-400">Total tid spenderad i Kriterium AI</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100">
          <h2 className="font-bold mb-4 flex items-center gap-2"> Badges</h2>
          <div className="flex gap-2">
            <span className="grayscale opacity-50" title="Gör 5 lektioner"></span>
            <span className="grayscale opacity-50" title="Klarade Fysik-quiz"></span>
            <span className="grayscale opacity-50" title="Betalande medlem"></span>
            <p className="text-xs text-slate-400">Gör fler lektioner för att låsa upp!</p>
          </div>
        </div>
      </div>

      {/* Inställningar */}
      <div className="bg-slate-50 p-6 rounded-2xl">
        <h2 className="font-bold mb-4">Kontoinställningar</h2>
        <div className="space-y-3">
          <Link href="/profile/billing" className="block w-full p-3 bg-white border rounded-xl hover:bg-slate-50 transition">
             Hantera prenumeration & betalningar
          </Link>
        </div>
      </div>
    </div>
  )
}