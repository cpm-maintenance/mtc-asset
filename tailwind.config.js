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
        // ── Tactical Slate & Luminous Gold ───────────────────────────────
        // Nama token 1:1 dengan design system Google Stitch project
        // 2861085646384681595 (screen f88b02d0cb). Prefix `tac-` dipakai supaya
        // tidak bentrok dengan token `primary`/`nexus` milik app.
        // Spec: design/DESIGN-TACTICAL.md
        tac: {
          surface: {
            base: '#0b0f15',
            DEFAULT: '#0d141d',
            dim: '#0d141d',
            canvas: '#0f141c',
            card: '#161d27',
            elevated: '#1e2634',
            recessed: '#0a0e14',
            bright: '#333a44',
            variant: '#2e3540',
            'container-lowest': '#080f18',
            'container-low': '#151c26',
            container: '#19202a',
            'container-high': '#232a35',
            'container-highest': '#2e3540',
            tint: '#ffb95f',
          },
          primary: {
            DEFAULT: '#ffc174',
            container: '#f59e0b',
            fixed: '#ffddb8',
            'fixed-dim': '#ffb95f',
            inverse: '#855300',
          },
          'on-primary': {
            DEFAULT: '#472a00',
            container: '#613b00',
            fixed: '#2a1700',
            'fixed-variant': '#653e00',
          },
          secondary: {
            DEFAULT: '#4cd7f6',
            container: '#03b5d3',
            fixed: '#acedff',
            'fixed-dim': '#4cd7f6',
          },
          'on-secondary': {
            DEFAULT: '#003640',
            container: '#00424e',
            fixed: '#001f26',
            'fixed-variant': '#004e5c',
          },
          tertiary: {
            DEFAULT: '#ffbcb7',
            container: '#ff938c',
            fixed: '#ffdad7',
            'fixed-dim': '#ffb3ad',
          },
          'on-tertiary': {
            DEFAULT: '#68000a',
            container: '#8d0012',
            fixed: '#410004',
            'fixed-variant': '#930013',
          },
          error: { DEFAULT: '#ffb4ab', container: '#93000a' },
          'on-error': { DEFAULT: '#690005', container: '#ffdad6' },
          'on-surface': { DEFAULT: '#dce3f1', variant: '#d8c3ad', inverse: '#2a313b' },
          'inverse-surface': '#dce3f1',
          outline: { DEFAULT: '#a08e7a', variant: '#534434' },
          border: { tactical: '#283446', subtle: 'rgba(255, 255, 255, 0.06)' },
          gold: {
            bright: '#fbbf24',
            dim: '#b45309',
            glow: 'rgba(245, 158, 11, 0.18)',
          },
          status: {
            operational: '#10b981',
            repair: '#f59e0b',
            emergency: '#ef4444',
            standby: '#64748b',
          },
          sync: {
            cyan: '#06b6d4',
            'cyan-glow': 'rgba(6, 182, 212, 0.2)',
          },
        }
      },
      // Skala tipografi & spacing persis dari design system (bukan default Tailwind)
      fontSize: {
        'display-hero': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['26px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-lg-mobile': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-mono-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.04em', fontWeight: '500' }],
        'label-mono-md': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
        'label-mono-sm': ['10px', { lineHeight: '14px', letterSpacing: '0.1em', fontWeight: '500' }],
      },
      fontFamily: {
        'display-hero': ['Inter', 'system-ui', 'sans-serif'],
        'headline-lg': ['Inter', 'system-ui', 'sans-serif'],
        'headline-md': ['Inter', 'system-ui', 'sans-serif'],
        'body-md': ['Inter', 'system-ui', 'sans-serif'],
        'body-sm': ['Inter', 'system-ui', 'sans-serif'],
        'body-lg': ['Inter', 'system-ui', 'sans-serif'],
        'label-mono-lg': ['JetBrains Mono', 'ui-monospace', 'monospace'],
        'label-mono-md': ['JetBrains Mono', 'ui-monospace', 'monospace'],
        'label-mono-sm': ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        gutter: '1rem',
        'gutter-desktop': '1.5rem',
        margin: '1rem',
        'margin-desktop': '2rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
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
