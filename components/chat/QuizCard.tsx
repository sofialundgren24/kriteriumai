// src/components/chat/QuizCard.tsx
import { useState } from 'react'

export default function QuizCard({ question, onCorrect }: { question: any, onCorrect: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  const handleSelect = (alt: any) => {
    if (selectedId) return // Förhindra flera klick
    setSelectedId(alt.id)
    setShowFeedback(true)

    if (alt.is_correct) {
      // Om rätt: Vänta 3 sekunder så de hinner läsa förklaringen, sen gå vidare
      setTimeout(() => onCorrect(), 3000)
    }
  }

  const currentAlt = question.alternatives.find((a: any) => a.id === selectedId)

  return (
    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 w-full max-w-xl">
      <h3 className="text-lg font-bold text-slate-800 mb-4">{question.prompt}</h3>
      
      <div className="space-y-3">
        {question.alternatives.map((alt: any) => (
          <button
            key={alt.id}
            onClick={() => handleSelect(alt)}
            className={`w-full p-4 text-left rounded-2xl border-2 transition-all ${
              selectedId === alt.id 
                ? (alt.is_correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                : 'border-slate-100 hover:border-blue-200'
            }`}
          >
            {alt.text}
          </button>
        ))}
      </div>

      {/* PEDAGOGISK FEEDBACK */}
      {showFeedback && (
        <div className={`mt-6 p-4 rounded-2xl animate-in slide-in-from-top-2 ${
          currentAlt?.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <p className="font-bold mb-1">
            {currentAlt?.is_correct ? 'Snyggt!' : 'Inte riktigt...'}
          </p>
          <p className="text-sm">
            {currentAlt?.is_correct ? question.explanation_correct : question.explanation_incorrect}
          </p>
          {!currentAlt?.is_correct && (
            <button 
              onClick={() => {setSelectedId(null); setShowFeedback(false);}}
              className="mt-2 text-xs font-bold underline uppercase"
            >
              Försök igen
            </button>
          )}
        </div>
      )}
    </div>
  )
}