export type CompressedMedia = { id: string; name: string; type: string; dataUrl: string; size: number; duration?: number; poster?: string };

const MAX_MEGAPIXELS = 50;
const MAX_DIMENSION = 8000;
const WEBP_QUALITY = 0.78;
const MAX_VIDEO_SECONDS = 15;
const VIDEO_TARGET_WIDTH = 854;
const VIDEO_TARGET_BITRATE = 1_200_000;

export async function compressImage(file: File): Promise<CompressedMedia> {
  if (!file.type.startsWith('image/')) {
    const dataUrl = await readAsDataURL(file);
    return { id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, type: file.type, dataUrl, size: file.size };
  }

  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  const megapixels = pixels / 1_000_000;

  let targetW = bitmap.width;
  let targetH = bitmap.height;

  if (megapixels > MAX_MEGAPIXELS || bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
    const scale = Math.min(
      MAX_DIMENSION / bitmap.width,
      MAX_DIMENSION / bitmap.height,
      Math.sqrt((MAX_MEGAPIXELS * 1_000_000) / pixels),
    );
    targetW = Math.round(bitmap.width * scale);
    targetH = Math.round(bitmap.height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/webp', WEBP_QUALITY);
  const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.(png|jpe?g|bmp|tiff?|heic|gif)$/i, '.webp'),
    type: 'image/webp',
    dataUrl,
    size: sizeKb,
  };
}

export async function compressVideo(file: File): Promise<CompressedMedia> {
  if (!file.type.startsWith('video/')) {
    return compressImage(file);
  }

  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type });
  const videoUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Video konnte nicht geladen werden'));
  });

  const originalDuration = video.duration;
  const trimDuration = Math.min(originalDuration, MAX_VIDEO_SECONDS);


  const sourceW = video.videoWidth;
  const sourceH = video.videoHeight;
  const scale = Math.min(1, VIDEO_TARGET_WIDTH / sourceW);
  const targetW = Math.round(sourceW * scale / 2) * 2;
  const targetH = Math.round(sourceH * scale / 2) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');

  const stream = canvas.captureStream(30);
  const mimeType = pickVideoMime();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_TARGET_BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType })); });

  video.currentTime = 0;
  await new Promise<void>((r) => { video.onseeked = () => r(); });
  await video.play();
  recorder.start();

  let rafId = 0;
  const drawFrame = () => { ctx.drawImage(video, 0, 0, targetW, targetH); rafId = requestAnimationFrame(drawFrame); };
  drawFrame();

  await new Promise<void>((r) => setTimeout(r, trimDuration * 1000));
  video.pause();
  cancelAnimationFrame(rafId);
  recorder.stop();
  URL.revokeObjectURL(videoUrl);

  const compressedBlob = await done;
  const dataUrl = await readAsDataURL(compressedBlob);
  const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = targetW;
  posterCanvas.height = targetH;
  const posterCtx = posterCanvas.getContext('2d');
  let poster: string | undefined;
  if (posterCtx) {
    posterCtx.drawImage(video, 0, 0, targetW, targetH);
    poster = posterCanvas.toDataURL('image/webp', 0.6);
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.(mp4|mov|avi|mkv|webm|m4v)$/i, '.webm'),
    type: 'video/webm',
    dataUrl,
    size: sizeKb,
    duration: trimDuration,
    poster,
  };
}

export async function compressMedia(file: File): Promise<CompressedMedia> {
  if (file.type.startsWith('video/')) return compressVideo(file);
  return compressImage(file);
}

function pickVideoMime(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

function readAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}
