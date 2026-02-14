import { Camera, ImagePlus, Paperclip, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ImageData {
  data: string;
  mimeType: string;
}

/** Max image dimension in pixels before compression. */
const MAX_DIMENSION = 1024;
/** JPEG compression quality (0–1). */
const JPEG_QUALITY = 0.8;

/** Compress/resize an image file on canvas, return as base64 (no data URL prefix). */
function compressImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode image'));
        return;
      }
      resolve({ data: base64, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ── Shared context so the button can trigger actions managed by the provider ──

interface ImageAttachContextValue {
  openFilePicker: () => void;
  startWebcam: () => void;
}

const ImageAttachContext = createContext<ImageAttachContextValue | null>(null);

// ── Provider: previews, webcam overlay, hidden file input ───────────────────

export interface ImageAttachmentProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  /** Called when the webcam fails to start (permission denied, hardware disabled, etc.). */
  onWebcamError?: () => void;
  children?: React.ReactNode;
}

/**
 * Renders image preview thumbnails, webcam overlay, and a hidden file input.
 * Wrap your input bar with this component and place `<ImageAttachButton />` wherever you want the trigger.
 */
export function ImageAttachment({ images, onImagesChange, onWebcamError, children }: ImageAttachmentProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Assign the stream to the video element once it's rendered
  useEffect(() => {
    if (webcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [webcamActive]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        const img = await compressImage(file);
        onImagesChange([...images, img]);
      } catch {
        // silently ignore failed image processing
      }
      e.target.value = '';
    },
    [images, onImagesChange],
  );

  const removeImage = useCallback(
    (index: number) => {
      onImagesChange(images.filter((_, i) => i !== index));
    },
    [images, onImagesChange],
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setWebcamActive(true);
    } catch {
      onWebcamError?.();
    }
  }, [onWebcamError]);

  const captureWebcam = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const base64 = dataUrl.split(',')[1];
    if (base64) {
      onImagesChange([...images, { data: base64, mimeType: 'image/jpeg' }]);
    }
    stopStream();
    setWebcamActive(false);
  }, [images, onImagesChange, stopStream]);

  const cancelWebcam = useCallback(() => {
    stopStream();
    setWebcamActive(false);
  }, [stopStream]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const ctxValue: ImageAttachContextValue = { openFilePicker, startWebcam };

  return (
    <ImageAttachContext.Provider value={ctxValue}>
      {/* Webcam capture overlay — portaled to body to escape transform containment */}
      {webcamActive &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur">
            <video ref={videoRef} autoPlay playsInline muted className="max-h-[60vh] max-w-[90vw] rounded-lg" />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={captureWebcam} className="rounded-full bg-white px-6 py-2 font-medium text-black transition-colors hover:bg-zinc-200">
                {t('chat.capture')}
              </button>
              <button type="button" onClick={cancelWebcam} className="rounded-full bg-zinc-700 px-6 py-2 font-medium text-white transition-colors hover:bg-zinc-600">
                {t('chat.cancel')}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Image preview thumbnails */}
      {images.length > 0 && (
        <div className="flex gap-2 px-2 pb-1">
          {images.map((img, i) => (
            <div key={img.data.slice(0, 32)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-600">
              <img src={`data:${img.mimeType};base64,${img.data}`} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeImage(i)} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-red-600 hover:text-white transition-colors" aria-label={t('chat.removeImage')}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {children}
    </ImageAttachContext.Provider>
  );
}

// ── Button: renders the popover trigger, can be placed anywhere inside ImageAttachment ──

/**
 * Attach-image button with a popover offering "pick file" and "capture webcam".
 * Must be rendered inside an `<ImageAttachment>` wrapper.
 */
export function ImageAttachButton() {
  const { t } = useTranslation();
  const ctx = useContext(ImageAttachContext);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!ctx) {
    return null;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" aria-label={t('chat.attachImage')} title={t('chat.attachImage')}>
          <Paperclip className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-48 p-1">
        <button
          type="button"
          onClick={() => {
            setPopoverOpen(false);
            ctx.openFilePicker();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          <ImagePlus className="h-4 w-4 text-zinc-400" />
          {t('chat.attachImage')}
        </button>
        <button
          type="button"
          onClick={() => {
            setPopoverOpen(false);
            ctx.startWebcam();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          <Camera className="h-4 w-4 text-zinc-400" />
          {t('chat.captureWebcam')}
        </button>
      </PopoverContent>
    </Popover>
  );
}
