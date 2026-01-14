import os
import json
import httpx
import uuid
import time

import asyncio

from fastapi import FastAPI, HTTPException, BackgroundTasks 
from pydantic import BaseModel, Field

from dotenv import load_dotenv
from supabase import create_client, Client

from datetime import datetime, timezone 
from typing import List, Optional, Union 

from starlette.concurrency import run_in_threadpool

# Importera JSON-modellerna 
from backend.learning_models import (
    LearningActivityResponse, 
    ActivityRequest, 
    ACTIVITY_SCHEMA, 
    TextRequest, 
    JobStatusResponse
) 


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") 
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
EMBEDDING_DIMENSION = 768

if not GEMINI_API_KEY:
    print("VARNING: GEMINI_API_KEY saknas i .env. LLM-generering kommer att misslyckas.")

def resolve_pydantic_schema(schema: dict) -> dict:
    """Löser upp Pydantic-schemat (tar bort $defs och löser $ref:s) för Gemini API."""
    schema_copy = json.loads(json.dumps(schema)) 
    
    if '$defs' not in schema_copy:
        definitions = {}
    else:
        definitions = schema_copy.pop('$defs') 

    def replace_refs(obj):
        if isinstance(obj, dict):
            if 'const' in obj:
                const_value = obj.pop('const') 
                obj['enum'] = [const_value]
            
            if '$ref' in obj and obj['$ref'].startswith('#/$defs/'):
                def_name = obj['$ref'].split('/')[-1]
                return replace_refs(definitions.get(def_name, obj).copy())

            for key, value in obj.items():
                obj[key] = replace_refs(value)
            
            if 'anyOf' in obj and isinstance(obj['anyOf'], list):
                obj['anyOf'] = [replace_refs(item) for item in obj['anyOf']]

            return obj

        elif isinstance(obj, list):
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

 

# Initiera Supabase-klienten
try:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL eller Service Key saknas i .env")
        
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("--- Supabase-klient initierad. ---")
except Exception as e:
    print(f"FEL: Kunde inte initiera Supabase: {e}")
    supabase = None
    
print("API:et är nu redo för snabba förfrågningar!")

# --- FASTAPI SETUP ---
app = FastAPI(
    title="Kriterium AI Aktivitetsgenerator",
    description="Lokal service för inbäddning, RAG och generering av olika lärandeaktiviteter med asynkron jobbskötsel.",
)

# Hjälpfunktioner

async def fetch_relevant_chunks(query: str, subject: str, match_count: int = 8) -> List[str]:
    """Hämtar relevanta chunks från Supabase m.h.a. vektor-sökning."""
    if not GEMINI_API_KEY:
        raise Exception("Gemeni nyckel saknas.")

    try:
        # 1. Skapa inbäddning för användarens fråga (CPU-intensivt, körs i trådpool)
        async with httpx.AsyncClient(timeout=10.0) as client: 
            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}"
            payload = {
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": query}]}
            }
            response = await client.post(url, json=payload)
            response.raise_for_status()
            query_embedding = response.json()['embedding']['values']

    except Exception as e:
        raise Exception(f"Kunde inte skapa inbäddning: {str(e)}")

    # 2. Supabase-sökning via RPC
    try:
        subject_filter = {"subject": subject}
        print(f"DEBUG: Använder RAG-filter: {subject_filter}")    
        def _supabase_rpc_call():
            """Kallar RPC synkront i trådpoolen."""
            subject_filter = {"subject": subject, 
                              "grade_level": "7-9"}
            
            print(f"DEBUG: Använder RAG-filter: {subject_filter}")
            
            res = supabase.rpc(
                'match_chunks', 
                {
                    'query_embedding': query_embedding,
                    'match_count': match_count,
                    'filter': subject_filter
                }
            ).execute()
            return res.data
        
        
        res_data: List[dict] =  await run_in_threadpool(_supabase_rpc_call)
        print("found chunks", res_data)
        
        if not res_data:
            print("Varning: Ingen matchande data hittades i Supabase.")
            return []

        chunks_content = [item['content'] for item in res_data]
        return chunks_content
        
    except Exception as e:
        print(f"FEL vid Supabase RAG-sökning: {e}")
        raise Exception(f"Kunde inte söka i databasen. Kontrollera Supabase RPC-funktionens namn och definition: {str(e)}")


async def generate_activities_with_llm(chunks: List[str], request: ActivityRequest) -> dict:
    """Anropar Gemini LLM för att generera aktiviteter i strikt JSON-format."""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API Key saknas. Kan inte generera aktiviteter.")

    unique_chunks = list(dict.fromkeys(chunks))
    
    system_instruction = f"""
    Du är en inspirerande och pedagogisk lärare som hjälper elever att bemästra skolämnen enligt den svenska läroplanen (Lgr22).

    DINA TVÅ KÄLLOR:
    1. LÄROPLANEN (RAG Chunks): Använd denna ENDAST för att kalibrera nivån (årskurs) och för att se vilka centrala begrepp som eleven förväntas lära sig.
    2. DIN EXPERTKUNSKAP: Använd din inbyggda kunskap för att förklara de faktiska ämnena (t.ex. fysik, biologi, historia).

    STRÄNGA INSTRUKTIONER:
    - FRÅGEFOKUS: Quizza ALDRIG på läroplanens formella text (t.ex. "vad står i betygskriterierna"). Quizza på ÄMNET (t.ex. "Vad är en foton?") utifrån den nivå läroplanen anger.
    - PEDAGOGIK: Förklara svåra koncept med liknelser som passar en elev i den aktuella årskursen.
    - JSON-FORMAT: Leverera ALLTID strikt JSON enligt schemat.
    - BILDER: 'image_generation_prompt' ska vara på engelska, beskrivande och visuellt inriktad.
    
    MÅL:
    - Skapa exakt {request.quiz_questions} quiz-frågor om ämnet.
    - Skapa exakt {request.flashcard_items} flashcards om ämnet.
    """
    
    chunks_text = "\n---\n".join(unique_chunks) 
    
    user_query = f"""
    Generera följande aktiviteter med svårighet baserat på den hämtade läroplanstexten:
    
    - Antal QUIZ-frågor: {request.quiz_questions}
    - Antal FLASHCARDS: {request.flashcard_items}
    
    HÄMTAD KÄLLTEXT:
    ---
    {chunks_text}
    ---
    
    Användarens önskemål/fokus: "{request.query}"
    
    Viktigt: Leverera svaret i det strikta JSON-formatet. Om en aktivitet inte efterfrågas, sätt dess sektion till null.
    """
    
    try:
        cleaned_schema = resolve_pydantic_schema(ACTIVITY_SCHEMA)
    except Exception as e:
        print(f"FATALT FEL vid sanering av JSON-schema: {e}")
        raise Exception(f"Internt fel: Kunde inte sanera JSON-schemat för LLM: {str(e)}")
        
    payload = {
        "contents": [{"parts": [{"text": user_query}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": cleaned_schema
        },
    }

    max_retries = 3

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(max_retries):
            try:
                print(f"Försök {attempt + 1}/{max_retries}: Anropar Gemini API...")
                
                response = await client.post( 
                    f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                    headers={'Content-Type': 'application/json'},
                    content=json.dumps(payload)
                )
                
                if response.status_code != 200:
                    response.raise_for_status() 
                
                result = response.json()
                
                if 'candidates' not in result or not result['candidates']:
                    raise KeyError("Missing 'candidates' in Gemini response.")

                json_text = result['candidates'][0]['content']['parts'][0]['text']
                
                validated_activities = LearningActivityResponse.model_validate_json(json_text) 
                
                return validated_activities.model_dump() 
                
            except httpx.HTTPError as e: 
                if attempt < max_retries - 1:
                    await time.sleep(2 ** attempt) 
                    continue
                raise Exception(f"LLM-API-fel efter {max_retries} försök: {str(e)}")
                
            except Exception as e:
                if attempt < max_retries - 1:
                    await time.sleep(2 ** attempt) 
                    continue
                raise Exception(f"LLM genererade ogiltig JSON efter {max_retries} försök. Fel: {str(e)}")

        raise Exception("Ett oväntat fel inträffade i LLM-genereringen.")

# --- NY PROCESS SOM KÖRS I BAKGRUNDEN (TILLAGT) ---


async def process_activity_job(job_id: str, request: ActivityRequest):
    """
    Den tunga processen: Hämtar chunks och anropar LLM.
    Uppdaterar Supabase-status när den är klar eller misslyckas.
    """
    # FIX: Se till att time.time() kallas för att få en färsk timestamp
    # FIX: Använd time.sleep utan await för synkron blockering (om LLM-fel inträffar i retry-loopen)
    
    print(f"\n--- JOBB {job_id} STARTAR: {request.query} ---")
    
    # 1. Initiera som misslyckad, ifall något går fel
    error_detail = None
    activities_data = None
    
    try:
        # 1. Hämta relevanta chunks (RAG Retrieval)
        retrieved_chunks = await fetch_relevant_chunks(request.query, request.subject)
        
        if not retrieved_chunks:
            raise Exception("Hittade ingen relevant läroplanstext för frågan.")
            
        unique_count = len(list(dict.fromkeys(retrieved_chunks)))
        print(f"JOBB {job_id}: Hämtade {len(retrieved_chunks)} chunks ({unique_count} unika)")
        
        # 2. Skicka chunks + prompt till LLM för generering (RAG Generation)
        activities_data = await generate_activities_with_llm(retrieved_chunks, request)
        print(f"JOBB {job_id}: Generering klar och JSON validerad.")

        # 3. Uppdatera Supabase: COMPLETED
        
        def _update_completed():
             supabase.table('activity_jobs').update({
                'status': 'COMPLETED',
                'result_data': activities_data,
                'completed_at': datetime.now(timezone.utc).isoformat() 
            }).eq('job_id', job_id).execute()

        await run_in_threadpool(_update_completed)
        
    except Exception as e:
        error_detail = str(e)
        print(f"JOBB {job_id} MISSLYCKADES: {error_detail}")
        
        # 4. Uppdatera Supabase: FAILED
         # 4. Uppdatera Supabase: FAILED 
        def _update_failed():
            supabase.table('activity_jobs').update({
                'status': 'FAILED',
                'error_message': error_detail,
                'completed_at': datetime.now(timezone.utc).isoformat() 
            }).eq('job_id', job_id).execute()
            
        await run_in_threadpool(_update_failed)
        
    finally:
        print(f"--- JOBB {job_id} AVSLUTAT (Status: {'COMPLETED' if activities_data else 'FAILED'}) ---")


# --- SLUTPUNKT 1: SKAPA JOBB (NY) ---

@app.post("/create-job", status_code=202) # HTTP 202 Accepted
# FIX: Måste inkludera background_tasks som parameter
async def create_job_endpoint(request: ActivityRequest, background_tasks: BackgroundTasks):
    """
    Skapar ett asynkront jobb för att generera aktiviteter och returnerar ett jobb-ID direkt.
    """
    
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
                'created_at': datetime.now(timezone.utc).isoformat()
            }
        ]).execute()
    except Exception as e:
        print(f"FEL: Kunde inte skapa jobbet i Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Kunde inte spara jobb i databasen: {str(e)}")

    # 2. Starta den tunga bearbetningen i bakgrunden.
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


# --- SLUTPUNKT 3: EMBED (Behålls som synkron för snabb åtkomst) --- tagits bort

