// Gera os ícones PWA (public/icons/) a partir da marca em app/icon.svg.
// Uso: npm run icons
import sharp from 'sharp'
import { mkdir } from 'fs/promises'

// Versão com padding e fundo areia — ícones maskable não podem sangrar na borda
const svg = (size, pad) => `
<svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#fbf9f5"/>
  <g transform="translate(${pad} ${pad}) scale(${(48 - pad * 2) / 48})">
    <circle cx="24" cy="24" r="22" fill="#1f5f66"/>
    <path d="M10 34c4.5-3 9.5-3 14 0s9.5 3 14 0" stroke="#7cc4c7" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
    <path d="M14.5 23.5 21 30l12.5-14" stroke="#e8866a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

await mkdir('public/icons', { recursive: true })

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size, 6)))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ public/icons/icon-${size}.png`)
}
