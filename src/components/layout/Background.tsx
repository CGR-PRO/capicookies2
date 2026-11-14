import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../store/DataProvider';
import type { MediaFraming } from '../../lib/types';

/** Cria e revoga URLs de objeto para mídias guardadas no IndexedDB. */
export function useMediaUrls(ids: string[]): Record<string, string> {
  const { getMediaBlob } = useData();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = ids.join('|');

  useEffect(() => {
    let alive = true;
    const created: string[] = [];
    (async () => {
      const out: Record<string, string> = {};
      for (const id of ids) {
        const blob = await getMediaBlob(id);
        if (blob) {
          const u = URL.createObjectURL(blob);
          created.push(u);
          out[id] = u;
        }
      }
      if (alive) setUrls(out);
      else created.forEach((u) => URL.revokeObjectURL(u));
    })();
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getMediaBlob]);

  return urls;
}

export function framingStyle(f: MediaFraming): React.CSSProperties {
  return {
    objectFit: f.fit,
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Fundo do aplicativo: gradiente padrão, foto estática, carrossel ou vídeo. */
export function Background() {
  const { settings } = useData();
  const bg = settings.background;
  const ids = useMemo(() => {
    if (bg.mode === 'image' && bg.imageId) return [bg.imageId];
    if (bg.mode === 'carousel') return bg.carouselIds;
    if (bg.mode === 'video' && bg.videoId) return [bg.videoId];
    return [];
  }, [bg.mode, bg.imageId, bg.carouselIds, bg.videoId]);
  const urls = useMediaUrls(ids);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [bg.carouselIds.join('|')]);

  useEffect(() => {
    if (bg.mode !== 'carousel' || bg.carouselIds.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % bg.carouselIds.length), Math.max(3, bg.carouselIntervalSec) * 1000);
    return () => clearInterval(t);
  }, [bg.mode, bg.carouselIds.length, bg.carouselIntervalSec]);

  const hasMedia = ids.some((id) => urls[id]);

  return (
    <div className="app-bg" aria-hidden>
      <div className="app-bg__default">
        <span className="blob blob--1" />
        <span className="blob blob--2" />
        <span className="blob blob--3" />
      </div>
      {bg.mode === 'image' && bg.imageId && urls[bg.imageId] && (
        <img className="app-bg__media is-visible" src={urls[bg.imageId]} alt="" style={framingStyle(bg.imageFraming)} />
      )}
      {bg.mode === 'carousel' &&
        bg.carouselIds.map((id, i) =>
          urls[id] ? (
            <img key={id} className={`app-bg__media${i === index ? ' is-visible' : ''}`} src={urls[id]} alt="" style={framingStyle(bg.carouselFraming)} />
          ) : null,
        )}
      {bg.mode === 'video' && bg.videoId && urls[bg.videoId] && (
        <video
          className="app-bg__media is-visible"
          src={urls[bg.videoId]}
          style={framingStyle(bg.videoFraming)}
          autoPlay={!prefersReducedMotion()}
          muted
          loop
          playsInline
        />
      )}
      {hasMedia && <div className="app-bg__overlay" style={{ opacity: bg.overlay / 100 }} />}
    </div>
  );
}
