'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { isAdminEmail } from '@/lib/firebase/admin';
import { LogOut, LayoutDashboard, FolderOpen, Package, FileText, Users, BarChart2, Boxes } from 'lucide-react';

const LOGIN_ASCII_ART = String.raw`
                                                                                            +++::::--                                   __    _      __    _ ____          __                  __              _ __     
                                                                                        ++++++++::::::--                               / /_  (_)____/ /_  (_) / /_  ____  / /_____ _____  ____/ /___     _____(_) /____ 
                                                                          ++++++++::--::++++++::::::--....                            / __ \/ / ___/ __ \/ / / __ \/ __ \/ __/ __  / __ \/ __  / __ \   / ___/ / __/ _ \
                                                                          mmmmmmmmmmmmmm++++::::::------..--                         / /_/ / (__  ) /_/ / / / / / / /_/ / /_/ /_/ / / / / /_/ / /_/ /  (__  ) / /_/  __/ 
                                                                        mmMMMMMMMMMMMMMMmm--::::..--........                        /_.___/_/____/_.___/_/_/_/ /_/\____/\__/\__,_/_/ /_/\__,_/\____/  /____/_/\__/\___/ 
                                                                        --MMMM@@MM@@MMMMMMMM..----..........                           ____ _/ / /_  ___  (_)___     _________ _      __/ /_  ____  __  _/__ \    
                ....                                                      MM@@@@@@######MMMMMM  ..........                            / __  / / __ \/ _ \/ / __ \   / ___/ __ \ | /| / / __ \/ __ \/ / / // _/   
                MM@@..                                                      @@############@@MMMMMM  ......                           / /_/ / / / / /  __/ / /_/ /  / /__/ /_/ / |/ |/ / /_/ / /_/ / /_/ //_/   
              --######                                                          ########mmMM@@mmmm@@MMmm--                           \__,_/_/_/ /_/\___/_/\____/   \___/\____/|__/|__/_.___/\____/\__, /(_)  
        ..@@MMMM######mm                                                      ########++mmmm@@##MM    @@  ##@@                                                                                   /____/      
        ########mm######::              ..mm++..                              ######MM--++MM::@@mmmm....mmMM@@@@@@                          
      --########MM##@@@@@@MMMMmmmm++--mm######@@####mm                        ######--....--mm@@MMmm##    ..++++mmmm                        
      --######################@@MMMM@@@@@@@@##@@@@####MM                    ########....    ::mm@@mm####--....----::                        
        @@##################################@@@@##..MM++                  mm########..      mm::++mm##++    --..--                          
          @@##################################@@##mm@@##@@              ############::..      --..####                                      
          mm##################################@@##@@@@@@@@    ++@@..::..############@@..  --::..MM##                                        
          mm########################################mmmm##  ++@@MMMMMM@@######@@##::##--  ..::######                                        
          ####@@##################@@##############MMmmmm--..    @@MMmm@@##########++::##--  ########                                        
          ..++----..                  ..##################..    @@MMMMMM##########mm----##MM@@######                                        
                                        ############@@####      ##@@MMMM@@########MM::--....::##@@##                                        
                                        ######MM##@@mm####--    ##@@@@@@##########++##--........@@##                                        
                                        ::######MM++MM####mm    ..MM@@mm##########mm@@##--      ####                                        
                                        --@@########--++####..  ..  @@MM##@@######::mmMM..MMMM  ####                                        
                                        @@######::          ..  ..  @@mm##@@########mm..##MM--######                                        
                                      mm##MM####::                  @@mm##############++..++::  ####                                        
                                      ..@@@@####mm  ....        ..mm@@##############------..----####mm                                      
                                        mm##@@##MM##::--        @@############@@@@####..--------####@@                                      
                                        MM@@@@##@@@@mmmm        @@##############@@@@@@--....--  @@####                                      
                                          MMMMMMMMMM::::        ##########@@##@@####----......@@MM####                                      
                                          mmmm++mm++::++--      ######################::--....mmMMMM##                                      
                                          ++::::..            --####################mm##::--..mmmmmm####                                    
                                            ..++++::++....  --##########@@##@@######mm@@mmMMMMmmmmmm####                                    
                                                    mm####@@MM######################mm@@MM##MMMMMMmm####                                    
                                                      ::::  ######################@@mm@@MMMMMMMM@@mm####                                    
                                                            ####################  @@MMMMMMMM@@@@@@MM####..                                  
                                                            ######################@@MMMM@@MMMMMM@@MM####                                    
                                                            ########  ####@@######@@MMMM##MM@@MM##@@####                                    
                                                            ##############MM######MMMMmm##@@MMMM##@@####                                    
                                                            ##############MM########MMMM##@@@@MM@@@@####                                    
                                                          --##############MM########@@MM@@@@@@mm@@@@####                                    
                                                          ################MM####@@##@@MMmmMMMMMM@@@@####                                    
                                                          ####################..@@####MMmm--MMMMMM@@####                                    
                                                          MM####################@@##@@@@MMMMMM@@MMMM####                                    
                                                        ::++##########@@########@@##@@@@MMMMMM@@MMmm####--                                  
                                                          ..##++####mm##########@@######MMmmMMMMMMMM@@##--                                  
                                                                ####mm@@########MM######@@mmmm@@MMMMMM##..                                  
                                                                @@##@@@@@@######MM@@@@####mm++MM@@MM@@MMMM                                  
                                                                @@@@@@@@@@@@@@##MM@@@@@@##MMmm++MMMMMMmm                                    
                                                                MM@@MM@@@@@@@@@@MMMM@@MM@@@@mmmmMMMMmm##                                    
                                                                ##MMMM##@@@@MM@@MMMMMMMM@@@@MMmm@@MM####                                    
                                                                ########mm####@@@@@@##@@@@MM@@@@@@--##++                                    
                                                                ############@@############++++@@######++                                    
                                                                ##################--::mm..--++++####@@++                                    
                                                                ####################..mm@@..mm--####::##                                    
                                                                ####################..--..::::@@####++##                                    
                                                                mm##############################::++++##--                                  
                                                                mmmm##########################@@mmmmmm##::                                  
                                                                mmMMMMMM##############++mm  ++mmmmmmMM##                                    
                                                                mmMMMMMMMMMMMMMMmmmm++mm++++mm--mm@@MM::                                    
                                                                MMmmMMMMMMMMmmmmmmmm++mm++++mm####@@@@                                      
`;

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser?.email) {
      setIsAdmin(false);
      setAdminCheckDone(true);
      return;
    }
    isAdminEmail(authUser.email).then((result) => {
      setIsAdmin(result);
      setAdminCheckDone(true);
    });
  }, [authUser?.email, authLoading]);

  async function handleLogin() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`Falha no login: ${msg}`);
    }
  }

  async function handleLogout() {
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`Falha ao sair: ${msg}`);
    }
  }

  if (authLoading || !adminCheckDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin</h1>
          <p className="text-sm text-gray-500 mb-6">Faça login para continuar</p>
          <button
            type="button"
            className="w-full rounded-lg bg-black px-4 py-2.5 text-white hover:opacity-90 transition-opacity"
            onClick={handleLogin}
          >
            Entrar com Google
          </button>
        </div>
        <pre className="mt-8 overflow-x-auto whitespace-pre text-[6px] sm:text-[8px] md:text-[10px] leading-tight text-gray-900 max-w-full px-4">
          {LOGIN_ASCII_ART}
        </pre>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso negado</h1>
          <p className="text-sm text-gray-500 mb-6">{authUser.email} não tem permissão.</p>
          <button
            type="button"
            className="w-full rounded-lg border border-black/20 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/categorias', label: 'Categorias', icon: FolderOpen },
    { href: '/admin/produtos', label: 'Produtos', icon: Package },
    { href: '/admin/kits', label: 'Kits', icon: Boxes },
    { href: '/admin/emissao', label: 'Emissão', icon: FileText },
    { href: '/admin/contas', label: 'Contas', icon: Users },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between h-14">
            <nav className="flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const isActive =
                  href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden sm:inline">
                {authUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 transition-colors text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 md:px-8 py-8">{children}</div>
    </div>
  );
}
