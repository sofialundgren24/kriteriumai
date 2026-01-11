import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// --- KONSTANTER OCH SETUP ---
const DATA_DIR = path.resolve(process.cwd(), 'data'); // data-mappen i projektrot

const EMBEDDING_DIMENSION = 768; // FIXAT: Den korrekta dimensionen för denna modell.

// NYTT: Din lokala FastAPI-URL för snabb inbäddning.
const LOCAL_API_URL = 'http://127.0.0.1:8000/embed'; 


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;


console.log('Loaded env (Supabase keys):', !!SUPABASE_SERVICE_ROLE_KEY, !!SUPABASE_URL);
console.log('Embedding source: Local FastAPI Server at', LOCAL_API_URL);


if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Fel: Miljövariabler (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) måste sättas i .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


interface LaroplanChunk {
    content: string;
    subject: string;
    grade_level: string;
    content_type: string;
    heading?: string;
}

/**
 * Hjälp: normalisera texten så vi inte missar "I årskurs 1–3" (en dash) vs "I årskurs 1-3"
 */
function normalizeText(s: string): string {
    return s.replace(/\r/g, '').replace(/\u2013/g, '-').replace(/\u2014/g, '-'); // en-dash/em-dash => hyphen
}

/**
 * Heuristisk, robust parser som går rad-för-rad och samlar avsnitt.
 * (Denna funktion är oförändrad från din ursprungliga kod)
 */
function chunkLaroplanText(rawText: string, subject: string): LaroplanChunk[] {
    const text = normalizeText(rawText);
    const lines = text.split('\n');

    const headingPatterns: { key: string; re: RegExp }[] = [
        { key: 'syfte', re: /^\s*Syfte\s*$/i },
        { key: 'centralt_innehall', re: /^\s*Centralt innehåll\s*$/i },
        { key: 'i_arskurs', re: /^\s*I årskurs\s*(\d+(?:-\d+)?)\s*$/i }, // captures 1-3, 4-6, 7-9
        { key: 'betygskriterier', re: /^\s*Betygskriterier/i },
        { key: 'kriterier_for_bedomning', re: /^\s*Kriterier för bedömning/i },
        // eventuella andra rubriker: "Bildframställning", "Tekniker, verktyg och material" etc.
    ];

    const chunks: LaroplanChunk[] = [];
    let currentHeading = 'Introduktion';
    let currentGrade = '1-9';
    let currentContentLines: string[] = [];

    const pushChunkIfAny = () => {
        const content = currentContentLines.join('\n').trim();
        if (content.length >= 40) {
            const content_type = detectContentTypeFromHeading(currentHeading);
            chunks.push({
                content,
                subject,
                grade_level: currentGrade,
                content_type,
                heading: currentHeading,
            });
        }
        currentContentLines = [];
    };

    function detectContentTypeFromHeading(h: string) {
        const hh = h.toLowerCase();
        if (hh.includes('syfte')) return 'Syfte';
        if (hh.includes('centralt innehåll')) return 'Centralt innehåll';
        if (hh.includes('årskurs')) return 'Centralt innehåll'; // oftast centralt innehåll för en årskurs
        if (hh.includes('betyg')) return 'Betygskriterier';
        if (hh.includes('kriterier')) return 'Kriterier för bedömning';
        return 'Övrigt';
    }

    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i].trim();

        // Skip obvious page footer/header lines
        if (/^Sida \d+ av \d+/i.test(ln) || /^SKOLFS \d+:\d+/i.test(ln)) {
            continue;
        }
        // If the line matches a main heading, treat as boundary
        let matchedHeading = false;
        for (const p of headingPatterns) {
            const m = p.re.exec(ln);
            if (m) {
                // found new section => push previous
                pushChunkIfAny();

                // set new heading and maybe grade
                if (p.key === 'i_arskurs') {
                    currentHeading = `I årskurs ${m[1]}`;
                    currentGrade = m[1];
                } else {
                    currentHeading = ln;
                    // if it's "Betygskriterier ... årskurs X" try to parse year
                    const gradeMatch = ln.match(/\bårskurs\s*(\d+)/i);
                    if (gradeMatch) currentGrade = gradeMatch[1];
                }
                matchedHeading = true;
                break;
            }
        }
        if (matchedHeading) continue;

        // Some files put a short subheading like "Bildframställning" after "I årskurs 1-3".
        // If the line is short and CamelCase-like, treat it as part of the heading
        if (ln.length < 40 && /[A-ZÅÄÖ][a-zåäö]+\s?[A-ZÅÄÖ]?[a-zåäö]*/.test(ln) && ln.split(' ').length <= 4) {
            // append to current heading (gör "I årskurs 1-3" + "Bildframställning")
            currentHeading = `${currentHeading} — ${ln}`;
            continue;
        }

        // otherwise accumulate as content
        currentContentLines.push(ln);
    }

    // push last chunk
    pushChunkIfAny();
    return chunks;
}


/**
 * NY FUNKTION: Anropar din lokala FastAPI /embed endpoint för att få inbäddningen.
 */
async function createEmbeddingFromLocalAPI(text: string): Promise<number[]> {
    
    // 1. Skapa en "cleaned" text som matchar din FastAPI-input-struktur (TextRequest)
    // Trimma längden som en säkerhetsåtgärd.
    const cleanedText = text.replace(/\s+/g, ' ').trim().slice(0, 512 * 4); 
    const requestBody = { text: cleanedText };
    
    // 2. Skicka POST-förfrågan till din FastAPI-server
    const response = await fetch(LOCAL_API_URL, {
        headers: { "Content-Type": "application/json" },
        method: 'POST',
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        // Om servern svarar med fel, kasta det som ett fel
        const errorBody = await response.text();
        throw new Error(`Local API error: ${response.status} ${response.statusText} - Details: ${errorBody}`);
    }

    const jsonResponse = await response.json();
    
    // 3. Validera och returnera inbäddningen
    if (jsonResponse && Array.isArray(jsonResponse.embedding)) {
        // Validera dimensionen, men tillåt ändå att koden fortsätter om det är fel.
        if (jsonResponse.embedding.length !== EMBEDDING_DIMENSION) {
             console.warn(`WARNING: Local API embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${jsonResponse.embedding.length}. Check FastAPI setup.`);
        }
        return jsonResponse.embedding;
    }
    
    throw new Error('Unexpected response format from local FastAPI /embed endpoint');
}


/**
 * Simple wrapper för Embedding generation (nu utan retry, då local server är stabil)
 */
async function createEmbeddingWithRetry(text: string): Promise<number[]> {
    // Vi behåller namnet för att minimera ändringar i indexAllLaroplan-loopen
    return createEmbeddingFromLocalAPI(text);
}


/**
 * Spara en chunk i Supabase: tabellen 'chunks' förväntas ha kolumner:
 * - content (text)
 * - metadata (jsonb)
 * - embedding (vector/float8[])
 */
async function saveChunkToSupabase(chunk: LaroplanChunk, embedding: number[]) {
    // Kontrollera att embedding-dimensionen matchar vad pgvector förväntar sig (768 för denna modell)
    if (embedding.length !== EMBEDDING_DIMENSION) {
        console.warn(`WARNING: Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${embedding.length}. Check your Supabase vector column definition.`);
    }

    const { error } = await supabase.from('chunks').insert({
        content: chunk.content,
        metadata: {
            subject: chunk.subject,
            grade_level: chunk.grade_level,
            content_type: chunk.content_type,
            heading: chunk.heading || null,
        },
        embedding: embedding,
    });
    return error;
}

async function indexAllLaroplan() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error('Data folder not found:', DATA_DIR);
        return;
    }
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.txt'));
    let total = 0;

    for (const file of files) {
        console.log('---  Bearbetar fil:', file);
        const subjectMatch = file.match(/kursplan_([a-zåäö]+)_/i);
        const subject = subjectMatch ? subjectMatch[1][0].toUpperCase() + subjectMatch[1].slice(1) : file;
        const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const chunks = chunkLaroplanText(raw, subject);
        console.log(` Hittade ${chunks.length} chunks i ${subject}`);

        for (const c of chunks) {
            try {
                // ANVÄNDER NU DIN LOKALA FASTAPI-TJÄNST
                const emb = await createEmbeddingWithRetry(c.content);
                const error = await saveChunkToSupabase(c, emb);
                if (error) {
                    console.error('Supabase insert error:', error);
                } else {
                    total++;
                    // Använd process.stdout.write för att skriva över raden (snyggare output)
                    process.stdout.write(`✅ Sparade: ${total} chunks av ${chunks.length} totalt i filen.    \r`);
                }
            } catch (e) {
                console.error(`\n❌ Fel vid chunk (Subject: ${c.subject}, Heading: ${c.heading}):`, e);
            }
        }
        console.log(''); // Ny rad efter varje fil
    }

    console.log(`\n🎉 Klart. Totalt sparade chunks: ${total}`);
}

indexAllLaroplan().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});