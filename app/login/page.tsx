"use client";
import { useEffect, useState } from "react";
import { supabase } from '../../utils/supabaseClient'
import { useRouter } from "next/navigation";


export default function LoginPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Denna useEffect ser till att komponenten bara renderas fullt ut i webbläsaren
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null; // Förhindrar Hydration-fel

  async function handleLogin(e: any) {
    e.preventDefault();

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("AUTH ERROR:", error);
    console.log("AUTH DATA:", data);

    if (error) {
      
      setError(error.message);
    } else {
      console.log("Successful log in!")
      router.refresh();
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-10">
      <h1 className="text-3xl font-bold mb-6">Logga in</h1>

      <form className="flex flex-col gap-4 w-80" onSubmit={handleLogin}>
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

        <button className="bg-black text-white py-2 rounded">Logga in</button>

        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}
