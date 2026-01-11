import os
from pathlib import Path
import asyncio
from titlefiles.no_so import ALL_CONFIGS
import re

DATA_DIR = '../data/kommentarsmatrial'
CONFIG_FILE_PATH = Path(__file__).parent / 'titlefiles' / 'no_so.py'

DATA_DIR = Path(__file__).parent / "data" / "kommentarsmatrial"


def load_text(subject: str) -> str:
    """Load the .txt file based on subject name."""
    path = DATA_DIR / f"{subject}.txt"
    if not path.exists():
        raise FileNotFoundError(f"No text file found for {subject}: {path}")
    
    return path.read_text(encoding="utf-8")


def get_config(subject: str):
    """Select the config dictionary for this subject."""
    return next(cfg for cfg in ALL_CONFIGS if cfg["subject"] == subject)


def build_heading_regex(config):
    headings = config["regex_headings"]

    # Exakt matchning av hela raden
    combined = "|".join(headings)

    pattern = rf"^\s*({combined})\s*$"
    return re.compile(pattern, flags=re.MULTILINE)


def chunk_text_by_headings(text, heading_regex):
    chunks = []
    matches = list(heading_regex.finditer(text))

    if not matches:
        return [("FULL_DOCUMENT", text)]
    
    for match in heading_regex.finditer(text):
        print(match.group(), match.start(), match.end())

    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        heading = match.group().strip()
        content = text[start:end].strip()
        chunks.append((heading, content))

    return chunks

d

# ---------- MAIN EXAMPLE ----------
if __name__ == "__main__":
    subject = "historia"  # choose subject

    text = load_text(subject)
    config = get_config(subject)

    
    heading_re = build_heading_regex(config)
    #print("Heading", heading_re)
    chunks = chunk_text_by_headings(text, heading_re)

    # Print results
    #for heading, content in chunks:
        # print("=" * 80)
        # print("HEADING:", heading)
        # print("-" * 80)
        # print(content[:200] + "...")

def split_by_year_levels(text, grade_levels):
    level_matches = []
    for regex, label in grade_levels:
        match = re.search(regex, text, flags=re.IGNORECASE)
        if match:
            level_matches.append((match.start(), match.end(), label))
    level_matches.sort()

    sub_chunks = []
    for i, (start, end, label) in enumerate(level_matches):
        section_start = end
        section_end = level_matches[i + 1][0] if i + 1 < len(level_matches) else len(text)
        content = text[section_start:section_end].strip()
        sub_chunks.append((label, content))
    return sub_chunks

# ----------------- SPLIT LARGE CHUNKS -----------------
def split_into_small_chunks(text, max_chars=1200):
    words = text.split()
    chunks = []
    current = []
    for w in words:
        if sum(len(x) for x in current) + len(w) + len(current) > max_chars:
            chunks.append(" ".join(current))
            current = []
        current.append(w)
    if current:
        chunks.append(" ".join(current))
    return chunks

# ----------------- FULL CHUNKING -----------------
def chunk_document(subject: str):
    text = load_text(subject)
    config = get_config(subject)
    heading_re = build_heading_regex(config)

    final_chunks = []

    # Chunk på rubriker
    for heading, heading_text in chunk_text_by_headings(text, heading_re):
        # Chunk vidare på årskurser
        year_chunks = split_by_year_levels(heading_text, config["regex_grade_levels"])
        if not year_chunks:
            # Om inga årskurser hittas, spara hela rubriktexten som en chunk
            year_chunks = [("ALL", heading_text)]
        
        for grade, content in year_chunks:
            # Split stora sektioner i mindre bitar
            small_chunks = split_into_small_chunks(content)
            for chunk in small_chunks:
                final_chunks.append({
                    "heading": heading,
                    "grade_level": grade,
                    "subject": subject,
                    "content_type": config["content_type"],
                    "filename": config["filename"],
                    "content": chunk
                })
    return final_chunks

# ----------------- MAIN -----------------
if __name__ == "__main__":
    subject = "historia"
    chunks = chunk_document(subject)

    for i, c in enumerate(chunks):
        print("="*80)
        print(f"Chunk {i+1} | Heading: {c['heading']} | Grade: {c['grade_level']}")
        print("-"*80)
        print(c["content"][:300] + "...")