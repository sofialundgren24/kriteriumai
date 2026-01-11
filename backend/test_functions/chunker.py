import re
from pathlib import Path
from titlefiles.no_so import ALL_CONFIGS


DATA_DIR = Path(__file__).parent / "data" / "kommentarsmatrial"


# ---------------------------------------------------------
# LOAD TEXT & CONFIG
# ---------------------------------------------------------

def load_text(subject: str) -> str:
    path = DATA_DIR / f"{subject}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Could not find text file: {path}")
    return path.read_text(encoding="utf-8")


def get_config(subject: str):
    return next(cfg for cfg in ALL_CONFIGS if cfg["subject"] == subject)


# ---------------------------------------------------------
# BUILD REGEX FOR HEADINGS (exakt radmatchning)
# ---------------------------------------------------------

def build_heading_regex(config):
    headings = config["regex_headings"]
    combined = "|".join(headings)
    pattern = rf"^\s*({combined})\s*$"
    return re.compile(pattern, flags=re.MULTILINE)


# ---------------------------------------------------------
# SPLIT TEXT BY HEADINGS
# ---------------------------------------------------------

def chunk_by_headings(text: str, heading_re):
    matches = list(heading_re.finditer(text))
    if not matches:
        return [("FULL_DOCUMENT", text)]

    chunks = []
    for i, match in enumerate(matches):
        heading = match.group().strip()
        start = match.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        content = text[start:end].strip()
        chunks.append((heading, content))

    return chunks


# ---------------------------------------------------------
# SPLIT SUB-CHUNK BY YEAR LEVELS
# ---------------------------------------------------------

def split_by_year_levels(text: str, grade_levels):
    level_matches = []

    # hitta alla årskurs-rubriker
    for regex, label in grade_levels:
        for m in re.finditer(regex, text, flags=re.IGNORECASE):
            level_matches.append((m.start(), m.end(), label))

    level_matches.sort()

    # om inga årskurser matchas -> returnera None
    if not level_matches:
        return None

    # skapa underchunks
    sub_chunks = []
    for i, (start, end, label) in enumerate(level_matches):
        content_start = end
        content_end = level_matches[i+1][0] if i+1 < len(level_matches) else len(text)
        content = text[content_start:content_end].strip()
        sub_chunks.append((label, content))

    return sub_chunks


# ---------------------------------------------------------
# MAIN PIPELINE: RETURN AI-VÄNLIGA CHUNKS
# ---------------------------------------------------------

def make_chunks(subject: str):
    config = get_config(subject)
    text = load_text(subject)

    last_grade = None

    heading_regex = build_heading_regex(config)
    heading_chunks = chunk_by_headings(text, heading_regex)

    final_chunks = []

    for heading, content in heading_chunks:
        # testa om rubriken innehåller årskurser
        grade_chunks = split_by_year_levels(content, config["regex_grade_levels"])

        if grade_chunks:
            # skapa chunks per årskurs
            for grade, gc in grade_chunks:
                last_grade = grade
                final_chunks.append({
                    "subject": subject,
                    "heading": heading,
                    "grade": grade,
                    "content_type": config["content_type"],
                    "content": gc.strip(),
                })
        else:
            final_chunks.append({
                "subject": subject,
                "heading": heading,
                "grade": last_grade,   # <-- här är fixen!
                "content_type": config["content_type"],
                "content": content.strip(),
            })


    return final_chunks


# ---------------------------------------------------------
# RUN EXAMPLE
# ---------------------------------------------------------

if __name__ == "__main__":
    chunks = make_chunks("historia")

    for chunk in chunks[:10]:  # print only first 5
        print("=" * 80)
        print(chunk["heading"], "| Åk:", chunk["grade"])
        print(chunk["content"][:900], "…")
