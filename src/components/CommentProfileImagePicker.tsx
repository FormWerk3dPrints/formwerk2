import { useEffect, useRef, useState } from 'react';
import { getDownloadURL, listAll, ref as storageRef, uploadBytes } from 'firebase/storage';
import { firebaseStorage } from '../lib/firebase/client';

interface CommentProfileImagePickerProps {
  value?: string;
  onChange: (url: string) => void;
}

export function CommentProfileImagePicker({ value, onChange }: CommentProfileImagePickerProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchImages() {
    setLoading(true);
    try {
      const folderRef = storageRef(firebaseStorage, 'comments');
      const res = await listAll(folderRef);
      const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
      setImages(urls);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchImages();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileRef = storageRef(firebaseStorage, `comments/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setImages(imgs => [url, ...imgs]);
      onChange(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="border rounded px-2 py-1 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Enviando…' : 'Upload imagem'}
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleUpload}
        />
        {value && (
          <img src={value} alt="Selecionada" className="w-8 h-8 rounded-full border object-cover" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <button
            type="button"
            key={url}
            className={`border rounded p-0.5 ${value === url ? 'border-black' : 'border-gray-200'}`}
            onClick={() => onChange(url)}
            style={{ background: value === url ? '#eee' : 'transparent' }}
          >
            <img src={url} alt="Escolher" className="w-8 h-8 rounded-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
