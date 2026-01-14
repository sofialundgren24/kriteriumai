from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal, Union # Lade till Literal för Pydantic v2-kompatibilitet

# --- 1. Flashcard Sub-Models ---

class FlashcardItem(BaseModel):
    """Ett enskilt kort i flashcard-leken."""
    card_id: int
    term: str = Field(..., description="Det centrala begreppet eller ämnet.")
    definition: str = Field(..., description="En kort, pedagogisk förklaring eller definition.")
    image_generation_prompt: str = Field(..., description="En kort, engelsk prompt (max 12 ord) för AI-bildgenerering som visuellt representerar begreppet (t.ex. 'a schematic diagram of a photosynthesis process in a plant cell, science illustration').")
    source_reference: Optional[str] = Field(None, description="Kort referens till källan.")

class FlashcardActivity(BaseModel):
    """Samling av flashcards."""
    topic: str = Field(..., description="Ämne/rubrik för flashcard-leken.")
    items: List[FlashcardItem]

# --- 2. Quiz Sub-Models (Återanvändning av din tidigare design) ---

class Alternative(BaseModel):
    """En modell för ett enskilt svarsalternativ i quizet."""
    id: str = Field(..., description="Unik bokstav (a, b, c) för alternativet.")
    text: str = Field(..., description="Svarsalternativets text.")
    is_correct: bool = Field(False, description="Sätt till True om detta är det korrekta alternativet.")

class QuizQuestion(BaseModel):
    """Modell för en enskild flervalsfråga."""
    question_id: int
    
    type: Literal["multiple_choice"] = Field(..., description="Typ av fråga. Tvingas vara 'multiple_choice'.") 
    prompt: str = Field(..., description="Frågetexten baserad på läroplanstexten.")
    alternatives: List[Alternative]
    explanation_correct: str = Field(..., description="Pedagogisk förklaring när användaren svarar RÄTT.")
    explanation_incorrect: str = Field(..., description="Pedagogisk förklaring när användaren svarar FEL, inklusive en hint om källan.")
    source_reference: Optional[str] = Field(None, description="Kort referens till varifrån informationen kommer (t.ex. 'Lgr22 Biologi, Centralt Innehåll').")

class QuizActivity(BaseModel):
    """Samling av quizfrågor."""
    topic: str = Field(..., description="Ämne/rubrik för quizet (t.ex. 'Kunskapskrav i Biologi').")
    questions: List[QuizQuestion]

# --- 3. Svar givet till användaren 

class LearningActivityResponse(BaseModel):
    """Huvudmodell som håller alla genererade lärandeaktiviteter."""
    response_id: str = Field(..., description="Unik ID för hela svaret.")
    explanation: str = Field(..., description="En kort, pedagogisk sammanfattning av ämnet (3-5 meningar) som förbereder eleven för quizen.")
    quiz: Optional[QuizActivity] = Field(None, description="Quiz-aktiviteten (om begärd).")
    flashcards: Optional[FlashcardActivity] = Field(None, description="Flashcard-aktiviteten (om begärd).")
    
# --- Datamodeller för FastAPI-Input (NY) ---

class ActivityRequest(BaseModel):
    """Modell för inkommande förfrågan om lärandeaktiviteter."""
    query: str = Field(..., description="Användarens prompt (t.ex. 'Ge mig 3 flashcards och ett quiz om fotosyntes i biologi åk 7-9').")
    quiz_questions: int = Field(0, ge=0, le=5, description="Antal quizfrågor att generera.")
    flashcard_items: int = Field(0, ge=0, le=5, description="Antal flashcard-begrepp att generera.")
    
    subject: str = "laroplan_1-9_fysik.txt"
    # Validering: Minst en aktivitet måste begäras
    def check_min_activities(self):
        if self.quiz_questions + self.flashcard_items == 0:
            raise ValueError("Minst en quizfråga eller ett flashcard måste begäras.")

# Modeller för LLM-generering:
ACTIVITY_SCHEMA = LearningActivityResponse.model_json_schema()

# Används endast för /embed endpoint (som du hade i din kod)
class TextRequest(BaseModel):
    """Modell för inkommande text som ska inbäddas."""
    text: str

# --- NYA MODELLER FÖR JOBBHANTERING (FIXAT OCH TILLAGT) ---
class JobStatusResponse(BaseModel):
    job_id: str = Field(..., description="Unikt ID för jobbet.")
    status: str = Field(..., description="Status: PENDING, COMPLETED, FAILED.")
    result: Optional[Union[LearningActivityResponse, dict]] = Field(None, description="Genererade aktiviteter om status är COMPLETED.")
    error_message: Optional[str] = Field(None, description="Felmeddelande om status är FAILED.")
