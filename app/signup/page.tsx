"use client";
import { useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useRouter } from "next/navigation";


export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  async function handleSignup(e: any) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Create user in supabase auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username, // stores it in user.user_metadata
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // 2. Insert into profiles table
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        username: username,
      });
    }

    setLoading(false);
    router.push("/login"); 
  }

  return (
    <div className="flex flex-col items-center justify-center p-10">
      <h1 className="text-3xl font-bold mb-6">Skapa konto</h1>

      <form className="flex flex-col gap-4 w-80" onSubmit={handleSignup}>
        <input
          className="border p-2"
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="border p-2"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border p-2"
          type="password"
          placeholder="Lösenord"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="bg-black text-white py-2 rounded"
          disabled={loading}
        >
          {loading ? "Skapar konto..." : "Skapa konto"}
        </button>

        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}
