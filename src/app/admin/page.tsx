'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';

import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

import { firebaseAuth, firebaseStorage, firestoreDb } from '@/lib/firebase/client';
import { isAdminEmail } from '@/lib/firebase/admin';
import {
  normalizeText,
  slugify,
  splitKeywords,
  tokenize,
} from '@/lib/text/normalize';

type Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
  active: boolean;
};

type Product = {
  id: string; // slug
  slug: string;
  name: string;
  pluralName: string;
  nameNormalized: string;
  nameTokens: string[];
  keywords: string[];
  description: string;
  categoryId: string;
  priceCents: number;
  currency: string;
  imageUrls: string[];
  mainImageUrl?: string;
  videoUrl?: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

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

function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return '';
  try {
    return ts.toDate().toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

async function findAvailableDocId(
  collectionName: 'products' | 'categories',
  baseId: string
): Promise<string> {
  const sanitized = baseId || 'item';

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? sanitized : `${sanitized}-${i + 1}`;
    const ref = doc(firestoreDb, collectionName, candidate);
    const snap = await getDoc(ref);

    if (!snap.exists()) return candidate;
  }

  // Fallback should basically never happen for our scale.
  return `${sanitized}-${Date.now()}`;
}

function fileExtensionFromName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).trim().toLowerCase();
}

function toPaddedIndex(n: number): string {
  return String(n).padStart(2, '0');
}

function storageObjectRefFromUrl(url: string) {
  // Supports Firebase Storage download URLs and gs:// URLs.
  if (url.startsWith('gs://')) {
    // gs://bucket/path/to/object
    const withoutScheme = url.slice('gs://'.length);
    const firstSlash = withoutScheme.indexOf('/');
    const objectPath = firstSlash === -1 ? '' : withoutScheme.slice(firstSlash + 1);
    return storageRef(firebaseStorage, objectPath);
  }

  const parsed = new URL(url);
  // Typical download URL pathname:
  // /v0/b/<bucket>/o/<encodedFullPath>
  const match = parsed.pathname.match(/\/o\/(.+)$/);
  if (!match) {
    throw new Error('URL de Storage inválida.');
  }

  const objectPath = decodeURIComponent(match[1]);
  return storageRef(firebaseStorage, objectPath);
}

async function getNextImageIndex(slug: string): Promise<number> {
  const folder = storageRef(firebaseStorage, `products/${slug}`);
  try {
    const listed = await listAll(folder);
    let maxIndex = 0;

    for (const item of listed.items) {
      const name = item.name;
      const match = name.match(/-(\d+)\.[a-z0-9]+$/i);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxIndex) maxIndex = parsed;
    }

    return maxIndex + 1;
  } catch {
    return 1;
  }
}

async function uploadProductImages(slug: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];

  const startIndex = await getNextImageIndex(slug);
  const uploadedUrls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = fileExtensionFromName(file.name);
    const index = startIndex + i;
    const fileName = `${slug}-${toPaddedIndex(index)}${ext ? `.${ext}` : ''}`;
    const objectRef = storageRef(firebaseStorage, `products/${slug}/${fileName}`);
    await uploadBytes(objectRef, file);
    const url = await getDownloadURL(objectRef);
    uploadedUrls.push(url);
  }

  return uploadedUrls;
}

async function uploadProductVideo(slug: string, file: File): Promise<string> {
  const ext = fileExtensionFromName(file.name);
  const fileName = `${slug}-video${ext ? `.${ext}` : ''}`;
  const objectRef = storageRef(firebaseStorage, `products/${slug}/${fileName}`);
  await uploadBytes(objectRef, file);
  return getDownloadURL(objectRef);
}

export default function AdminPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [validationPopup, setValidationPopup] = useState<{
    title: string;
    missingFields: string[];
  } | null>(null);

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const [showCategoryCreate, setShowCategoryCreate] = useState(true);
  const [showCategoryList, setShowCategoryList] = useState(true);
  const [showProductCreate, setShowProductCreate] = useState(true);
  const [showProductList, setShowProductList] = useState(true);

  const isAdmin = useMemo(() => isAdminEmail(authUser?.email), [authUser?.email]);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  async function refreshData() {
    setError(null);
    setDataLoading(true);

    try {
      const categoriesQuery = query(
        collection(firestoreDb, 'categories'),
        orderBy('order', 'asc'),
        limit(200)
      );
      const categoriesSnap = await getDocs(categoriesQuery);
      const loadedCategories: Category[] = categoriesSnap.docs.map((d) => {
        const data = d.data() as Omit<Category, 'id'>;
        return {
          id: d.id,
          name: data.name ?? '',
          description: data.description ?? '',
          color: data.color ?? '',
          order: typeof data.order === 'number' ? data.order : 0,
          active: data.active ?? false,
        };
      });
      setCategories(loadedCategories);

      const productsQuery = query(
        collection(firestoreDb, 'products'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      const productsSnap = await getDocs(productsQuery);
      const loadedProducts: Product[] = productsSnap.docs.map((d) => {
        const data = d.data() as Omit<Product, 'id'>;
        return {
          id: d.id,
          slug: data.slug ?? d.id,
          name: data.name ?? '',
          pluralName: typeof data.pluralName === 'string' ? data.pluralName.trim() : '',
          nameNormalized: data.nameNormalized ?? '',
          nameTokens: Array.isArray(data.nameTokens) ? data.nameTokens : [],
          keywords: Array.isArray(data.keywords) ? data.keywords : [],
          description: data.description ?? '',
          categoryId: data.categoryId ?? '',
          priceCents: typeof data.priceCents === 'number' ? data.priceCents : 0,
          currency: data.currency ?? 'BRL',
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          mainImageUrl: data.mainImageUrl,
          active: data.active ?? false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      setProducts(loadedProducts);
    } catch (e) {
      console.error(e);
      setError('Erro ao carregar dados do Firestore.');
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void refreshData();
    }
  }, [authLoading, isAdmin]);

  async function handleLogin() {
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (e) {
      console.error(e);
      setError('Falha no login com Google.');
    }
  }

  async function handleLogout() {
    setError(null);

    try {
      await signOut(firebaseAuth);
    } catch (e) {
      console.error(e);
      setError('Falha ao sair.');
    }
  }

  // ---------------------
  // Categories CRUD
  // ---------------------
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('');
  const [newCategoryOrder, setNewCategoryOrder] = useState<number>();
  const [newCategoryActive, setNewCategoryActive] = useState(true);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryPatch, setEditingCategoryPatch] = useState<Partial<Category>>({});

  async function createCategory() {
    setError(null);
    setValidationPopup(null);

    const name = newCategoryName.trim();
    const missingFields: string[] = [];
    if (!name) missingFields.push('Nome');
    if (missingFields.length) {
      setValidationPopup({
        title: 'Não foi possível cadastrar a categoria.',
        missingFields,
      });
      return;
    }

    setIsCreatingCategory(true);

    const baseId = slugify(name);
    const id = await findAvailableDocId('categories', baseId);

    try {
      await setDoc(doc(firestoreDb, 'categories', id), {
        name,
        description: newCategoryDescription.trim(),
        color: newCategoryColor.trim(),
        order: Number.isFinite(newCategoryOrder) ? newCategoryOrder : 0,
        active: !!newCategoryActive,
      });

      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryColor('');
      setNewCategoryOrder((prev) => (prev ?? 0) + 1);
      setNewCategoryActive(true);

      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao criar categoria.');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  function beginEditCategory(cat: Category) {
    setEditingCategoryId(cat.id);
    setEditingCategoryPatch({
      name: cat.name,
      description: cat.description,
      color: cat.color,
      order: cat.order,
      active: cat.active,
    });
  }

  async function saveEditCategory() {
    if (!editingCategoryId) return;
    setError(null);

    try {
      await updateDoc(doc(firestoreDb, 'categories', editingCategoryId), {
        ...editingCategoryPatch,
      });

      setEditingCategoryId(null);
      setEditingCategoryPatch({});
      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao atualizar categoria.');
    }
  }

  async function deleteCategory(categoryId: string) {
    const confirmed = window.confirm('Remover esta categoria?');
    if (!confirmed) return;

    setError(null);

    try {
      await deleteDoc(doc(firestoreDb, 'categories', categoryId));
      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao remover categoria.');
    }
  }

  // ---------------------
  // Products CRUD
  // ---------------------
  const [newProductName, setNewProductName] = useState('');
  const [newProductPluralName, setNewProductPluralName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductCategoryId, setNewProductCategoryId] = useState('');
  const [newProductPriceCents, setNewProductPriceCents] = useState<number>(0);
  const [newProductCurrency, setNewProductCurrency] = useState('BRL');
  const [newProductActive, setNewProductActive] = useState(true);
  const [newProductKeywordsManual, setNewProductKeywordsManual] = useState('');
  const [newProductFiles, setNewProductFiles] = useState<File[]>([]);
  const [newProductFilesInputKey, setNewProductFilesInputKey] = useState(0);
  const [newProductVideoFile, setNewProductVideoFile] = useState<File | null>(null);
  const [newProductVideoInputKey, setNewProductVideoInputKey] = useState(0);

  const [editingProductNewFiles, setEditingProductNewFiles] = useState<File[]>([]);
  const [editingProductFilesInputKey, setEditingProductFilesInputKey] = useState(0);
  const [editingProductNewVideoFile, setEditingProductNewVideoFile] = useState<File | null>(null);
  const [editingProductVideoInputKey, setEditingProductVideoInputKey] = useState(0);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductPatch, setEditingProductPatch] = useState<Partial<Product>>({});

  const [productSearch, setProductSearch] = useState('');

  const filteredProducts = useMemo(() => {
    const queryNormalized = normalizeText(productSearch);
    if (!queryNormalized) return products;

    const queryTokens = Array.from(
      new Set([...tokenize(productSearch), ...splitKeywords(productSearch)])
    );

    const scored = products
      .map((p) => {
        const normalizedName = normalizeText(p.name);
        const nameIncludes = normalizedName.includes(queryNormalized) ? 3 : 0;

        const nameTokens = Array.isArray(p.nameTokens) ? p.nameTokens : [];
        const keywords = Array.isArray(p.keywords) ? p.keywords : [];

        const tokenNameHits = queryTokens.reduce(
          (acc, t) => acc + (nameTokens.includes(t) ? 1 : 0),
          0
        );
        const tokenKeywordHits = queryTokens.reduce(
          (acc, t) => acc + (keywords.some((k) => k.includes(t)) ? 1 : 0),
          0
        );

        const scoreName = nameIncludes + tokenNameHits * 2;
        const scoreKeywords = tokenKeywordHits;

        return {
          product: p,
          scoreName,
          scoreKeywords,
        };
      })
      .filter((x) => x.scoreName > 0 || x.scoreKeywords > 0);

    scored.sort((a, b) => {
      const aHasName = a.scoreName > 0;
      const bHasName = b.scoreName > 0;
      if (aHasName !== bHasName) return aHasName ? -1 : 1;

      if (a.scoreName !== b.scoreName) return b.scoreName - a.scoreName;
      if (a.scoreKeywords !== b.scoreKeywords) return b.scoreKeywords - a.scoreKeywords;

      return a.product.name.localeCompare(b.product.name, 'pt-BR');
    });

    return scored.map((x) => x.product);
  }, [productSearch, products]);

  async function createProduct() {
    setError(null);
    setValidationPopup(null);

    const name = newProductName.trim();
    const pluralName = newProductPluralName.trim();
    const description = newProductDescription.trim();
    const categoryId = newProductCategoryId.trim();

    const missingFields: string[] = [];
    if (!name) missingFields.push('Nome');
    if (!pluralName) missingFields.push('Nome (plural)');
    if (!categoryId) missingFields.push('Categoria');
    if (!newProductFiles.length) missingFields.push('Imagens (upload)');

    if (missingFields.length) {
      setValidationPopup({
        title: 'Não foi possível cadastrar o produto.',
        missingFields,
      });
      return;
    }

    setIsCreatingProduct(true);

    const baseSlug = slugify(name);
    const slug = await findAvailableDocId('products', baseSlug);

    const nameNormalized = normalizeText(name);
    const nameTokens = tokenize(name);

    const manualKeywords = splitKeywords(newProductKeywordsManual);
    const keywords = manualKeywords.filter((k) => !nameTokens.includes(k));

    let imageUrls: string[] = [];

    try {
      // Create doc first to avoid uploading if Firestore permissions are wrong.
      await setDoc(doc(firestoreDb, 'products', slug), {
        slug,
        name,
        pluralName,
        nameNormalized,
        nameTokens,
        keywords,
        description,
        categoryId,
        priceCents: Number.isFinite(newProductPriceCents) ? newProductPriceCents : 0,
        currency: newProductCurrency.trim() || 'BRL',
        imageUrls: [],
        mainImageUrl: '',
        videoUrl: '',
        active: !!newProductActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      imageUrls = await uploadProductImages(slug, newProductFiles);

      let videoUrl = '';
      if (newProductVideoFile) {
        videoUrl = await uploadProductVideo(slug, newProductVideoFile);
      }

      await updateDoc(doc(firestoreDb, 'products', slug), {
        imageUrls,
        mainImageUrl: imageUrls[0] ?? '',
        videoUrl,
        updatedAt: serverTimestamp(),
      });

      setNewProductName('');
      setNewProductPluralName('');
      setNewProductDescription('');
      setNewProductCategoryId('');
      setNewProductPriceCents(0);
      setNewProductCurrency('BRL');
      setNewProductActive(true);
      setNewProductKeywordsManual('');
      setNewProductFiles([]);
      setNewProductFilesInputKey((k) => k + 1);
      setNewProductVideoFile(null);
      setNewProductVideoInputKey((k) => k + 1);

      await refreshData();
    } catch (e) {
      console.error(e);
      // Best-effort cleanup if we created the doc but failed later.
      try {
        await deleteDoc(doc(firestoreDb, 'products', slug));
      } catch {
        // ignore
      }
      setError('Erro ao criar produto.');
    } finally {
      setIsCreatingProduct(false);
    }
  }

  function beginEditProduct(p: Product) {
    setEditingProductId(p.id);
    setEditingProductNewFiles([]);
    setEditingProductFilesInputKey((k) => k + 1);
    setEditingProductNewVideoFile(null);
    setEditingProductVideoInputKey((k) => k + 1);
    setEditingProductPatch({
      name: p.name,
      pluralName: p.pluralName,
      description: p.description,
      categoryId: p.categoryId,
      priceCents: p.priceCents,
      currency: p.currency,
      active: p.active,
      imageUrls: p.imageUrls,
      mainImageUrl: p.mainImageUrl,
      videoUrl: p.videoUrl,
      keywords: p.keywords,
    });
  }

  async function saveEditProduct() {
    if (!editingProductId) return;
    setError(null);

    const patch = { ...editingProductPatch };
    if (typeof patch.name === 'string') {
      patch.name = patch.name.trim();
      patch.nameNormalized = normalizeText(patch.name);
      patch.nameTokens = tokenize(patch.name);

      const manualKeywords = Array.isArray(patch.keywords)
        ? patch.keywords
        : splitKeywords(String(patch.keywords ?? ''));

      const nextNameTokens = Array.isArray(patch.nameTokens) ? patch.nameTokens : [];
      patch.keywords = manualKeywords.filter((k) => !nextNameTokens.includes(k));
    }

    const nextPluralName = typeof patch.pluralName === 'string' ? patch.pluralName.trim() : '';
    if (!nextPluralName) {
      setError('Informe o nome do produto no plural.');
      return;
    }
    patch.pluralName = nextPluralName;

    patch.updatedAt = serverTimestamp() as unknown as Timestamp;

    try {
      if (editingProductNewFiles.length) {
        const newUrls = await uploadProductImages(editingProductId, editingProductNewFiles);
        const existingUrls = Array.isArray(patch.imageUrls) ? patch.imageUrls : [];
        patch.imageUrls = Array.from(new Set([...existingUrls, ...newUrls]));

        if (!patch.mainImageUrl) {
          patch.mainImageUrl = patch.imageUrls[0] ?? '';
        }
      }

      if (editingProductNewVideoFile) {
        patch.videoUrl = await uploadProductVideo(editingProductId, editingProductNewVideoFile);
      }

      await updateDoc(doc(firestoreDb, 'products', editingProductId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });

      setEditingProductId(null);
      setEditingProductPatch({});
      setEditingProductNewFiles([]);
      setEditingProductFilesInputKey((k) => k + 1);
      setEditingProductNewVideoFile(null);
      setEditingProductVideoInputKey((k) => k + 1);
      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao atualizar produto.');
    }
  }

  async function removeProductImage(productId: string, imageUrl: string) {
    const confirmed = window.confirm('Remover esta imagem?');
    if (!confirmed) return;

    setError(null);

    const currentUrls = Array.isArray(editingProductPatch.imageUrls)
      ? editingProductPatch.imageUrls
      : [];
    const nextUrls = currentUrls.filter((u) => u !== imageUrl);

    const currentMain = typeof editingProductPatch.mainImageUrl === 'string'
      ? editingProductPatch.mainImageUrl
      : '';
    const nextMain = currentMain === imageUrl ? (nextUrls[0] ?? '') : currentMain;

    try {
      // 1) Update Firestore first so the UI/site stops referencing the image.
      await updateDoc(doc(firestoreDb, 'products', productId), {
        imageUrls: nextUrls,
        mainImageUrl: nextMain,
        updatedAt: serverTimestamp(),
      });

      setEditingProductPatch((prev) => ({
        ...prev,
        imageUrls: nextUrls,
        mainImageUrl: nextMain,
      }));

      // 2) Best-effort: delete the underlying object from Storage.
      try {
        await deleteObject(storageObjectRefFromUrl(imageUrl));
      } catch (storageErr) {
        console.warn('Falha ao remover imagem do Storage:', storageErr);
      }

      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao remover imagem.');
    }
  }

  async function removeProductVideo(productId: string) {
    const confirmed = window.confirm('Remover o vídeo deste produto?');
    if (!confirmed) return;

    setError(null);

    const currentVideoUrl = typeof editingProductPatch.videoUrl === 'string'
      ? editingProductPatch.videoUrl
      : '';

    if (!currentVideoUrl) return;

    try {
      await updateDoc(doc(firestoreDb, 'products', productId), {
        videoUrl: '',
        updatedAt: serverTimestamp(),
      });

      setEditingProductPatch((prev) => ({
        ...prev,
        videoUrl: '',
      }));

      try {
        await deleteObject(storageObjectRefFromUrl(currentVideoUrl));
      } catch (storageErr) {
        console.warn('Falha ao remover vídeo do Storage:', storageErr);
      }

      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao remover vídeo.');
    }
  }

  async function deleteProduct(productId: string) {
    const confirmed = window.confirm('Remover este produto?');
    if (!confirmed) return;

    setError(null);

    try {
      await deleteDoc(doc(firestoreDb, 'products', productId));
      await refreshData();
    } catch (e) {
      console.error(e);
      setError('Erro ao remover produto.');
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-4">Carregando…</p>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white btn-hover-expand"
          onClick={handleLogin}
        >
          Entrar com Google
        </button>

        {error && <p className="mt-4 text-red-600">{error}</p>}

        {LOGIN_ASCII_ART.trim().length > 0 && (
          <pre className="mt-6 overflow-x-auto whitespace-pre text-[10px] leading-tight text-gray-900">
            {LOGIN_ASCII_ART}
          </pre>
        )}
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="container mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-4">Acesso negado para {authUser.email}.</p>
        <button
          type="button"
          className="mt-6 inline-flex items-center rounded-md bg-black px-4 py-2 text-white"
          onClick={handleLogout}
        >
          Sair
        </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="container mx-auto px-4 py-10">
        {validationPopup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={validationPopup.title}
            onClick={() => setValidationPopup(null)}
          >
            <div
              className="w-full max-w-md rounded-lg border border-black/10 bg-white p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-lg font-bold">{validationPopup.title}</div>
              <div className="mt-2 text-sm opacity-80">Campos faltando:</div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {validationPopup.missingFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80"
                  onClick={() => setValidationPopup(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="mt-1 text-sm opacity-80">Logado como {authUser.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/emissao"
            className="inline-flex w-full items-center justify-center rounded-md border border-black px-4 py-2 hover:opacity-90 active:opacity-80 sm:w-auto"
          >
            Emissão
          </Link>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            onClick={() => void refreshData()}
            disabled={dataLoading}
            aria-busy={dataLoading}
          >
            {dataLoading && (
              <span
                className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
                aria-hidden="true"
              />
            )}
            {dataLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-black px-4 py-2"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </div>

        {error && <p className="mt-6 text-red-600">{error}</p>}

      {/* Categories */}
        <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Categorias</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
              onClick={() => setShowCategoryCreate((v) => !v)}
              aria-expanded={showCategoryCreate}
              aria-controls="category-create"
            >
              {showCategoryCreate ? 'Recolher cadastro' : 'Expandir cadastro'}
            </button>
            <button
              type="button"
              className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
              onClick={() => setShowCategoryList((v) => !v)}
              aria-expanded={showCategoryList}
              aria-controls="category-list"
            >
              {showCategoryList ? 'Recolher lista' : 'Expandir lista'}
            </button>
          </div>
        </div>

        {showCategoryCreate && (
        <div
          id="category-create"
          className="mt-4 grid gap-3 rounded-lg border border-black/10 bg-white p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Nome</span>
              <input
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Cor (hex)</span>
              <input
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                placeholder="#RRGGBB"
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-sm opacity-80">Descrição</span>
            <textarea
              className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
              rows={2}
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Ordem</span>
              <input
                type="number"
                className="w-28 rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newCategoryOrder}
                onChange={(e) => setNewCategoryOrder(Number(e.target.value))}
              />
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={newCategoryActive}
                onChange={(e) => setNewCategoryActive(e.target.checked)}
              />
              <span className="text-sm">Ativa</span>
            </label>
            <button
              type="button"
              className="ml-auto inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void createCategory()}
              disabled={isCreatingCategory}
              aria-busy={isCreatingCategory}
            >
              {isCreatingCategory && (
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isCreatingCategory ? 'Criando…' : 'Criar categoria'}
            </button>
          </div>
        </div>

        )}

        {showCategoryList && (
        <div id="category-list" className="mt-4 grid gap-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-lg border border-black/10 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold">
                    {cat.name}{' '}
                    <span className="text-sm opacity-60">({cat.id})</span>
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    Ordem: {cat.order} · {cat.active ? 'Ativa' : 'Inativa'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-black/20 px-3 py-2"
                    onClick={() => beginEditCategory(cat)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-black/20 px-3 py-2"
                    onClick={() => void deleteCategory(cat.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>

              {editingCategoryId === cat.id && (
                <div className="mt-4 grid gap-3 rounded-md border border-black/10 bg-gray-50 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Nome</span>
                      <input
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={editingCategoryPatch.name ?? ''}
                        onChange={(e) =>
                          setEditingCategoryPatch((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Cor</span>
                      <input
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={editingCategoryPatch.color ?? ''}
                        onChange={(e) =>
                          setEditingCategoryPatch((p) => ({
                            ...p,
                            color: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-sm opacity-80">Descrição</span>
                    <textarea
                      className="rounded-md border border-black/20 bg-white px-3 py-2"
                      rows={2}
                      value={editingCategoryPatch.description ?? ''}
                      onChange={(e) =>
                        setEditingCategoryPatch((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Ordem</span>
                      <input
                        type="number"
                        className="w-28 rounded-md border border-black/20 bg-white px-3 py-2"
                        value={Number(editingCategoryPatch.order ?? 0)}
                        onChange={(e) =>
                          setEditingCategoryPatch((p) => ({
                            ...p,
                            order: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!editingCategoryPatch.active}
                        onChange={(e) =>
                          setEditingCategoryPatch((p) => ({
                            ...p,
                            active: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm">Ativa</span>
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-black/20 px-3 py-2"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryPatch({});
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-black px-3 py-2 text-white"
                        onClick={() => void saveEditCategory()}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {categories.length === 0 && (
            <p className="mt-2 text-sm opacity-80">Nenhuma categoria cadastrada.</p>
          )}
        </div>
        )}
        </section>

      {/* Products */}
        <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Produtos</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-10 w-64 rounded-md border border-black/20 bg-white px-3 text-sm"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto (nome ou keywords)…"
              aria-label="Buscar produtos"
            />
            <button
              type="button"
              className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
              onClick={() => setShowProductCreate((v) => !v)}
              aria-expanded={showProductCreate}
              aria-controls="product-create"
            >
              {showProductCreate ? 'Recolher cadastro' : 'Expandir cadastro'}
            </button>
            <button
              type="button"
              className="rounded-md border border-black/20 bg-white px-3 py-2 text-sm"
              onClick={() => setShowProductList((v) => !v)}
              aria-expanded={showProductList}
              aria-controls="product-list"
            >
              {showProductList ? 'Recolher lista' : 'Expandir lista'}
            </button>
          </div>
        </div>

        {showProductCreate && (
        <div
          id="product-create"
          className="mt-4 grid gap-3 rounded-lg border border-black/10 bg-white p-4"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Nome</span>
              <input
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Nome (plural)</span>
              <input
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newProductPluralName}
                onChange={(e) => setNewProductPluralName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Categoria</span>
              <select
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newProductCategoryId}
                onChange={(e) => setNewProductCategoryId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {categories
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm opacity-80">Descrição</span>
            <textarea
              className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
              rows={3}
              value={newProductDescription}
              onChange={(e) => setNewProductDescription(e.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Preço (centavos)</span>
              <input
                type="number"
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newProductPriceCents}
                onChange={(e) => setNewProductPriceCents(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm opacity-80">Moeda</span>
              <input
                className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
                value={newProductCurrency}
                onChange={(e) => setNewProductCurrency(e.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={newProductActive}
                onChange={(e) => setNewProductActive(e.target.checked)}
              />
              <span className="text-sm">Ativo</span>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm opacity-80">
              Palavras-chave (separadas por vírgula)
            </span>
            <input
              className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
              value={newProductKeywordsManual}
              onChange={(e) => setNewProductKeywordsManual(e.target.value)}
              placeholder="ex.: geometria, poliedros, educacional"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm opacity-80">Imagens (upload)</span>
            <input
              key={newProductFilesInputKey}
              type="file"
              accept="image/*"
              multiple
              className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []).filter(Boolean);
                setNewProductFiles((prev) => [...prev, ...selected]);
              }}
            />
            {newProductFiles.length > 0 && (
              <div className="flex items-center gap-2 text-xs opacity-70">
                <span>{newProductFiles.length} arquivo(s) selecionado(s)</span>
                <button
                  type="button"
                  className="text-red-600 underline hover:text-red-800"
                  onClick={() => {
                    setNewProductFiles([]);
                    setNewProductFilesInputKey((k) => k + 1);
                  }}
                >
                  limpar
                </button>
              </div>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm opacity-80">Vídeo (opcional, máx. 1)</span>
            <input
              key={newProductVideoInputKey}
              type="file"
              accept="video/*"
              className="rounded-md border border-black/20 bg-gray-50 px-3 py-2"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setNewProductVideoFile(file);
              }}
            />
            {newProductVideoFile && (
              <div className="flex items-center gap-2 text-xs opacity-70">
                <span>Vídeo: {newProductVideoFile.name}</span>
                <button
                  type="button"
                  className="text-red-600 underline hover:text-red-800"
                  onClick={() => {
                    setNewProductVideoFile(null);
                    setNewProductVideoInputKey((k) => k + 1);
                  }}
                >
                  remover
                </button>
              </div>
            )}
          </label>

          <div className="flex items-center justify-end">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={() => void createProduct()}
              disabled={isCreatingProduct}
              aria-busy={isCreatingProduct}
            >
              {isCreatingProduct && (
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isCreatingProduct ? 'Criando…' : 'Criar produto'}
            </button>
          </div>
        </div>

        )}

        {showProductList && (
        <div id="product-list" className="mt-4 grid gap-3">
          {filteredProducts.map((p) => (
            <div key={p.id} className="rounded-lg border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold">
                    {p.name}{' '}
                    <span className="text-sm opacity-60">({p.id})</span>
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    {p.active ? 'Ativo' : 'Inativo'} · Categoria: {p.categoryId}
                  </div>
                  <div className="mt-1 text-xs opacity-70">
                    Criado: {formatTimestamp(p.createdAt)}{' '}
                    {p.updatedAt ? `· Atualizado: ${formatTimestamp(p.updatedAt)}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-black/20 px-3 py-2"
                    onClick={() => beginEditProduct(p)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-black/20 px-3 py-2"
                    onClick={() => void deleteProduct(p.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>

              {editingProductId === p.id && (
                <div className="mt-4 grid gap-3 rounded-md border border-black/10 bg-gray-50 p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Nome</span>
                      <input
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={String(editingProductPatch.name ?? '')}
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Nome (plural)</span>
                      <input
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={String(editingProductPatch.pluralName ?? '')}
                        required
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            pluralName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Categoria</span>
                      <select
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={String(editingProductPatch.categoryId ?? '')}
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            categoryId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Selecione…</option>
                        {categories
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-sm opacity-80">Descrição</span>
                    <textarea
                      className="rounded-md border border-black/20 bg-white px-3 py-2"
                      rows={3}
                      value={String(editingProductPatch.description ?? '')}
                      onChange={(e) =>
                        setEditingProductPatch((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Preço (centavos)</span>
                      <input
                        type="number"
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={Number(editingProductPatch.priceCents ?? 0)}
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            priceCents: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-sm opacity-80">Moeda</span>
                      <input
                        className="rounded-md border border-black/20 bg-white px-3 py-2"
                        value={String(editingProductPatch.currency ?? 'BRL')}
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            currency: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 self-end pb-2">
                      <input
                        type="checkbox"
                        checked={!!editingProductPatch.active}
                        onChange={(e) =>
                          setEditingProductPatch((prev) => ({
                            ...prev,
                            active: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm">Ativo</span>
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-sm opacity-80">
                      Palavras-chave (vírgula)
                    </span>
                    <input
                      className="rounded-md border border-black/20 bg-white px-3 py-2"
                      value={Array.isArray(editingProductPatch.keywords)
                        ? editingProductPatch.keywords.join(', ')
                        : String(editingProductPatch.keywords ?? '')}
                      onChange={(e) =>
                        setEditingProductPatch((prev) => ({
                          ...prev,
                          keywords: splitKeywords(e.target.value),
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-1">
                    <span className="text-sm opacity-80">Imagens</span>
                    <div className="text-xs opacity-70">
                      {Array.isArray(editingProductPatch.imageUrls)
                        ? `${editingProductPatch.imageUrls.length} imagem(ns) cadastrada(s)`
                        : '0 imagem(ns) cadastrada(s)'}
                    </div>
                  </div>

                  {Array.isArray(editingProductPatch.imageUrls) &&
                    editingProductPatch.imageUrls.length > 0 && (
                      <div className="grid gap-2">
                        {editingProductPatch.imageUrls.map((url) => (
                          <div
                            key={url}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-black/10 bg-white px-3 py-2"
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-[70ch] truncate text-xs underline opacity-80"
                              title={url}
                            >
                              {url}
                            </a>
                            <button
                              type="button"
                              className="rounded-md border border-black/20 px-3 py-1 text-sm"
                              onClick={() => void removeProductImage(editingProductId, url)}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {filteredProducts.length === 0 && (
                      <p className="mt-2 text-sm opacity-80">Nenhum produto encontrado.</p>
                    )}

                  <label className="grid gap-1">
                    <span className="text-sm opacity-80">Adicionar imagens (upload)</span>
                    <input
                      key={editingProductFilesInputKey}
                      type="file"
                      accept="image/*"
                      multiple
                      className="rounded-md border border-black/20 bg-white px-3 py-2"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files ?? []).filter(Boolean);
                        setEditingProductNewFiles((prev) => [...prev, ...selected]);
                      }}
                    />
                    {editingProductNewFiles.length > 0 && (
                      <div className="flex items-center gap-2 text-xs opacity-70">
                        <span>{editingProductNewFiles.length} arquivo(s) selecionado(s)</span>
                        <button
                          type="button"
                          className="text-red-600 underline hover:text-red-800"
                          onClick={() => {
                            setEditingProductNewFiles([]);
                            setEditingProductFilesInputKey((k) => k + 1);
                          }}
                        >
                          limpar
                        </button>
                      </div>
                    )}
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm opacity-80">Vídeo (opcional, máx. 1)</span>
                    {editingProductPatch.videoUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-700">Vídeo atual cadastrado</span>
                        <button
                          type="button"
                          className="text-red-600 underline hover:text-red-800"
                          onClick={() => void removeProductVideo(editingProductId!)}
                        >
                          remover vídeo
                        </button>
                      </div>
                    )}
                    <input
                      key={editingProductVideoInputKey}
                      type="file"
                      accept="video/*"
                      className="rounded-md border border-black/20 bg-white px-3 py-2"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setEditingProductNewVideoFile(file);
                      }}
                    />
                    {editingProductNewVideoFile && (
                      <div className="flex items-center gap-2 text-xs opacity-70">
                        <span>Novo vídeo: {editingProductNewVideoFile.name}</span>
                        <button
                          type="button"
                          className="text-red-600 underline hover:text-red-800"
                          onClick={() => {
                            setEditingProductNewVideoFile(null);
                            setEditingProductVideoInputKey((k) => k + 1);
                          }}
                        >
                          cancelar
                        </button>
                      </div>
                    )}
                  </label>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-black/20 px-3 py-2"
                      onClick={() => {
                        setEditingProductId(null);
                        setEditingProductPatch({});
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-black px-3 py-2 text-white"
                      onClick={() => void saveEditProduct()}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {products.length === 0 && (
            <p className="mt-2 text-sm opacity-80">Nenhum produto cadastrado.</p>
          )}
        </div>
        )}
        </section>
      </div>
    </main>
  );
}
