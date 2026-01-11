import { createClient } from "../../../utils/supabaseServer";
import { notFound } from "next/navigation";

interface PageProps{
    params: Promise<{ id: string }>
}

export default async function LessonPage({ params }: PageProps)  {
  
  const { id } = await params;

  const supabase = await createClient();

  const { data: lesson, error } = await supabase
    .from('saved_lessons')
    .select('*')
    .eq('id', id)
    .single();

  if (!lesson || error) {
    return notFound();
  }

  const content = lesson.full_data;

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
      <p className="text-slate-400 text-sm mb-8">Sparad lektion</p>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-slate-700 underline decoration-blue-500 underline-offset-8">
            Dina Flashcards
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {content.flashcards?.items?.map((card: any) => (
              <div key={card.card_id} className="p-5 border rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow border-slate-100">
                <p className="font-bold text-blue-600 mb-2">{card.term}</p>
                <p className="text-slate-600 text-sm leading-relaxed">{card.definition}</p>
              </div>
            ))}
          </div>
        </section>

        
      </div>
    </div>
  );
}