export const metadata = {
  title: 'Forja — Prototipo FFmpeg',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, backgroundColor: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
