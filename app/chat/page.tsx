'use client'
import { useState, useRef, useEffect } from 'react'
import { triggerAiJob } from '../../services/aiAction'; 
import QuizCard from '../../components/chat/QuizCard'
import { supabase } from '../../utils/supabaseClient'

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<any>(null)
  const [isWorking, setIsWorking] = useState<boolean>(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [quizDone, setQuizDone] = useState(false) // Ny state för att låsa upp flashcards

  // Autoscroll till botten när nytt innehåll dyker upp
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [result, status])

  const handleSend = async () => {
    if (!input.trim() || isWorking) return;

    setIsWorking(true)
    setQuizDone(false)
    setResult(null)
    if (!input.trim()) return
    const currentInput = input
    setInput('') // Rensa direkt för Gemini-känsla
    setStatus('Tänker...')
    
    try {
    const jobId = await triggerAiJob(currentInput, "laroplan_1-9_fysik.txt");
    
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'activity_jobs', 
          filter: `job_id=eq.${jobId}` 
        }, 
        (payload) => {
          if (payload.new.status === 'COMPLETED') {
            setResult(payload.new.result_data);
            console.log("RESULT retrieved", result)
            setStatus('');
            setIsWorking(false); // NU är vi klara!
            supabase.removeChannel(channel);
          }
        }
      )
      .subscribe();
      } catch (err) {
        setStatus('Något gick fel. Försök igen.');
        setIsWorking(false); // Återställ knappen vid fel
        console.error(err);
      }
  };

  const saveLesson = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('saved_lessons').insert({
      user_id: user?.id,
      title: input || "Fysiklektion",
      full_data: result 
    })
    alert("Sparat!")
  }

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans">
      
      {/* HEADER */}
      <header className="p-4 border-b flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Kriterium AI
        </h1>
      </header>

      {/* CHATT-YTA (Scrollbar) */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
      >
        <div className="max-w-3xl mx-auto w-full">
          {/* Välkomstmeddelande om ingen data finns */}
          {!result && !status && (
            <div className="text-center mt-20">
              <h2 className="text-4xl font-medium text-slate-300">Vad vill du lära dig idag?</h2>
            </div>
          )}

          {/* AI SVARET (Här kan vi senare lägga in Quiz-komponenterna) */}
         
          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
              
              {/* STEG 1: Kort introduktion/förklaring (alltid synlig) */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <h3 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-widest text-center">
                  Dagens genomgång
                </h3>
                <p className="text-slate-700 leading-relaxed text-center">
                  Här är en sammanfattning av det du ville lära dig. 
                  Svara på quizen nedan för att låsa upp dina flashcards!
                </p>
              </div>

              {/* STEG 2: Quiz (Tvingande hinder) */}
              {!quizDone ? (
                <div className="flex flex-col items-center">
                  <QuizCard 
  
                    question={result.quiz.questions[0]} 
                    onCorrect={() => setQuizDone(true)} 
                  />
                </div>
              ) : (
                /* STEG 3: Flashcards & Spara-knapp (Visas bara när quizDone === true) */
                <div className="animate-in zoom-in duration-500 space-y-6">
                  <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                    <h2 className="text-xl font-bold text-green-700 mb-4 text-center italic">
                      Snyggt svarat! Här är dina minneskort:
                    </h2>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      {result.flashcards.items.map((card: any) => (
                        <div key={card.card_id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                          <p className="font-bold text-blue-600 mb-1">{card.term}</p>
                          <p className="text-sm text-slate-600">{card.definition}</p>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={saveLesson}
                      className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg"
                    >
                      Spara lektionen i mitt bibliotek
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
                    {/* Laddningsindikator */}
          {status && (
            <div className="flex items-center gap-2 text-slate-200 italic animate-pulse">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              {status}
            </div>
          )}
        </div>
      </main>

      {/* INPUT-FÄLT (Fast i botten) */}
      <footer className="p-4 bg-white">
        <div className="max-w-3xl mx-auto relative group">
          <div className="flex items-center bg-slate-100 rounded-2xl p-2 shadow-sm focus-within:ring-2 ring-blue-500/20 transition-all">
            <input 
              className="flex-1 bg-transparent p-3 outline-none text-slate-700 min-w-0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Skriv en fråga..."
            />
            <button 
              disabled={isWorking}
              onClick={handleSend}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            Kriterium AI kan göra fel. Dubbelkolla viktig information.
          </p>
        </div>
      </footer>
    </div>
  )
}