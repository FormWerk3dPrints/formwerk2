import { NextResponse } from 'next/server';
import productsData from '@/data/products.json';

export async function GET() {
  try {
    return NextResponse.json(productsData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao carregar produtos' },
      { status: 500 }
    );
  }
}
