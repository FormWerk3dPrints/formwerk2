/**
 * Crops an image to a centered 1:1 square, then resizes it to targetSize×targetSize.
 * Returns a Blob (JPEG, quality 0.92).
 */
export function processAvatarImage(
  file: File,
  targetSize = 80
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;          // landscape: centraliza horizontalmente
      const sy = h > w ? 0 : (h - side) / 2; // portrait: topo; landscape: centraliza verticalmente

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context não disponível.'));
        return;
      }

      ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao converter canvas para Blob.'));
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Falha ao carregar a imagem.'));
    };

    img.src = objectUrl;
  });
}
