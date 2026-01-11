'use client'; 

import Link from 'next/link';
import { useState } from 'react'; 
import { usePathname } from 'next/navigation'; 
import { Home, MessageSquare, User, DollarSign, Menu, X } from 'lucide-react'; 

export default function Navbar() {
  const pathname = usePathname(); 

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Pricing', href: '/pricing', icon: DollarSign },
  ];

  // --- 1. Desktop Nav (Sidenavigering - Visas på 'sm' och större) ---
  const DesktopNav = () => (
    // Klasser ändrade: 'hidden sm:block' behålls, men layouten blir fixed, full höjd, och col-flex
    <nav className="hidden sm:flex sm:flex-col fixed left-0 top-0 z-10 w-64 h-screen bg-white border-r-2 border-gray-200 p-4">
      
      {/* Logo/Huvudlänk - Alltid överst */}
      <div className="flex-shrink-0 flex items-center h-16 mb-4">
        <Link href="/" className="text-2xl font-bold text-gray-900">
          Kriterium AI
        </Link>
      </div>

      {/* Navigationslänkar - Trycks till vänster (col-layout) */}
      <div className="flex flex-col space-y-2 flex-grow">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              // Tillämpa dynamiska Tailwind-klasser för sidomenyn
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-lg transition duration-150
                ${isActive
                  ? 'bg-blue-100 text-blue-800' // Aktiv länk: Ljusblå bakgrund och text
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900' // Inaktiv länk
                }
              `}
            >
                <Icon size={20} className="mr-3"/>
                {item.name}
            </Link>
          );
        })}
      </div>

      {/* Höger sida - Autentisering/Användare (Trycks längst ner) */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <Link 
            href="/login" 
            className="flex justify-center items-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-green-400 hover:bg-green-500"
        >
          <User size={18} className="mr-2"/>
          Logga In
        </Link>
      </div>
    </nav>
  );

  // --- 2. Mobile Bottom Nav (Visas under 'sm') ---
  const MobileBottomNav = () => (
    // Fäster navigeringen längst ner på skärmen (fixed bottom-0)
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href; 
          return (
            <Link
              key={item.name}
              href={item.href}
              // Flex-col för att visa ikon ovanför text
              className={`
                flex flex-col items-center justify-center text-xs p-2 transition duration-150
                ${isActive 
                  ? 'text-blue-600' // Aktiv: Blå färg
                  : 'text-gray-600 hover:text-blue-600' // Inaktiv: Grå färg
                }
              `}
            >
              <Icon size={20} />
              <span className="mt-1">{item.name}</span>
            </Link>
          );
        })}
        
        {/* Logga In-knapp för mobilen - Kontrollerar också aktivitet (om /login är aktiv) */}
        <Link 
            href="/login" 
            className={`
              flex flex-col items-center justify-center text-xs rounded-md p-2 h-full transition duration-150
              ${pathname === '/login' 
                ? 'bg-blue-700 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
        >
          <User size={20} />
          <span className="mt-1">Logga In</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <DesktopNav />
      <MobileBottomNav />
    </>
  );
}