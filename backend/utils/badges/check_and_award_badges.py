from backend.utils.supabase_client import supabase

def check_and_award_badges(user_id):
    # 1. Get user stats
    stats = supabase.table("user_stats").select("*").eq("user_id", user_id).single().execute().data

    # 2. Get all badges
    badges = supabase.table("badges").select("*").execute().data

    # 3. Get already earned badges
    earned = supabase.table("user_badges").select("badge_id").eq("user_id", user_id).execute().data
    earned_ids = {b["badge_id"] for b in earned}

    # 4. Check badge conditions
    for badge in badges:
        if badge["id"] in earned_ids:
            continue

        req_type = badge["requirement_type"]
        req_val = badge["requirement_value"]

        if stats.get(req_type, 0) >= req_val:
            supabase.table("user_badges").insert({
                "user_id": user_id,
                "badge_id": badge["id"]
            }).execute()
