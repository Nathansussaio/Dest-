/* Completa o app.json com as chaves que ficam fora do código (arquivo .env):
   GOOGLE_MAPS_ANDROID_KEY = chave do Google Maps para o mapa no Android (grátis dentro da cota do Google). */
/* EXPO_BASE_URL: caminho do site quando ele não fica na raiz do endereço (no GitHub Pages: /Dest-). Com domínio próprio, deixe vazio. */
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
  android: {
    ...config.android,
    config: { ...(config.android && config.android.config), googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY || '' } }
  }
});
