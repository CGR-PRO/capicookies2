import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, Film, Image as ImageIcon, Images, Sparkles, Trash2, Upload } from 'lucide-react';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Glass';
import { framingStyle, useMediaUrls } from '../layout/Background';
import type { BackgroundMode, BackgroundSettings as BG, MediaFraming } from '../../lib/types';

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 150 * 1024 * 1024;

function FramingControls({ value, onChange, idPrefix }: { value: MediaFraming; onChange(f: MediaFraming): void; idPrefix: string }) {
  return (
    <div className="framing">
      <div className="framing__row">
        <label htmlFor={`${idPrefix}-x`}>Horizontal</label>
        <input id={`${idPrefix}-x`} type="range" min={0} max={100} value={value.x} onChange={(e) => onChange({ ...value, x: Number(e.target.value) })} />
        <span className="small muted">{value.x}%</span>
      </div>
      <div className="framing__row">
        <label htmlFor={`${idPrefix}-y`}>Vertical</label>
        <input id={`${idPrefix}-y`} type="range" min={0} max={100} value={value.y} onChange={(e) => onChange({ ...value, y: Number(e.target.value) })} />
        <span className="small muted">{value.y}%</span>
      </div>
      <div className="framing__row">
        <label htmlFor={`${idPrefix}-z`}>Zoom</label>
        <input id={`${idPrefix}-z`} type="range" min={1} max={2.5} step={0.05} value={value.zoom} onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })} />
        <span className="small muted">{value.zoom.toFixed(2)}×</span>
      </div>
      <Segmented
        size="sm"
        label="Enquadramento"
        value={value.fit}
        onChange={(fit) => onChange({ ...value, fit })}
        options={[
          { value: 'cover', label: 'Preencher' },
          { value: 'contain', label: 'Ajustar' },
        ]}
      />
    </div>
  );
}

function Preview({ url, kind, framing, overlay }: { url?: string; kind: 'image' | 'video'; framing: MediaFraming; overlay: number }) {
  return (
    <div className="bg-preview">
      {url ? (
        kind === 'video' ? (
          <video src={url} style={framingStyle(framing)} muted loop autoPlay playsInline />
        ) : (
          <img src={url} alt="Pré-visualização do fundo" style={framingStyle(framing)} />
        )
      ) : (
        <div className="bg-preview__empty">
          <Upload size={22} aria-hidden /> Nenhum arquivo selecionado
        </div>
      )}
      {url && <div className="app-bg__overlay" style={{ opacity: overlay / 100 }} />}
      <div className="bg-preview__card glass">
        <span className="small muted">Saldo atual</span>
        <strong>€ 2.450,00</strong>
      </div>
    </div>
  );
}

export function BackgroundSettings() {
  const { settings, updateSettings, addMedia, removeMedia, media } = useData();
  const toast = useToast();
  const bg = settings.background;
  const [busy, setBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const carouselInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const allIds = [bg.imageId, bg.videoId, ...bg.carouselIds].filter(Boolean) as string[];
  const urls = useMediaUrls(allIds);

  const save = async (patch: Partial<BG>, msg?: string) => {
    try {
      await updateSettings({ background: { ...bg, ...patch } });
      if (msg) toast.success(msg);
    } catch {
      toast.error('Não foi possível salvar a preferência.');
    }
  };

  /** Remove arquivos que não são mais usados por nenhum modo. */
  const cleanup = async (next: BG) => {
    const used = new Set([next.imageId, next.videoId, ...next.carouselIds].filter(Boolean));
    for (const m of media) if (!used.has(m.id)) await removeMedia(m.id).catch(() => undefined);
  };

  const upload = async (files: FileList | null, kind: 'image' | 'carousel' | 'video') => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of Array.from(files)) {
        const isVideo = f.type.startsWith('video/');
        const isImage = f.type.startsWith('image/');
        if (kind === 'video' ? !isVideo : !isImage) {
          toast.error(`“${f.name}” não é ${kind === 'video' ? 'um vídeo' : 'uma imagem'} válido(a).`);
          continue;
        }
        if (f.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
          toast.error(`“${f.name}” excede o limite de ${isVideo ? '150' : '15'} MB.`);
          continue;
        }
        ids.push(await addMedia(f));
      }
      if (!ids.length) return;
      let next: BG;
      if (kind === 'image') next = { ...bg, mode: 'image', imageId: ids[0] };
      else if (kind === 'video') next = { ...bg, mode: 'video', videoId: ids[0] };
      else next = { ...bg, mode: 'carousel', carouselIds: [...bg.carouselIds, ...ids] };
      await updateSettings({ background: next });
      await cleanup(next);
      toast.success(kind === 'carousel' ? `${ids.length} imagem(ns) adicionada(s).` : 'Fundo atualizado.');
    } catch (e) {
      console.error(e);
      toast.error('Falha ao salvar o arquivo. O armazenamento do navegador pode estar cheio.');
    } finally {
      setBusy(false);
      [imageInput, carouselInput, videoInput].forEach((r) => r.current && (r.current.value = ''));
    }
  };

  const moveCarousel = (i: number, dir: -1 | 1) => {
    const ids = [...bg.carouselIds];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    save({ carouselIds: ids });
  };

  const removeCarousel = async (id: string) => {
    const next = { ...bg, carouselIds: bg.carouselIds.filter((x) => x !== id) };
    await save({ carouselIds: next.carouselIds }, 'Imagem removida.');
    await cleanup(next);
  };

  const onFile = (kind: 'image' | 'carousel' | 'video') => (e: ChangeEvent<HTMLInputElement>) => upload(e.target.files, kind);

  return (
    <div className="bg-settings">
      <Segmented<BackgroundMode>
        label="Modo de fundo"
        value={bg.mode}
        onChange={(mode) => save({ mode }, 'Modo de fundo alterado.')}
        options={[
          { value: 'default', label: 'Padrão', icon: <Sparkles size={15} /> },
          { value: 'image', label: 'Foto', icon: <ImageIcon size={15} /> },
          { value: 'carousel', label: 'Carrossel', icon: <Images size={15} /> },
          { value: 'video', label: 'Vídeo', icon: <Film size={15} /> },
        ]}
      />

      {bg.mode === 'default' && <p className="muted">Gradiente azul sereno com iluminação suave. Escolha outro modo para usar suas próprias fotos ou vídeo.</p>}

      {bg.mode === 'image' && (
        <div className="bg-mode">
          <Preview url={bg.imageId ? urls[bg.imageId] : undefined} kind="image" framing={bg.imageFraming} overlay={bg.overlay} />
          <div className="bg-mode__controls">
            <input ref={imageInput} type="file" accept="image/*" hidden onChange={onFile('image')} />
            <Button variant="primary" icon={<Upload size={16} />} loading={busy} onClick={() => imageInput.current?.click()}>
              {bg.imageId ? 'Trocar foto' : 'Enviar foto'}
            </Button>
            <FramingControls idPrefix="img" value={bg.imageFraming} onChange={(f) => save({ imageFraming: f })} />
          </div>
        </div>
      )}

      {bg.mode === 'carousel' && (
        <div className="bg-mode">
          <Preview url={bg.carouselIds[0] ? urls[bg.carouselIds[0]] : undefined} kind="image" framing={bg.carouselFraming} overlay={bg.overlay} />
          <div className="bg-mode__controls">
            <input ref={carouselInput} type="file" accept="image/*" multiple hidden onChange={onFile('carousel')} />
            <Button variant="primary" icon={<Upload size={16} />} loading={busy} onClick={() => carouselInput.current?.click()}>
              Adicionar fotos
            </Button>
            {bg.carouselIds.length > 0 && (
              <ol className="carousel-list">
                {bg.carouselIds.map((id, i) => (
                  <li key={id} className="carousel-item">
                    {urls[id] ? <img src={urls[id]} alt={`Imagem ${i + 1}`} /> : <span className="carousel-item__ph" />}
                    <span className="small">Imagem {i + 1}</span>
                    <button className="icon-btn" onClick={() => moveCarousel(i, -1)} disabled={i === 0} aria-label={`Mover imagem ${i + 1} para cima`}>
                      <ArrowUp size={15} />
                    </button>
                    <button className="icon-btn" onClick={() => moveCarousel(i, 1)} disabled={i === bg.carouselIds.length - 1} aria-label={`Mover imagem ${i + 1} para baixo`}>
                      <ArrowDown size={15} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => removeCarousel(id)} aria-label={`Remover imagem ${i + 1}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="framing__row">
              <label htmlFor="car-int">Tempo de transição</label>
              <input id="car-int" type="range" min={3} max={60} value={bg.carouselIntervalSec} onChange={(e) => save({ carouselIntervalSec: Number(e.target.value) })} />
              <span className="small muted">{bg.carouselIntervalSec}s</span>
            </div>
            <FramingControls idPrefix="car" value={bg.carouselFraming} onChange={(f) => save({ carouselFraming: f })} />
          </div>
        </div>
      )}

      {bg.mode === 'video' && (
        <div className="bg-mode">
          <Preview url={bg.videoId ? urls[bg.videoId] : undefined} kind="video" framing={bg.videoFraming} overlay={bg.overlay} />
          <div className="bg-mode__controls">
            <input ref={videoInput} type="file" accept="video/*" hidden onChange={onFile('video')} />
            <Button variant="primary" icon={<Upload size={16} />} loading={busy} onClick={() => videoInput.current?.click()}>
              {bg.videoId ? 'Trocar vídeo' : 'Enviar vídeo'}
            </Button>
            <p className="field__hint">Reprodução automática, sem som e em loop. Recomendado: MP4/WebM até 150 MB.</p>
            <FramingControls idPrefix="vid" value={bg.videoFraming} onChange={(f) => save({ videoFraming: f })} />
          </div>
        </div>
      )}

      {bg.mode !== 'default' && (
        <div className="framing__row">
          <label htmlFor="overlay">Escurecer fundo (legibilidade)</label>
          <input id="overlay" type="range" min={0} max={70} value={bg.overlay} onChange={(e) => save({ overlay: Number(e.target.value) })} />
          <span className="small muted">{bg.overlay}%</span>
        </div>
      )}
    </div>
  );
}
