// app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../utils/supabaseServer' 

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any })

export async function POST() {
  // Skapa klienten
  const supabase = await createClient()

  // 2. Hämta användaren på servern via cookies
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, 
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/chat?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/chat?canceled=true`,
      metadata: { 
        supabase_user_id: user.id 
      } 
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}