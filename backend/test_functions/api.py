import os
import json
import httpx
import uuid
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import List

# old file!! 

from starlette.concurrency import run_in_threadpool

# VIKTIGT: Importera de strikta JSON-modellerna från learning_models.py
from backend.learning_models import (
    LearningActivityResponse, 
    ActivityRequest, 
    ACTIVITY_SCHEMA, 
    TextRequest
) 
# 1. Ladda miljövariabler från .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") 
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"
if not GEMINI_API_KEY:
    print("VARNING: GEMINI_API_KEY saknas i .env. LLM-generering kommer att misslyckas.")

def resolve_pydantic_schema(schema: dict) -> dict:
    schema_copy = json.loads(json.dumps(schema)) 
    
    if '$defs' not in schema_copy:
        definitions = {}
    else:
        definitions = schema_copy.pop('$defs') # Ta bort $defs efter att ha sparat den

    def replace_refs(obj):
        if isinstance(obj, dict):
            if 'const' in obj:
                const_value = obj.pop('const') # Ta bort 'const'
                obj['enum'] = [const_value]
            
            # För det andra: Hantera $ref-upplösning
            if '$ref' in obj and obj['$ref'].startswith('#/$defs/'):
                def_name = obj['$ref'].split('/')[-1]
                return replace_refs(definitions.get(def_name, obj).copy())

            # För det tredje: Rekursivt bearbeta ordlistan (dict)
            for key, value in obj.items():
                obj[key] = replace_refs(value)
                
            # För det fjärde: Specialfall för Optional-fält (Pydantic använder 'anyOf' med $ref)
            if 'anyOf' in obj and isinstance(obj['anyOf'], list):
                # Se till att vi löser referenser i anyOf-listan
                obj['anyOf'] = [replace_refs(item) for item in obj['anyOf']]

            return obj

        elif isinstance(obj, list):
            # För det femte: Rekursivt bearbeta listan
            return [replace_refs(item) for item in obj]
            
        return obj
    cleaned_properties = replace_refs(schema_copy['properties'])
    
    final_schema = {
        "type": "object",
        "title": schema_copy.get('title', 'GeneratedSchema'),
        "properties": cleaned_properties,
        "required": schema_copy.get('required', []) 
    }
    print("DEBUG: JSON Schema sanerat (tog bort $defs, löste $ref, konverterade 'const' till 'enum').")
    return final_schema

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
EMBEDDING_DIMENSION = 768 # Matchar multilingual-e5-base

print("--- Serveruppstart: Laddar den tunga AI-modellen i minnet ---")

try:
    model = SentenceTransformer("intfloat/multilingual-e5-base") 
    print("--- Sentence Transformer Modell laddad. ---")
except Exception as e:
    print(f"FEL: Kunde inte ladda SentenceTransformer-modellen: {e}")
    model = None

# Initiera Supabase-klienten
try:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL eller Service Key saknas i .env")
        
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("--- Supabase-klient initierad. ---")
except Exception as e:
    print(f"FEL: Kunde inte initiera Supabase: {e}")
    supabase = None
    
print("--- API:et är nu redo för snabba förfrågningar! ---")

# --- FASTAPI SETUP ---
app = FastAPI(
    title="Kriterium AI Aktivitetsgenerator",
    description="Lokal service för inbäddning, RAG och generering av olika lärandeaktiviteter.",
)

# EMBED 

@app.post("/embed")
def get_embedding_endpoint(request: TextRequest):
    """Endpoint som beräknar inbäddningen för inkommande text."""
    if model is None:
        raise HTTPException(status_code=503, detail="Embedding Model är inte laddad.")
        
    try:
        embedding = model.encode(
            [request.text], 
            normalize_embeddings=True, 
            convert_to_numpy=True
        )[0]
        
        return {"embedding": embedding.tolist()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fel vid inbäddning: {str(e)}")


# --- HJÄLPFUNKTIONER FÖR RAG ---

async def fetch_relevant_chunks(query: str, subject: str, match_count: int = 4) -> List[str]:
    # Hämtar relevanta chunks från Supabase m.h.a. vektor-sökning
    if model is None or supabase is None:
        raise HTTPException(status_code=503, detail="AI-tjänster (Embedding/DB) är inte klara.")

    # 1. Skapa inbäddning för användarens fråga
    try:
        # 1. Skapa inbäddning för användarens fråga (CPU-intensivt)
        query_embedding_list_of_one = await run_in_threadpool(
            model.encode, 
            [query], 
            normalize_embeddings=True, 
            convert_to_numpy=False # Låt det vara en lista av listor/Numpy-arrayer
        )
        query_embedding_list = query_embedding_list_of_one[0].tolist()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunde inte skapa inbäddning för frågan: {str(e)}")

    # 2. Supabase-sökning via RPC
    try:
            
        subject_filter = {"subject": subject}
        print(f"DEBUG: Använder RAG-filter: {subject_filter}")
            
            # Denna RPC-funktion 'match_chunks' MÅSTE finnas i din Supabase
        res = supabase.rpc(
            'match_chunks', 
            {
                'query_embedding': query_embedding_list,
                'match_count': match_count,
                'filter': subject_filter # Uppdaterat: Använder ämnesfiltret
            }
        ).execute()
        
        if not res.data:
            print("Varning: Ingen matchande data hittades i Supabase.")
            return []

        # Extrahera content från resultatet
        chunks_content = [item['content'] for item in res.data]
        return chunks_content
        
    except Exception as e:
        print(f"FEL vid Supabase RAG-sökning: {e}")
        # Detta fel indikerar troligen att RPC-funktionen 'match_chunks' saknas
        raise HTTPException(status_code=500, 
                            detail=f"Kunde inte söka i databasen. Kontrollera Supabase RPC-funktionens namn och definition: {str(e)}")


async def generate_activities_with_llm(chunks: List[str], request: ActivityRequest) -> dict:
    """Anropar Gemini LLM för att generera aktiviteter i strikt JSON-format."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API Key saknas. Kan inte generera aktiviteter.")

    # FIX: Rensa bort dubbletter (som de repeterade bedömningskriterierna)
    unique_chunks = list(dict.fromkeys(chunks))
    
    # 1. Skapa System Prompt (Instruktioner till AI:n)
    system_instruction = f"""
    Du är en pedagogisk AI-agent, specialiserad på den svenska läroplanen (Lgr22).
    Din uppgift är att agera som en gamifierad-inspirerad lärare och generera olika lärandeaktiviteter.
    
    VIKTIGA REGLER:
    1. Använd den HÄMTADE TEXTEN (RAG Chunks) som KONTEXT för att FÖRHÅLLA DIG TILL den svenska läroplanens MÅL och KUNSKAPSKRAV.
    2. Använd din EGEN GENERISKA KUNSKAP för att fylla i de FAKTISKA SVAREN (t.ex. konsthistoria, matematikregler, etc.).
    3. Anpassa TON och SVÅRIGHETSGRAD baserat på både användarens fråga (som ofta innehåller ålder/nivå) och den hämtade läroplanstexten.
    4. Du MÅSTE fylla i hela JSON-schemat. Om en aktivitet inte efterfrågas (t.ex. quiz_questions är 0), sätt den motsvarande sektionen (t.ex. 'quiz') till null.
    5. Fyll i 'quiz' med exakt {request.quiz_questions} frågor om detta begärs.
    6. Fyll i 'flashcards' med exakt {request.flashcard_items} kort om detta begärs.
    7. Alla förklaringar ska vara pedagogiska, uppmuntrande och tydliga.
    8. 'image_generation_prompt' MÅSTE vara en kort, engelsk fras (max 12 ord) som är redo att skickas till en bildgenerator.
    """
    
    # 2. Skapa User Prompt (Innehållet)
    chunks_text = "\n---\n".join(unique_chunks) # Använd de rensade chunkarna här
    
    # Förstärker prompten med exakta krav på antal
    user_query = f"""
    Generera följande aktiviteter baserat på den hämtade läroplanstexten:
    
    - Antal QUIZ-frågor: {request.quiz_questions}
    - Antal FLASHCARDS: {request.flashcard_items}
    
    HÄMTAD KÄLLTEXT:
    ---
    {chunks_text}
    ---
    
    Användarens önskemål/fokus: "{request.query}"
    
    Viktigt: Leverera svaret i det strikta JSON-formatet. Om en aktivitet inte efterfrågas, sätt dess sektion till null.
    """
    
    # 3. Skapa API-Payload (Inkluderar Pydantic ACTIVITY_SCHEMA för strikt JSON)
    
    # FIX: Sanera JSON Schema för Gemini API genom att platta ut $ref, ta bort $defs
    # OCH konvertera 'const' till 'enum'.
    try:
        cleaned_schema = resolve_pydantic_schema(ACTIVITY_SCHEMA)
    except Exception as e:
        print(f"FATALT FEL vid sanering av JSON-schema: {e}")
        # Detta är ett allvarligt fel i vår egen logik.
        raise HTTPException(status_code=500, detail=f"Internt fel: Kunde inte sanera JSON-schemat för LLM: {str(e)}")
        
    payload = {
        "contents": [{"parts": [{"text": user_query}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": cleaned_schema
        },
    }

    # print("PAYLOAD", payload)
    
    # 4. Anropa Gemini API (Med retry-logik)
    max_retries = 3

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(max_retries):
            try:
                print(f"Försök {attempt + 1}/{max_retries}: Anropar Gemini API...")
                response = client.post(
                    f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                    headers={'Content-Type': 'application/json'},
                    content=json.dumps(payload)
                )
                
                # Kollar om HTTP-status är dålig (4xx eller 5xx)
                if response.status_code != 200:
                    print(f"FEL: Gemini API returnerade HTTP-fel: {response.status_code}")
                    print(f"Svarstext från API: {response.text}") 
                    response.raise_for_status() # Kastar ett RequestException
                
                # Försök parsa och validera JSON
                result = response.json()
                
                if 'candidates' not in result or not result['candidates']:
                    print(f"FEL: Ogiltigt svar från Gemini (saknar 'candidates'). Hela svaret: {result}")
                    raise KeyError("Missing 'candidates' in Gemini response.")

                # Hämta den råa texten (som ska vara JSON)
                json_text = result['candidates'][0]['content']['parts'][0]['text']
                
                # DEBUG: Skriv ut den råa JSON-texten för att se vad LLM svarade
                print("--- LLM RÅ JSON-SVAR (Truncated till 500 tecken): ---")
                print(json_text[:500] + ('...' if len(json_text) > 500 else ''))
                print("-----------------------------------------------------")

                # Pydantic validerar att den returnerade JSON:en matchar modellen
                validated_activities = LearningActivityResponse.model_validate_json(json_text) 
                
                return validated_activities.model_dump() # Returnera som ren Python dict
                
            except httpx.HTTPError as e: 
                if attempt < max_retries - 1:
                    print(f"Nätverksfel vid API-anrop (retryar...): {e}")
                    await time.sleep(2 ** attempt) # Använd await för att sova asynkront
                    continue
                raise HTTPException(status_code=500, detail=f"LLM-API-fel efter {max_retries} försök: {str(e)}")
                
            except Exception as e:
                # Detta block fångar JSONDecodeError och Pydantic Validation Errors
                print(f"JSON/Valideringsfel i LLM-svar (retryar...): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                # Detta är den sista koden som kastas vid sista misslyckade försöket
                raise HTTPException(status_code=500, detail=f"LLM genererade ogiltig JSON efter {max_retries} försök. Fel: {str(e)}")

        # Should not be reached if max_retries > 0
        raise HTTPException(status_code=500, detail="Ett oväntat fel inträffade i LLM-genereringen.")


# --- SLUTPUNKT 2: GENERERA AKTIVITETER ---

@app.post("/generate_activities")
async def generate_activities_endpoint(request: ActivityRequest):
    """
    Huvudslutpunkt för att generera ett flertal lärandeaktiviteter (Quiz, Flashcards, etc.)
    baserat på läroplansdata via RAG.
    """
    
    # Validera att minst en aktivitet begärs
    try:
        request.check_min_activities()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    print(f"\n--- Tar emot aktivitetsförfrågan: {request.query} ---")
    print(f"Begärda aktiviteter: Quiz={request.quiz_questions}, Cards={request.flashcard_items}")
    
    # 1. Hämta relevanta chunks från Supabase (RAG Retrieval)
    retrieved_chunks = await fetch_relevant_chunks(request.query, request.subject)
    
    if not retrieved_chunks:
        raise HTTPException(status_code=404, detail="Hittade ingen relevant läroplanstext för frågan. Prova en annan formulering.")
        
    # Använd list(dict.fromkeys(retrieved_chunks)) för att räkna unika chunks för loggen
    unique_count = len(list(dict.fromkeys(retrieved_chunks)))
    print(f"Hämtade {len(retrieved_chunks)} chunks från Supabase. ({unique_count} unika)")
    print("Retrieved chunks (innan rensning):", retrieved_chunks)
    
    # 2. Skicka chunks + prompt till LLM för generering (RAG Generation)
    try:
        activities_data = await generate_activities_with_llm(retrieved_chunks, request)
        print("Aktiviteter genererade och JSON validerad.")
        return activities_data
        
    except HTTPException as e:
        # Vidarebefordra fel från genereringssteget
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ett allmänt fel inträffade under aktivitetsgenereringen: {str(e)}")

# Endpoint användare kommer i kontakt med  *NY*
@app.post("/create-job")
async def create_job_endpoint(request: ActivityRequest):
    # Validera att minst en aktivitet begärs
    try:
        request.check_min_activities()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    job_id = str(uuid.uuid4())
    request_data = request.model_dump_json() # Spara Request som JSON-sträng

    # 1. Skapa jobbet i databasen med status PENDING
    try:
        supabase.table('activity_jobs').insert([
            {
                'job_id': job_id,
                'status': 'PENDING',
                'request_data': request_data,
                'created_at': time.time()
            }
        ]).execute()
    except Exception as e:
        print(f"FEL: Kunde inte skapa jobbet i Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Kunde inte spara jobb i databasen: {str(e)}")

    # 2. Starta den tunga bearbetningen i bakgrunden.
    # Detta returnerar omedelbart men ser till att funktionen process_activity_job körs.
    background_tasks.add_task(process_activity_job, job_id, request)
    
    return {"status": "PENDING", "job_id": job_id}


# --- SLUTPUNKT 2: HÄMTA JOBBSTATUS (NY) ---

@app.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Hämtar statusen för ett asynkront jobb. Klienten ska "fråga" (poll) denna endpoint.
    """
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase-tjänsten är inte tillgänglig.")
        
    try:
        res = supabase.table('activity_jobs').select('*').eq('job_id', job_id).limit(1).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Jobb med ID {job_id} hittades inte.")
            
        job_record = res.data[0]
        
        # Förbered resultatet för pydantic-modellen
        return JobStatusResponse(
            job_id=job_record['job_id'],
            status=job_record['status'],
            # Vi måste parsa result_data från JSON-strängen om den finns
            result=job_record.get('result_data'), 
            error_message=job_record.get('error_message')
        )
        
    except HTTPException:
        # Vidarebefordra 404
        raise
    except Exception as e:
        print(f"FEL vid hämtning av jobbstatus: {e}")
        raise HTTPException(status_code=500, detail=f"Internt databasfel: {str(e)}")

