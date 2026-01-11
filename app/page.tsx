'use client';

import { useState } from "react";

export default function Home() {
    // Steg 2: Deklarera state-variabeln (count) och uppdateringsfunktionen (setCount)
    const [count, setCount] = useState(0); 

    const increment = () => {
        setCount(count + 1);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center font-sans dark:bg-black">
            
        </div>
    );
}
