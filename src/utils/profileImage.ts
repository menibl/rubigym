/** Resize locally before storing; never upload the original full-size photo. */
export async function prepareProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('יש לבחור קובץ תמונה בלבד.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('לא ניתן לעבד את התמונה. נסה תמונת JPG או PNG אחרת.'));
      nextImage.src = objectUrl;
    });
    const scale = Math.min(1, 512 / image.naturalWidth, 512 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('לא ניתן לעבד את התמונה.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
