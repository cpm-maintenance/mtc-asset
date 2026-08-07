/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
    "./src/**/*.html",
    "./public/pages/**/*.html",
    "./public/components/**/*.html",
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        primary: 'var(--nexus-accent)',
        nexus: {
          black: 'var(--nexus-bg)',
          dark: 'var(--nexus-card)',
          accent: 'var(--nexus-accent)',
          purple: 'var(--nexus-purple)',
          blue: '#0061ff',
          text: 'var(--text-main)',
          muted: 'var(--text-muted)',
        }
      },
      backgroundImage: {
        'nexus-gradient': 'linear-gradient(135deg, var(--nexus-accent) 0%, var(--nexus-accent-2) 100%)',
        'nexus-glass': 'radial-gradient(circle at top left, rgba(245,197,66,0.05), transparent)',
      }
    }
  }
}