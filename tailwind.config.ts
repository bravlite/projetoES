import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

// Identidade "Concluído" — capixaba:
//   brand = azul-petróleo (mar de Vitória)
//   clay  = terracota (panela de barro)
//   sand  = areia (fundos quentes)
//   gray  = stone (neutros quentes em todo o app)
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.stone,
        brand: {
          50: '#eefaf9',
          100: '#d5f2f0',
          200: '#b0e4e3',
          300: '#79cfd0',
          400: '#44b0b4',
          500: '#2a9298',
          600: '#22757c',
          700: '#1f5f66',
          800: '#1e4d54',
          900: '#153f45',
          950: '#07272c',
        },
        clay: {
          50: '#fdf5f2',
          100: '#fbe8e1',
          200: '#f8d3c6',
          300: '#f2b3a0',
          400: '#e8866a',
          500: '#dd6444',
          600: '#c94b2c',
          700: '#a83c23',
          800: '#8b3421',
          900: '#732f21',
          950: '#3e150d',
        },
        sand: {
          50: '#fbf9f5',
          100: '#f5f0e7',
          200: '#eadfce',
          300: '#dcc9ad',
        },
        ink: '#16302f',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 48, 47, 0.05), 0 4px 16px -4px rgba(22, 48, 47, 0.08)',
        lift: '0 2px 4px rgba(22, 48, 47, 0.06), 0 12px 32px -8px rgba(22, 48, 47, 0.16)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}

export default config
