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
        // ── Tactical Slate & Luminous Gold ───────────────────────────────
        // Nama token 1:1 dengan design system Google Stitch project
        // 2861085646384681595 (screen f88b02d0cb). Prefix `tac-` dipakai supaya
        // tidak bentrok dengan token `primary`/`nexus` milik app.
        // Spec: design/DESIGN-TACTICAL.md
        //
        // ⚠️ JANGAN kembalikan nilai di bawah ke hex literal.
        // Setiap warna = `rgb(var(--tac-xxx) / <alpha-value>)`:
        //   • `<alpha-value>` membuat opacity modifier Tailwind tetap mengemit
        //     alpha → `bg-tac-status-emergency/15` benar-benar 15%.
        //   • `var()` membuat warna bisa di-override per tema
        //     (`data-theme` = dark/night · navy · purple · light) di
        //     `src/css/tactical.css` → Dashboard & seluruh halaman ikut tema.
        // Hex literal tidak bisa theme-aware; `var()` polos tidak bisa
        // diopacity-kan Tailwind. Makanya dua-duanya tidak dipakai.
        // Var-nya adalah TRIPLE CHANNEL RGB (mis. `--tac-primary: 255 193 116`).
        tac: {
          surface: {
            base: 'rgb(var(--tac-surface-base) / <alpha-value>)',
            DEFAULT: 'rgb(var(--tac-surface) / <alpha-value>)',
            dim: 'rgb(var(--tac-surface-dim) / <alpha-value>)',
            canvas: 'rgb(var(--tac-surface-canvas) / <alpha-value>)',
            card: 'rgb(var(--tac-surface-card) / <alpha-value>)',
            elevated: 'rgb(var(--tac-surface-elevated) / <alpha-value>)',
            recessed: 'rgb(var(--tac-surface-recessed) / <alpha-value>)',
            bright: 'rgb(var(--tac-surface-bright) / <alpha-value>)',
            variant: 'rgb(var(--tac-surface-variant) / <alpha-value>)',
            'container-lowest': 'rgb(var(--tac-surface-container-lowest) / <alpha-value>)',
            'container-low': 'rgb(var(--tac-surface-container-low) / <alpha-value>)',
            container: 'rgb(var(--tac-surface-container) / <alpha-value>)',
            'container-high': 'rgb(var(--tac-surface-container-high) / <alpha-value>)',
            'container-highest': 'rgb(var(--tac-surface-container-highest) / <alpha-value>)',
            tint: 'rgb(var(--tac-surface-tint) / <alpha-value>)',
          },
          primary: {
            DEFAULT: 'rgb(var(--tac-primary) / <alpha-value>)',
            container: 'rgb(var(--tac-primary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-primary-fixed) / <alpha-value>)',
            'fixed-dim': 'rgb(var(--tac-primary-fixed-dim) / <alpha-value>)',
            inverse: 'rgb(var(--tac-primary-inverse) / <alpha-value>)',
          },
          'on-primary': {
            DEFAULT: 'rgb(var(--tac-on-primary) / <alpha-value>)',
            container: 'rgb(var(--tac-on-primary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-on-primary-fixed) / <alpha-value>)',
            'fixed-variant': 'rgb(var(--tac-on-primary-fixed-variant) / <alpha-value>)',
          },
          secondary: {
            DEFAULT: 'rgb(var(--tac-secondary) / <alpha-value>)',
            container: 'rgb(var(--tac-secondary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-secondary-fixed) / <alpha-value>)',
            'fixed-dim': 'rgb(var(--tac-secondary-fixed-dim) / <alpha-value>)',
          },
          'on-secondary': {
            DEFAULT: 'rgb(var(--tac-on-secondary) / <alpha-value>)',
            container: 'rgb(var(--tac-on-secondary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-on-secondary-fixed) / <alpha-value>)',
            'fixed-variant': 'rgb(var(--tac-on-secondary-fixed-variant) / <alpha-value>)',
          },
          tertiary: {
            DEFAULT: 'rgb(var(--tac-tertiary) / <alpha-value>)',
            container: 'rgb(var(--tac-tertiary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-tertiary-fixed) / <alpha-value>)',
            'fixed-dim': 'rgb(var(--tac-tertiary-fixed-dim) / <alpha-value>)',
          },
          'on-tertiary': {
            DEFAULT: 'rgb(var(--tac-on-tertiary) / <alpha-value>)',
            container: 'rgb(var(--tac-on-tertiary-container) / <alpha-value>)',
            fixed: 'rgb(var(--tac-on-tertiary-fixed) / <alpha-value>)',
            'fixed-variant': 'rgb(var(--tac-on-tertiary-fixed-variant) / <alpha-value>)',
          },
          error: {
            DEFAULT: 'rgb(var(--tac-error) / <alpha-value>)',
            container: 'rgb(var(--tac-error-container) / <alpha-value>)',
          },
          'on-error': {
            DEFAULT: 'rgb(var(--tac-on-error) / <alpha-value>)',
            container: 'rgb(var(--tac-on-error-container) / <alpha-value>)',
          },
          'on-surface': {
            DEFAULT: 'rgb(var(--tac-on-surface) / <alpha-value>)',
            variant: 'rgb(var(--tac-on-surface-variant) / <alpha-value>)',
            inverse: 'rgb(var(--tac-on-surface-inverse) / <alpha-value>)',
          },
          'inverse-surface': 'rgb(var(--tac-inverse-surface) / <alpha-value>)',
          outline: {
            DEFAULT: 'rgb(var(--tac-outline) / <alpha-value>)',
            variant: 'rgb(var(--tac-outline-variant) / <alpha-value>)',
          },
          border: {
            tactical: 'rgb(var(--tac-border-tactical) / <alpha-value>)',
            // Sudah membawa alpha sendiri & tidak pernah dipakai dengan
            // opacity modifier Tailwind → cukup var warna utuh.
            subtle: 'var(--tac-line-subtle)',
          },
          gold: {
            bright: 'rgb(var(--tac-gold-bright) / <alpha-value>)',
            dim: 'rgb(var(--tac-gold-dim) / <alpha-value>)',
            glow: 'var(--tac-gold-glow)',
          },
          status: {
            operational: 'rgb(var(--tac-status-operational) / <alpha-value>)',
            repair: 'rgb(var(--tac-status-repair) / <alpha-value>)',
            emergency: 'rgb(var(--tac-status-emergency) / <alpha-value>)',
            standby: 'rgb(var(--tac-status-standby) / <alpha-value>)',
          },
          sync: {
            cyan: 'rgb(var(--tac-sync-cyan) / <alpha-value>)',
            'cyan-glow': 'var(--tac-sync-glow)',
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
        // S33d: naik ke 12px — audit Lighthouse `font-size` (teks legibel) hanya
        // menghitung >=12px, jadi 10/11px membuat ~47% teks dianggap tidak legibel.
        'label-mono-md': ['12px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
        'label-mono-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '500' }],
      },
      fontFamily: {
        'display-hero': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'headline-lg': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'headline-md': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'body-md': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'body-sm': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'body-lg': ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        'label-mono-lg': ['JetBrains Mono', 'JetBrains Mono Fallback', 'ui-monospace', 'monospace'],
        'label-mono-md': ['JetBrains Mono', 'JetBrains Mono Fallback', 'ui-monospace', 'monospace'],
        'label-mono-sm': ['JetBrains Mono', 'JetBrains Mono Fallback', 'ui-monospace', 'monospace'],
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
        'tac-gold': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      }
    }
  }
}
