// @ts-check
const { fontFamily } = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')

// 深度合并函数
function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

/** @type {import("tailwindcss/types").Config } */
const baseConfig = {
  content: [
    './node_modules/pliny/**/*.js',
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,tsx}',
    './src/components/**/*.{js,ts,tsx}',
    './src/layouts/**/*.{js,ts,tsx}',
    './src/templates/**/*.{js,ts,tsx}',
    './data/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      lineHeight: {
        11: '2.75rem',
        12: '3rem',
        13: '3.25rem',
        14: '3.5rem',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Noto Sans SC"', '"Microsoft YaHei"', ...fontFamily.sans],
        display: ['var(--font-display)', '"Songti SC"', '"Noto Serif SC"', 'SimSun', 'serif'],
      },
      borderRadius: {
        control: '10px',
      },
      colors: {
        // 驿·声笺 品牌令牌：取值在 src/css/tailwind.css 的 :root / .dark 中切换，
        // 组件里直接用 bg-sheet / text-ink / border-rule，不需要再写 dark: 变体。
        paper: 'var(--ys-paper)',
        sheet: {
          DEFAULT: 'var(--ys-sheet)',
          raised: 'var(--ys-sheet-raised)',
        },
        rule: {
          DEFAULT: 'var(--ys-rule)',
          strong: 'var(--ys-rule-strong)',
        },
        ink: {
          DEFAULT: 'var(--ys-ink)',
          soft: 'var(--ys-ink-soft)',
          faint: 'var(--ys-ink-faint)',
        },
        brand: {
          DEFAULT: 'var(--ys-brand)',
          hover: 'var(--ys-brand-hover)',
          tint: 'var(--ys-brand-tint)',
          on: 'var(--ys-brand-on)',
        },
        voice: {
          DEFAULT: 'var(--ys-voice)',
          tint: 'var(--ys-voice-tint)',
          rail: 'var(--ys-voice-rail)',
          deep: 'var(--ys-voice-deep)',
        },
        alert: {
          DEFAULT: 'var(--ys-alert)',
          tint: 'var(--ys-alert-tint)',
          deep: 'var(--ys-alert-deep)',
        },
        warn: {
          DEFAULT: 'var(--ys-warn)',
          tint: 'var(--ys-warn-tint)',
          deep: 'var(--ys-warn-deep)',
        },
        focus: 'var(--ys-focus)',
        // 旧模板组件（Share / langswitch / layouts）仍引用的调色板，保留。
        primary: colors.pink,
        heading: colors.blue,
        gray: colors.gray,
      },
      boxShadow: {
        seg: '0 1px 2px rgba(23, 38, 44, 0.08)',
        bar: '0 -8px 24px rgba(23, 38, 44, 0.06)',
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            a: {
              color: theme('colors.primary.500'),
              '&:hover': {
                color: `${theme('colors.primary.600')}`,
              },
              code: { color: theme('colors.primary.400') },
            },
            'h1,h2': {
              fontWeight: '700',
              letterSpacing: theme('letterSpacing.tight'),
            },
            h3: {
              fontWeight: '600',
            },
            code: {
              color: theme('colors.indigo.500'),
            },
          },
        },
        invert: {
          css: {
            a: {
              color: theme('colors.primary.500'),
              '&:hover': {
                color: `${theme('colors.primary.400')}`,
              },
              code: { color: theme('colors.primary.400') },
            },
            'h1,h2,h3,h4,h5,h6': {
              color: theme('colors.gray.100'),
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

// const themeConfig = require('./templates/fluxlora-net/tailwind.config')
const themeConfig = {}
module.exports = deepMerge(baseConfig, themeConfig);
