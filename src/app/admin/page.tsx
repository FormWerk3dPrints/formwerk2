'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';
import { AdminShell } from './_components/AdminShell';
import { FolderOpen, Package } from 'lucide-react';

export default function AdminDashboardPage() {
  const [categoryCount, setCategoryCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [catSnap, prodSnap] = await Promise.all([
          getDocs(collection(firestoreDb, 'categories')),
          getDocs(collection(firestoreDb, 'products')),
        ]);
        setCategoryCount(catSnap.size);
        setProductCount(prodSnap.size);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

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
      </div>
    </AdminShell>
  );
}
