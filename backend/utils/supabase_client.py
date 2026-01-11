import os
from dotenv import load_dotenv
from backend.utils.supabase_client import create_client, Client

# Ladda miljövariabler från .env-filen (om den finns)
# Detta är standard i Python-projekt
load_dotenv()

# Hämta variabler från miljön
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise EnvironmentError(
        "Fel: SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY måste vara satta i miljövariabler (eller .env-fil)."
    )

# Instansiera klienten en gång och exportera den
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)