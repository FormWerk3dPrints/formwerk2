/**
 * Corrige o priceCents de produtos específicos, gravando em centavos inteiros.
 *
 *   node scripts/fix-product-prices.mjs --dry-run   # só mostra o que faria
 *   node scripts/fix-product-prices.mjs             # aplica
 *
 * Motivo: alguns produtos foram salvos com o valor em reais arredondado
 * (ex.: 120 para R$ 119,90), o que a leitura interpreta como 120 centavos.
 * Aqui gravamos o valor correto já em centavos, no formato canônico.
 *
 * ATENÇÃO: escreve direto no Firestore de produção e não tem desfazer.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/** slug do produto -> preço correto em REAIS. */
const CORRECTIONS = {
  'torre-de-hanoi': 119.9,
  'quadro-de-numeros-manipulaveis-0-19': 124.9,
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.slice(2).includes('--dry-run');

function loadEnvFile(fileName) {
  let raw;
  try {
    raw = readFileSync(resolve(PROJECT_ROOT, fileName), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function initFirestore() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin não configurado (.env.local).');
  }
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return { db: getFirestore(), projectId };
}

const brl = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Mesma leitura usada pelo site: inteiro é centavo, decimal vira centavo. */
function readAsCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Number.isInteger(value) ? value : Math.round(value * 100);
}

async function main() {
  const { db, projectId } = initFirestore();
  console.log(`Projeto: ${projectId}`);
  console.log(dryRun ? 'Modo: DRY RUN (nada será gravado)\n' : 'Modo: GRAVANDO\n');

  const planned = [];
  for (const [slug, reais] of Object.entries(CORRECTIONS)) {
    const ref = db.collection('products').doc(slug);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  [ausente] ${slug} — documento não encontrado, pulando.`);
      continue;
    }
    const current = snap.get('priceCents');
    const target = Math.round(reais * 100);
    planned.push({ slug, ref, current, target, name: snap.get('name') ?? '' });
  }

  for (const p of planned) {
    console.log(
      `  ${p.slug}\n` +
        `      salvo: ${p.current} → lido como ${brl(readAsCents(p.current))}\n` +
        `      novo:  ${p.target} → ${brl(p.target)}   (${p.name})`
    );
  }

  if (planned.length === 0) {
    console.log('\nNada a fazer.');
    return;
  }
  if (dryRun) {
    console.log('\nDRY RUN — nada foi gravado.');
    return;
  }

  const batch = db.batch();
  for (const p of planned) {
    batch.update(p.ref, { priceCents: p.target, updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  console.log(`\nPronto: ${planned.length} produto(s) atualizado(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nFalhou:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
