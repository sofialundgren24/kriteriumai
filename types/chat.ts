export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string; // Själva textförklaringen
  quiz?: {
    questions: any[]; // Din befintliga quiz-struktur
  };
  flashcards?: {
    items: any[]; // Din befintliga flashcard-struktur
  };
  created_at?: string;
};

// Detta är vad som sparas i JSONB-kolumnen 'full_data'
export type ChatHistory = ChatMessage[];