import React, { useEffect, useState } from 'react';
import { ImagePlus, LoaderCircle, RotateCcw } from 'lucide-react';
import defaultHero from '../assets/baly-club-hero.png';
import defaultCoaching from '../assets/baly-personal-coaching.png';
import {
  getPublicLandingConfig,
  LandingImageSlot,
  PublicLandingConfig,
  resetLandingImage,
  uploadLandingImage
} from '../data/publicLanding';

const maxUploadBytes = 780_000;

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const source = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(source);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(source);
    reject(new Error('לא ניתן לקרוא את התמונה שנבחרה.'));
  };
  image.src = source;
});

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('לא ניתן לכווץ את התמונה.')), 'image/jpeg', quality);
});

const prepareLandingImage = async (file: File, slot: LandingImageSlot) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('יש לבחור תמונת JPG, PNG או WebP.');
  }
  const image = await loadImage(file);
  const maxWidth = slot === 'hero' ? 1920 : 1500;
  const maxHeight = slot === 'hero' ? 1200 : 1500;
  let scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);

  for (const quality of [0.84, 0.72, 0.6, 0.5]) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('הדפדפן לא הצליח לעבד את התמונה.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= maxUploadBytes) return blob;
    scale *= 0.82;
  }
  throw new Error('התמונה גדולה מדי גם לאחר כיווץ. נסו תמונה קטנה יותר.');
};

type ImageCardProps = {
  slot: LandingImageSlot;
  title: string;
  description: string;
  imageUrl: string;
  hasCustomImage: boolean;
  busy: boolean;
  onUpload: (slot: LandingImageSlot, file: File) => void;
  onReset: (slot: LandingImageSlot) => void;
};

const ImageCard: React.FC<ImageCardProps> = ({ slot, title, description, imageUrl, hasCustomImage, busy, onUpload, onReset }) => (
  <article className="landing-image-admin-card">
    <img src={imageUrl} alt={`תצוגה מקדימה — ${title}`} />
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
      <div className="landing-image-admin-actions">
        <label className={busy ? 'disabled' : ''}>
          {busy ? <LoaderCircle className="animate-spin" size={15} /> : <ImagePlus size={15} />}
          {hasCustomImage ? 'החלפת תמונה' : 'העלאת תמונה'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) onUpload(slot, file);
              event.target.value = '';
            }}
          />
        </label>
        {hasCustomImage && <button type="button" disabled={busy} onClick={() => onReset(slot)}><RotateCcw size={14} /> חזרה לברירת המחדל</button>}
      </div>
    </div>
  </article>
);

export const LandingImageManager: React.FC = () => {
  const [config, setConfig] = useState<PublicLandingConfig | null>(null);
  const [busySlot, setBusySlot] = useState<LandingImageSlot | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => setConfig(await getPublicLandingConfig());

  useEffect(() => { void refresh().catch(() => undefined); }, []);

  const handleUpload = async (slot: LandingImageSlot, file: File) => {
    setBusySlot(slot);
    setMessage('');
    setError('');
    try {
      const prepared = await prepareLandingImage(file, slot);
      await uploadLandingImage(slot, prepared);
      await refresh();
      setMessage('התמונה הוחלפה ונשמרה. היא תופיע בדף הנחיתה ברענון הבא.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'לא ניתן להעלות את התמונה.');
    } finally {
      setBusySlot(null);
    }
  };

  const handleReset = async (slot: LandingImageSlot) => {
    setBusySlot(slot);
    setMessage('');
    setError('');
    try {
      await resetLandingImage(slot);
      await refresh();
      setMessage('תמונת ברירת המחדל הוחזרה בהצלחה.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'לא ניתן לאפס את התמונה.');
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <section className="landing-image-admin">
      <div className="landing-image-admin-heading">
        <div><h4>תמונות דף הנחיתה</h4><p>התמונות נשמרות בשרת ומוצגות רק באתר השיווקי. מומלץ לבחור תמונות אופקיות, חדות וללא טקסט.</p></div>
        <span>מנהל בלבד</span>
      </div>
      <div className="landing-image-admin-grid">
        <ImageCard
          slot="hero"
          title="תמונת פתיחה ראשית"
          description="התמונה הרחבה בחלק העליון של דף הנחיתה."
          imageUrl={config?.images.hero || defaultHero}
          hasCustomImage={Boolean(config?.images.hero)}
          busy={busySlot === 'hero'}
          onUpload={handleUpload}
          onReset={handleReset}
        />
        <ImageCard
          slot="coaching"
          title="תמונת הליווי האישי"
          description="התמונה שמופיעה באזור הסיפור והגישה של רובי."
          imageUrl={config?.images.coaching || defaultCoaching}
          hasCustomImage={Boolean(config?.images.coaching)}
          busy={busySlot === 'coaching'}
          onUpload={handleUpload}
          onReset={handleReset}
        />
      </div>
      {message && <div className="landing-image-admin-message success">{message}</div>}
      {error && <div className="landing-image-admin-message error">{error}</div>}
    </section>
  );
};
