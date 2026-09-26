# Trucardo

Anotador de truco uruguayo y argentino por voz. Decís "Truco Nosotros", "quiero",
"envido para Ellos"… y la app suma los palitos sola.

## Usarla en el celular

1. Abrí la URL publicada en **Chrome (Android)** o **Safari (iPhone)**.
2. Menú del navegador → **Agregar a pantalla de inicio** (queda como app).
3. Nueva partida → elegí modalidad, puntos y nombres → tocá el micrófono y dejá el
   celular en la mesa.

La voz necesita internet. Sin voz, todo se puede hacer con los botones o escribiendo el canto.

## Desarrollo

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

Publicar en GitHub Pages (compila y sube `dist/` a la rama `gh-pages`):

```bash
npm run deploy
```

`dist/` es un sitio estático: también sirve Netlify, Vercel o Cloudflare Pages. Tiene que
servirse por **HTTPS** para que el micrófono funcione.

Ver [DESIGN.md](DESIGN.md) para decisiones, reglas y la gramática de voz.
