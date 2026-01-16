'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { triggerAiJob } from '../../services/aiAction'; 
import QuizCard from '../../components/chat/QuizCard'
import { supabase } from '../../utils/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'; 
import type { ChatMessage } from '../../types/chat'


function ChatContent() {
  const [subject, setSubject] = useState('fysik')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('')
  const [isWorking, setIsWorking] = useState<boolean>(false)
  const [quizDone, setQuizDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [user, setUser] = useState<any>(null);
  const [isPaying, setIsPaying] = useState(false);

  const [saveError, setSaveError] = useState<any>(null)
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const router = useRouter()
  const channelRef = useRef<any>(null);
  const searchParams = useSearchParams()
  const urlChatId = searchParams.get('id')

  useEffect(() => {
  const getUser = async () => {
    // Hämta användaren
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_paying') // kKollar om betalande
        .eq('id', user.id)
        .single();

      if (data) {
        setIsPaying(data.is_paying);
      }
    }
  };

  getUser();
}, []);

  

  // Ladda gammal chatt
  useEffect(() => {
    if (urlChatId) {
      const loadChat = async () => {
        const { data } = await supabase
          .from('chats')
          .select('*')
          .eq('id', urlChatId)
          .single()
        
        if (data) {
          setMessages(data.full_data || [])
          setActiveChatId(data.id)
        }
      }
      loadChat()
    }
  }, [urlChatId])

  // Autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  const saveToSupabase = async (history: ChatMessage[], firstQuery: string) => {
    if (!user) return

    if (!activeChatId) {
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          title: firstQuery.substring(0, 40),
          full_data: history,
        })
        .select()
        .single()
      
        if(error) setSaveError(error)
      if (data) setActiveChatId(data.id)
    } else {
      const { data, error } = await supabase
        .from('chats')
        .update({ full_data: history })
        .eq('id', activeChatId)

        if(error) setSaveError(error)
    }

    
  }

  const moreQsAllowed = async () => {
    // Om de betalar, tillåt alltid
    if (isPaying) return true;

    // Om de inte är inloggade 
    if (!user) {
      if (messages.length >= 4) {
        setShowUpgradeModal(true);
        return false;
      }
      return true;
    }

    
    if (!activeChatId) {
      const today = new Date().toISOString().split('T')[0];
      
      const { count, error } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today);

      if (count !== null && count >= 3) {
        setShowUpgradeModal(true)
        return false;
      }
    }

    return true; 
  };

  const handleSend = async () => {
    if (!input.trim() || isWorking) return;

    const allowed = await moreQsAllowed();
    if (!allowed) return; // Stoppa om gränsen är nådd

    setIsWorking(true)
    setQuizDone(false)
    const currentInput = input
    setInput('') 
    setStatus('Tänker...')

    const newUserMsg: ChatMessage = { role: 'user', content: currentInput };
    const historyWithUser = [...messages, newUserMsg];
    setMessages(historyWithUser);

    try {
      // Byt ordning?
      const jobId = await triggerAiJob(currentInput, `laroplan_1-9_${subject}.txt`);
      
      const channel = supabase
        .channel(`job-${jobId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activity_jobs', filter: `job_id=eq.${jobId}` }, 
        (payload) => {
          if (payload.new.status === 'COMPLETED') {
            const data = payload.new.result_data;
            const newAiMsg: ChatMessage = { 
              role: 'assistant', 
              content: data.explanation,
              quiz: data.quiz,
              flashcards: data.flashcards
            };

            const finalHistory = [...historyWithUser, newAiMsg];
            setMessages(finalHistory);
            setStatus('');
            setIsWorking(false);
            
            if (user) {
              saveToSupabase(finalHistory, currentInput);
            }
            supabase.removeChannel(channel);
            channelRef.current = null
          }
        })
        .subscribe();

        channelRef.current = channel;

    } catch (err) {
      setStatus('Något gick fel.');
      setIsWorking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const startNewChat = () => {
      setMessages([]);
      setActiveChatId(null);
      setQuizDone(false);
      setStatus('');
      router.push('/chat'); // Rensar ID:t från URL:en
    };

  return (
    <div className="flex flex-col h-screen text-slate-800 bg-white">
      <header className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
        <h1 className="text-xl font-bold text-blue-600">Kriterium AI
          {isPaying && <span className="bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">Pro</span>}
        </h1>
        <select 
          value={subject} 
          onChange={(e) => setSubject(e.target.value)} 
          
          disabled={messages.length > 0} 
          
          className={`p-2 border rounded-lg text-sm transition-colors ${
            messages.length > 0 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-white text-slate-800'
          }`}
          suppressHydrationWarning
        >
          <option value="fysik">Fysik</option>
          <option value="biologi">Biologi</option>
        </select>
        <button 
          onClick={startNewChat}
          className="ml-2 text-xs text-blue-500 hover:underline"
        >
          Ny lektion
        </button>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-8">
        <div className="max-w-3xl mx-auto w-full">
          {messages.length === 0 && !status && (
            <div className="text-center mt-20 text-slate-300 text-3xl">Vad vill du lära dig?</div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col mb-4 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                {msg.content}
              </div>

              {msg.role === 'assistant' && msg.quiz && (
                <div className="w-full mt-4 space-y-4">
                  <QuizCard 
                    question={msg.quiz.questions[0]} 
                    onCorrect={() => setQuizDone(true)} 
                  />
                  {(quizDone || idx < messages.length - 1) && msg.flashcards && (
                    <div className="grid gap-2 md:grid-cols-2 mt-4">
                      {msg.flashcards.items.map((card: any, i: number) => (
                        <div key={i} className="bg-green-50 p-3 rounded-xl border border-green-100 text-sm">
                          <p className="font-bold text-green-700">{card.term}</p>
                          <p>{card.definition}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {status && <div className="text-slate-400 animate-pulse mt-4">{status}</div>}
        </div>
      </main>

      {saveError && <div className="text-fuchsia-800">Chatt har inte sparats</div>}
      <footer className="p-4 border-t">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input 
            suppressHydrationWarning 
            className="flex-1 bg-slate-100 p-3 rounded-xl outline-none" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Skriv din fråga här..."
          />
          <button onClick={handleSend} disabled={isWorking} className="bg-blue-600 text-white p-3 rounded-xl">
            Skaffa svar
          </button>
        </div>
      </footer>

      {showUpgradeModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="text-4xl">🚀</div>
          <h2 className="text-2xl font-bold">Dags för Pro?</h2>
          <p className="text-slate-600">
            Du har nått gränsen för gratislektioner. Skaffa Pro för att fortsätta lära dig utan gränser!
          </p>
          <button 
            onClick={() => router.push('/pricing')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Visa priser
          </button>
          <button 
            onClick={() => setShowUpgradeModal(false)}
            className="text-slate-400 text-sm hover:underline"
          >
            Kanske senare
          </button>
        </div>
      </div>
    )}
    </div>
  )
}

// Huvudkomponenten som Next.js faktiskt laddar
export default function ChatPage() {
  return (
    <Suspense fallback={<div>Laddar...</div>}>
      <ChatContent />
    </Suspense>
  )
}