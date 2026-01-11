'use server'

export async function triggerAiJob(query: string, subject: string) {
  try {
    const response = await fetch('http://127.0.0.1:8000/create-job', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        subject: subject,
        quiz_questions: 2,    
        flashcard_items: 2
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Kunde inte starta AI-jobbet');
    }

    const data = await response.json();
    return data.job_id;
  } catch (error) {
    console.error("Fel i triggerAiJob:", error);
    throw error; // Kasta vidare så UI:t kan visa felet
  }
}