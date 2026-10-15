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
        },
        stitch: {
          surface: 'var(--stitch-surface)',
          'surface-low': 'var(--stitch-surface-low)',
          'surface-high': 'var(--stitch-surface-high)',
          'surface-highest': 'var(--stitch-surface-highest)',
          'surface-lowest': 'var(--stitch-surface-lowest)',
          primary: 'var(--stitch-primary)',
          gold: '#ffd700',
          'gold-dim': '#e9c400',
          'on-surface': 'var(--stitch-on-surface)',
          'on-surface-variant': 'var(--stitch-on-surface-variant)',
          'ghost-border': 'var(--stitch-ghost-border)',
        },
        // Tactical Slate & Luminous Gold — spec: design/DESIGN-TACTICAL.md
        // (Google Stitch project 2861085646384681595, screen f88b02d0cb)
        // Nilai hex literal (bukan var()) supaya modifier opacity Tailwind
        // (`bg-tac-ok/12`) benar-benar menghasilkan rgb(... / alpha) — Tailwind v3
        // tidak bisa menurunkan alpha dari warna berbasis var().
        tac: {
          base: '#0b0f15',
          canvas: '#0f141c',
          card: '#161d27',
          elevated: '#1e2634',
          recessed: '#0a0e14',
          'c-low': '#151c26',
          c: '#19202a',
          'c-high': '#232a35',
          'c-highest': '#2e3540',
          line: '#283446',
          text: '#dce3f1',
          'text-dim': '#d8c3ad',
          muted: '#64748b',
          gold: '#f59e0b',
          'gold-bright': '#fbbf24',
          'gold-dim': '#b45309',
          cyan: '#06b6d4',
          'cyan-light': '#4cd7f6',
          ok: '#10b981',
          repair: '#f59e0b',
          emergency: '#ef4444',
          standby: '#64748b',
          'error-bg': '#93000a',
        }
      },
      fontFamily: {
        'tac-sans': ['Inter', 'system-ui', 'sans-serif'],
        'tac-mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        tac: '0.75rem',
        'tac-sm': '0.5rem',
      },
      backgroundImage: {
        'nexus-gradient': 'linear-gradient(135deg, var(--nexus-accent) 0%, var(--nexus-accent-2) 100%)',
        'nexus-glass': 'radial-gradient(circle at top left, rgba(245,197,66,0.05), transparent)',
        'stitch-gold': 'var(--stitch-gold-gradient)',
        'tac-gold': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      }
    }
  }
}
