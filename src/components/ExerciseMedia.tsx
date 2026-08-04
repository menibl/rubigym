import React, { useEffect, useMemo, useState } from 'react';
import { Image, Video } from 'lucide-react';
import { Exercise } from '../types';
import { getExerciseMedia } from '../data/exerciseMediaStorage';

interface ExerciseMediaProps {
  exercise: Exercise;
  className?: string;
  compact?: boolean;
  controls?: boolean;
}

const getYouTubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (!match) return '';
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}&controls=0&modestbranding=1`;
};

export const ExerciseMedia: React.FC<ExerciseMediaProps> = ({ exercise, className = '', compact = false, controls = false }) => {
  const [localSource, setLocalSource] = useState('');
  const [localMimeType, setLocalMimeType] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let active = true;
    const load = async () => {
      if (!exercise.mediaStorageId) {
        setLocalSource('');
        setLocalMimeType('');
        return;
      }
      const stored = await getExerciseMedia(exercise.mediaStorageId).catch(() => undefined);
      if (!stored || !active) return;
      objectUrl = URL.createObjectURL(stored.blob);
      setLocalSource(objectUrl);
      setLocalMimeType(stored.blob.type);
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [exercise.mediaStorageId]);

  const source = localSource || exercise.mediaUrl || '';
  const youtubeUrl = useMemo(() => source ? getYouTubeEmbedUrl(source) : '', [source]);
  const mediaType = exercise.mediaType
    || (localMimeType.includes('gif') || /\.gif(?:$|\?)/i.test(source) ? 'GIF'
      : localMimeType.startsWith('image/') || /\.(?:png|jpe?g|webp)(?:$|\?)/i.test(source) ? 'IMAGE'
        : 'VIDEO');

  if (!source) return null;

  const containerClass = `relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 ${compact ? 'aspect-video' : 'aspect-[4/3]'} ${className}`;
  if (youtubeUrl) {
    return <div className={containerClass}><iframe src={youtubeUrl} title={`הדגמת ${exercise.name}`} allow="autoplay; encrypted-media; picture-in-picture" className="h-full w-full" /></div>;
  }
  if (mediaType === 'VIDEO') {
    return <div className={containerClass}><video src={source} autoPlay loop muted playsInline controls={controls} className="h-full w-full object-contain" /><span className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><Video size={14} /></span></div>;
  }
  return <div className={containerClass}><img src={source} alt={`הדגמת ${exercise.name}`} className="h-full w-full object-contain" /><span className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><Image size={14} /></span></div>;
};
