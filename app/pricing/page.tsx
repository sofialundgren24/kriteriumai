'use client'

export default function PricingPage() {
  const handleBuy = async () => {
    // 1. Anropa din osynliga API-route (route.ts)
    const res = await fetch('/api/checkout', {
      method: 'POST',
    })

    const data = await res.json()

    console.log("Data recieved from checkout endpoint", data)

    if (data.url) {
      // 2. Om allt gick bra, skicka användaren till Stripe!
      window.location.href = data.url
    } else {
      console.error("Något gick fel:", data.error)
      alert("Kunde inte starta betalning. Är du inloggad?")
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-6">Testa Betalning</h1>
      <div className="p-8 bg-white shadow-xl rounded-2xl border border-slate-200 text-center">
        <h2 className="text-xl font-semibold">Pro Plan</h2>
        <p className="text-slate-500 mb-6">99 kr / månad</p>
        <button 
          onClick={handleBuy}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
        >
          Köp Pro Nu
        </button>
      </div>
    </div>
  )
}