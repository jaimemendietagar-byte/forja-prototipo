'use client';

import { useState, useRef } from 'react';

export default function PrototipoVideo() {
  const [images, setImages] = useState([]);
  const [audio, setAudio] = useState(null);
  const [status, setStatus] = useState('Listo para probar');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const ffmpegRef = useRef(null);

  async function normalizeImageToJpeg(file, width = 720, height = 1280) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const scale = Math.max(width / img.width, height / img.height);
    const x = (width - img.width * scale) / 2;
    const y = (height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    URL.revokeObjectURL(url);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function getAudioDuration(file) {
    const audioEl = new Audio();
    const url = URL.createObjectURL(file);
    const duration = await new Promise((resolve, reject) => {
      audioEl.onloadedmetadata = () => resolve(audioEl.duration);
      audioEl.onerror = reject;
      audioEl.src = url;
    });
    URL.revokeObjectURL(url);
    return duration;
  }

  async function handleGenerate() {
    if (images.length === 0 || !audio) {
      alert('Sube al menos una imagen y un archivo de audio (.mp3 o .wav).');
      return;
    }

    setIsProcessing(true);
    setVideoUrl(null);
    setProgress(0);

    try {
      if (!ffmpegRef.current) {
        setStatus('Cargando motor FFmpeg en tu navegador...');
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();
        ffmpeg.on('progress', ({ progress: p }) => {
          setProgress(Math.min(Math.round(p * 100), 99));
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegRef.current = ffmpeg;
      }

      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = await import('@ffmpeg/util');

      setStatus('Preparando imágenes en formato Short (9:16)...');
      const duration = await getAudioDuration(audio);
      const secondsPerImage = duration / images.length;

      let concatContent = '';
      for (let i = 0; i < images.length; i++) {
        const jpegData = await normalizeImageToJpeg(images[i]);
        const fileName = `img${i}.jpg`;
        await ffmpeg.writeFile(fileName, jpegData);
        concatContent += `file '${fileName}'\nduration ${secondsPerImage.toFixed(2)}\n`;
      }
      concatContent += `file 'img${images.length - 1}.jpg'\n`;

      await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatContent));

      setStatus('Cargando audio...');
      const ext = audio.name.split('.').pop() || 'mp3';
      const audioFileName = `audio.${ext}`;
      await ffmpeg.writeFile(audioFileName, await fetchFile(audio));

      setStatus('Fabricando el vídeo... (no cierres esta pestaña)');
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-i', audioFileName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        '-r', '24',
        'output.mp4',
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);

      setVideoUrl(url);
      setProgress(100);
      setStatus('¡Vídeo fabricado con éxito!');
    } catch (error) {
      console.error(error);
      setStatus('Error durante el montaje. Pulsa F12 y mira la pestaña Console.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: '560px', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '24px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 8px 0' }}>Forja — Prototipo de Montaje (FFmpeg)</h1>
        <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '0 0 24px 0' }}>
          Motor de vídeo gratuito corriendo directamente en tu navegador.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>
            1. Selecciona las imágenes (frames del Short)
          </label>
          <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} />
          {images.length > 0 && <p style={{ fontSize: '12px', color: '#34d399', marginTop: '6px' }}>{images.length} imágenes cargadas</p>}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>
            2. Selecciona el audio (.mp3 o .wav)
          </label>
          <input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] || null)} />
          {audio && <p style={{ fontSize: '12px', color: '#34d399', marginTop: '6px' }}>Audio: {audio.name}</p>}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing || images.length === 0 || !audio}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 600,
            fontSize: '15px',
            cursor: isProcessing || images.length === 0 || !audio ? 'not-allowed' : 'pointer',
            backgroundColor: isProcessing || images.length === 0 || !audio ? '#3f3f46' : '#2563eb',
            color: '#ffffff',
            marginBottom: '16px',
          }}
        >
          {isProcessing ? `Fabricando... (${progress}%)` : 'Fabricar vídeo'}
        </button>

        <div style={{ fontSize: '14px', backgroundColor: '#09090b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
          Estado: <strong>{status}</strong>
        </div>

        {videoUrl && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #27272a' }}>
            <video src={videoUrl} controls style={{ width: '100%', maxHeight: '460px', borderRadius: '10px', backgroundColor: '#000' }} />
            <a
              href={videoUrl}
              download="short-forja.mp4"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: '12px',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: '#059669',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Descargar MP4
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
