// /api/epg.js
let cachedData = null;
let lastFetchDate = null;

export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];

  // Se abbiamo già i dati e sono di oggi → restituisci cache
  if (cachedData && lastFetchDate === today) {
    console.log('✅ Servito EPG dalla cache in memoria');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(cachedData);
  }

  // Altrimenti scarica dall’API esterna
  try {
    
    console.log('⬇️  Scarico nuova EPG dal server remoto');

    const remoteUrl = 'https://www.emax83dev.it/api/epg';
    const response = await fetch(remoteUrl);
    if (!response.ok) throw new Error('Errore HTTP');

    const data = await response.json();

    // Salva in memoria
    cachedData = data;
    lastFetchDate = today;

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    console.error('Errore nel fetch EPG:', err);
    if (cachedData) {
      // fallback su vecchi dati in caso d’errore temporaneo
      return res.status(200).json(cachedData);
    }
    res.status(500).json({ error: 'Impossibile caricare la guida TV' });
  }
}
