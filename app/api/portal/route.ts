// app/api/portal/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../utils/supabaseServer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
  apiVersion: '2023-10-16' as any 
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })

  // Hämta kunden från Stripe via e-post
  const customers = await stripe.customers.list({ email: user.email!, limit: 1 })
  
  if (customers.data.length === 0) {
    return NextResponse.json({ error: 'Ingen kund hittades' }, { status: 404 })
  }

  // Skapa en länk till Stripes egna hanteringssida
  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile/billing`,
  })

  return NextResponse.json({ url: session.url })
}