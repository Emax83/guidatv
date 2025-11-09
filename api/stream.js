// /api/stream.js

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Parametro url mancante' });
  }

  try {
    // Richiesta lato server — evita CORS
    const response = await fetch(url, {
      headers: {
        // Alcuni server IPTV richiedono user-agent “classico”
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Errore fetch remoto: ${response.status}` });
    }

    // Copia headers essenziali
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream diretto della risposta
    const data = await response.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (err) {
    console.error('Errore nel proxy streaming:', err);
    res.status(500).json({ error: 'Errore nel proxy streaming' });
  }
}
