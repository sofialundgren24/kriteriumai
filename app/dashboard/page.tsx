// dashboard/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabaseServer";

import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Hämta sparade lektioner för den inloggade användaren
  const { data: lessons, error } = await supabase
    .from('saved_lessons')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }); // Nyast först

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      
      <h2 className="text-2xl font-semibold mb-4">Dina sparade lektioner</h2>

      {/* 2. Loopa igenom lektionerna */}
      {lessons && lessons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="border p-5 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg text-blue-600">{lesson.title}</h3>
              <p className="text-sm text-slate-500 mb-4">
                Sparad: {new Date(lesson.created_at).toLocaleDateString('sv-SE')}
              </p>
              
              {/* Exempel på hur du visar en del av datan (t.ex. antal flashcards) */}
              <div className="text-sm text-slate-600">
                {lesson.full_data?.flashcards?.items?.length || 0} st minneskort
              </div>
              
              <Link 
                href={`/lessons/${lesson.id}`} 
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Öppna lektion →
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 italic">Du har inga sparade lektioner ännu.</p>
      )}
    </div>
  );
}