"use strict";
// kriteriumai/scripts/index_all_laroplan.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const supabase_js_1 = require("@supabase/supabase-js");
const openai_1 = require("openai");
// ...existing code...
require("dotenv/config"); // <-- lägger till så .env.local läses automatiskt
// ...existing code...
// --- Konfiguration ---
const DATA_DIR = './data';
// Hämta hemligheter från .env.local
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log(SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, OPENAI_API_KEY);
// Initiera klienter
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error("❌ Fel: Miljövariabler (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY) måste sättas i .env.local");
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new openai_1.OpenAI({ apiKey: OPENAI_API_KEY });
/**
 * Delar upp råtexten i logiska, mindre chunks baserat på Lgr22:s rubriker.
 */
function chunkLaroplanText(rawText, subject) {
    const chunks = [];
    // RegEx för att fånga alla logiska sektioner: Centralt Innehåll (I årskurs X-Y) och Betygskriterier
    const regex = /(I årskurs \d-\d|Betygskriterier för slutet av årskurs \d|Kriterier för bedömning.*årskurs 3|Ämnets syfte)[\s\S]*?(?=I årskurs \d-\d|Betygskriterier för slutet av årskurs \d|Kriterier för bedömning.*årskurs 3|Ämnets syfte|$)/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
        const header = match[1].trim();
        let content = match[0].replace(header, '').trim();
        if (content.length < 50)
            continue;
        // Rensa bort sidfötter/sidhuvuden som kan följa med (exempel: Sidan X av Y)
        content = content.replace(/Sida \d+ av \d+/g, '').trim();
        let grade_level = 'N/A';
        let content_type = 'N/A';
        if (header.includes('I årskurs')) {
            grade_level = header.match(/(\d-\d)/)?.[0] || '1-9';
            content_type = 'Centralt Innehåll';
        }
        else if (header.includes('Betygskriterier för slutet av årskurs')) {
            grade_level = header.match(/(\d)/)?.[0] || '6-9';
            content_type = 'Betygskriterier';
        }
        else if (header.includes('Kriterier för bedömning')) {
            grade_level = '3';
            content_type = 'Godtagbara Kunskaper';
        }
        else if (header.includes('Ämnets syfte')) {
            grade_level = '1-9';
            content_type = 'Syfte';
        }
        chunks.push({
            content: content,
            subject: subject,
            grade_level: grade_level,
            content_type: content_type
        });
    }
    return chunks;
}
/**
 * Skapar embedding för en text-chunk.
 */
async function createEmbedding(text) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
}
/**
 * Huvudfunktionen som hanterar hela indexeringen av alla filer.
 */
async function indexAllLaroplan() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
    let totalChunks = 0;
    for (const fileName of files) {
        console.log(`\n--- 📂 Bearbetar fil: ${fileName} ---`);
        // Extrahera ämnet från filnamnet (t.ex. kursplan_matematik_1-9.txt -> Matematik)
        const subjectMatch = fileName.match(/kursplan_([a-zåäö]+)_/i);
        const subject = subjectMatch ? subjectMatch[1].charAt(0).toUpperCase() + subjectMatch[1].slice(1) : 'Okänt Ämne';
        const rawText = fs.readFileSync(path.join(DATA_DIR, fileName), 'utf-8');
        // 1. Dela upp texten i chunks
        const chunks = chunkLaroplanText(rawText, subject);
        console.log(`🔎 Hittade ${chunks.length} logiska chunks i ${subject}.`);
        if (chunks.length === 0)
            continue;
        // 2. Processera varje chunk
        for (const chunk of chunks) {
            try {
                const embedding = await createEmbedding(chunk.content);
                // 3. Spara i Supabase
                const { error } = await supabase.from('chunks').insert({
                    content: chunk.content,
                    metadata: {
                        subject: chunk.subject,
                        grade_level: chunk.grade_level,
                        content_type: chunk.content_type,
                    },
                    embedding: embedding,
                });
                if (error)
                    throw error;
                totalChunks++;
                process.stdout.write(`✅ Total indexerad: ${totalChunks} (${chunk.subject}, ${chunk.content_type} Åk ${chunk.grade_level})\r`);
            }
            catch (error) {
                console.error(`\n❌ Fel vid bearbetning av en chunk i ${subject}:`, error);
                // Vi vill inte stoppa hela processen om en enda chunk misslyckas
            }
        }
    }
    console.log(`\n\n🎉 Indexeringen av alla ämnen är klar! Totalt ${totalChunks} chunks sparade i Supabase.`);
}
indexAllLaroplan();
