'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { AdminShell } from './_components/AdminShell';
import { FolderOpen, Package, Users } from 'lucide-react';

export default function AdminDashboardPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [categoryCount, setCategoryCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) return;

    async function fetchCounts() {
      try {
        const idToken = await authUser!.getIdToken();
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          categories?: number;
          products?: number;
          userProfiles?: number;
        };
        setCategoryCount(json.categories ?? 0);
        setProductCount(json.products ?? 0);
        setUserCount(json.userProfiles ?? 0);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    void fetchCounts();
  }, [authUser]);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/categorias"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <FolderOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Categorias</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '…' : categoryCount}
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/produtos"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border"
        >
          <div className="flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Produtos</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '…' : productCount}
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/contas"
          className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border"
        >
          <div className="flex items-center gap-4">
            <div className="bg-purple-50 p-3 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Contas</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '…' : userCount}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </AdminShell>
  );
}
