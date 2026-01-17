'use client'; 

import Link from 'next/link';
import { useEffect, useState } from 'react'; 
import { usePathname, useRouter } from 'next/navigation'; 
import { Home, MessageSquare, User, DollarSign, History } from 'lucide-react'; 
import { supabase } from '../utils/supabaseClient';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isPaying, setIsPaying] = useState<boolean | null>(null); // Initialt null
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      setIsPaying(false);
      setChatHistory([]);
      return;
    }

    const fetchData = async () => {
      // Hämta Pro-status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_paying')
        .eq('id', user.id) 
        .single();
      
      if (profile) setIsPaying(profile.is_paying);

      // Hämta Historik
      const { data: chats } = await supabase
        .from('chats')
        .select('id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (chats) setChatHistory(chats);
    };

    fetchData();
  }, [user]);

  // Hantera Autentisering
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Profil', href: '/profile', icon: User },
    
    isPaying 
      ? { name: 'Mitt Pro', href: '/profile/billing', icon: DollarSign }
      : { name: 'Bli Pro', href: '/pricing', icon: DollarSign },
  ];

  const DesktopNav = () => (
    <nav className="hidden sm:flex sm:flex-col fixed left-0 top-0 z-10 w-64 h-screen bg-white border-r-2 border-gray-200 p-4">
      <div className="flex-shrink-0 flex items-center h-16 mb-4">
        <Link href="/" className="text-2xl font-bold text-gray-900">Kriterium AI</Link>
      </div>

      <div className="flex flex-col space-y-2 flex-grow overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition duration-150 ${
                  isActive ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} className="mr-3"/>
                {item.name}
              </Link>

              {/* RENDER HISTORIK UNDER CHAT-LÄNKEN */}
              {item.name === 'Chat' && user && chatHistory.length > 0 && (
                <div className="ml-9 mt-1 space-y-1 border-l-2 border-slate-100 pl-2">
                  {chatHistory.map((chat) => (
                    <Link
                      key={chat.id}
                      href={`/chat?id=${chat.id}`}
                      className="block text-[11px] py-1 text-slate-500 hover:text-blue-600 truncate transition-colors"
                    >
                      {chat.title || 'Namnlös lektion'}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-gray-200">
        {user ? (
          <button onClick={handleLogout} className="w-full px-4 py-2 text-sm font-medium rounded-xl text-white bg-red-400 hover:bg-red-500 transition shadow-sm">
            Logga Ut
          </button>
        ) : (
          <Link href="/login" className="flex justify-center items-center w-full px-4 py-2 text-sm font-medium rounded-xl text-white bg-green-500 hover:bg-green-600 transition shadow-sm">
            <User size={18} className="mr-2"/> Logga In
          </Link>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <DesktopNav />
      {/* MobileBottomNav kan implementeras liknande om du vill visa historik där med */}
    </>
  );
}

