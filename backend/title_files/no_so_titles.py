import re
# no_so.py
# Denna fil definierar konfigurationen för alla SO- och NO-ämnen.

# Gemensamma huvudrubriker som finns i ALLA kommentarmaterial (Syfte, Innehåll, Betyg).
GENERIC_HEADINGS = [
    r"^Kommentarer till kursplanens syfte",
    r"^Kommentarer till kursplanens centrala innehåll",
    r"^Kommentarer till kursplanens bedömnings- och betygskriterier",
]

# Gemensamma underrubriker för de naturorienterande ämnena i åk 1-3.
NO_COMMON_HEADINGS = [
    r"Året runt i naturen",
    r"Kropp och hälsa",
    r"Kraft och rörelse",
    r"Material och ämnen",
    r"Systematiska undersökningar",
]

# Gemensamma underrubriker för de samhällsorienterande ämnena i åk 1-3.
SO_COMMON_HEADINGS = [
    r"Att leva tillsammans",
    r"Att leva i närområdet",
    r"Att leva i världen",
    r"Att undersöka verkligheten",
]

# Standardiserad indelning av årskurser 1–3, 4–6 och 7–9, använd för alla ämnen.
# Använder den mest sannolika regexen för att matcha kapitelrubriker.
STANDARD_GRADE_LEVELS = [
    (r"årskurserna 1–3", "1–3"),
    (r"årskurserna 4–6", "4–6"),
    (r"årskurserna 7–9", "7–9"),
]

ALL_CONFIGS = [
    # ----------------------------------------------------
    # KONFIGURATION 1: HISTORIA (SO)
    # ----------------------------------------------------
    {
        "subject": "historia",
        "filename": "historia_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + SO_COMMON_HEADINGS + [
            # Åk 4-6
            r"Kulturmöten och statsbildning i Norden, cirka 800–1500",
            r"Maktförhållanden och levnadsvillkor i Norden, cirka 1500–1800",
            r"Folkökning, ändrade maktförhållanden och emigration, cirka 1800–1900",
            # Åk 7-9
            r"Samhällsomvandlingar: framväxten av civilisationer och industrisamhällen",
            r"Imperialism och världskrig, cirka 1850–1950",
            r"Demokratisering och ökad globalisering, cirka 1900 till nutid",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },
    
    # ----------------------------------------------------
    # KONFIGURATION 2: SAMHÄLLSKUNSKAP (SO)
    # ----------------------------------------------------
    {
        "subject": "samhallskunskap",
        "filename": "samhallskunskap_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + [
            r"^Om skolämnet samhällskunskap",
        ] + SO_COMMON_HEADINGS + [
            # Åk 4-9 Samhällskunskap specifika rubriker
            r"Individer och gemenskaper",
            r"Samhällsresurser och fördelning",
            r"Beslutsfattande och politiska idéer",
            r"Rättigheter och rättsskipning",
            r"Information och kommunikation",
            r"Granskning av samhällsfrågor",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },

    # ----------------------------------------------------
    # KONFIGURATION 3: GEOGRAFI (SO)
    # ----------------------------------------------------
    {
        "subject": "geografi",
        "filename": "geografi_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + SO_COMMON_HEADINGS + [
            r"Geografiska förhållanden, mönster och processer",
            r"Hållbar utveckling",
            r"Geografins metoder och verktyg",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },

    # ----------------------------------------------------
    # KONFIGURATION 4: RELIGIONSKUNSKAP (SO)
    # ----------------------------------------------------
    {
        "subject": "religionskunskap",
        "filename": "religionskunskap_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + SO_COMMON_HEADINGS + [
            r"Religioner och andra livsåskådningar",
            r"Religion och samhälle",
            r"Etik och livsfrågor",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },

    # ----------------------------------------------------
    # KONFIGURATION 5: FYSIK (NO)
    # ----------------------------------------------------
    {
        "subject": "fysik",
        "filename": "fysik_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + [
            r"^Om skolämnet fysik",
        ] + NO_COMMON_HEADINGS + [
            # Åk 4-9 Fysik specifika rubriker
            r"Fysiken i naturen och samhället",
            r"Systematiska undersökningar och granskning av information",
            # Betygskriterier
            r"Bedömnings- och betygskriterierna i ämnet fysik",
            r"Kriterierna för bedömning av godtagbara kunskaper i naturorienterande ämnen årskurs 3",
            r"Betygskriterierna i ämnet fysik årskurserna 6 och 9",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },

    # ----------------------------------------------------
    # KONFIGURATION 6: KEMI (NO)
    # ----------------------------------------------------
    {
        "subject": "kemi",
        "filename": "kemi_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + [
            r"^Om skolämnet kemi",
        ] + NO_COMMON_HEADINGS + [
            # Åk 4-9 Kemi specifika rubriker
            r"Kemin i naturen, i samhället och i människokroppen",
            r"Systematiska undersökningar och granskning av information",
            # Betygskriterier
            r"Bedömnings- och betygskriterierna i ämnet kemi",
            r"Kriterierna för bedömning av godtagbara kunskaper i naturorienterande ämnen årskurs 3",
            r"Betygskriterierna i ämnet kemi årskurserna 6 och 9",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },

    # ----------------------------------------------------
    # KONFIGURATION 7: BIOLOGI (NO)
    # ----------------------------------------------------
    {
        "subject": "biologi",
        "filename": "biologi_kommentar.pdf",
        "content_type": "kommentar",
        "regex_headings": GENERIC_HEADINGS + [
            r"^Om skolämnet biologi",
        ] + NO_COMMON_HEADINGS + [
            # Åk 4-9 Biologi specifika rubriker
            r"Natur och miljö",
            r"Kropp och hälsa", 
            r"Systematiska undersökningar och granskning av information",
            # Betygskriterier
            r"Bedömnings- och betygskriterierna i ämnet biologi",
            r"Kriterier för bedömning av godtagbara kunskaper i naturorienterande ämnen årskurs 3",
            r"Betygskriterierna i ämnet biologi årskurserna 6 och 9",
        ],
        "regex_grade_levels": STANDARD_GRADE_LEVELS
    },
]