/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                success: '#16A34A',
                danger: '#DC2626',
                warning: '#F59E0B',
                bg: {
                    primary: '#F6F8FC',
                    secondary: '#EEF4FF',
                    tertiary: '#E6EEFF',
                    elevated: '#F8FAFF',
                    card: '#FFFFFF',
                    'card-hover': '#F8FBFF',
                },
                text: {
                    primary: '#0F172A',
                    secondary: '#475569',
                    tertiary: '#64748B',
                    inverse: '#F8FAFC',
                },
                accent: {
                    'blue-dark': '#003B8F',
                    blue: '#0B57D0',
                    'blue-light': '#2563EB',
                    purple: '#6A1BFF',
                    'purple-light': '#7C3AED',
                    indigo: '#4F46E5',
                    emerald: '#16A34A',
                    amber: '#F59E0B',
                    rose: '#DC2626',
                    cyan: '#38BDF8',
                },
                border: {
                    subtle: '#E2E8F0',
                    hover: '#CBD5E1',
                    strong: '#B6C3DA',
                    glow: 'rgba(106, 27, 255, 0.18)',
                },
                gray: {
                    50: '#F8FAFC',
                    100: '#0F172A',
                    200: '#1E293B',
                    300: '#334155',
                    400: '#475569',
                    500: '#64748B',
                    600: '#94A3B8',
                    700: '#CBD5E1',
                    800: '#E2E8F0',
                    900: '#F8FAFC',
                },
                white: '#FFFFFF',
            },
            fontFamily: {
                sans: ['Manrope', ...defaultTheme.fontFamily.sans],
                display: ['Sora', 'Manrope', ...defaultTheme.fontFamily.sans],
                mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
            },
            boxShadow: {
                'glow-sm': '0 16px 30px -22px rgba(11, 87, 208, 0.45)',
                'glow': '0 22px 48px -28px rgba(11, 87, 208, 0.42)',
                'glow-lg': '0 30px 72px -34px rgba(106, 27, 255, 0.3)',
                'glow-purple': '0 22px 48px -28px rgba(106, 27, 255, 0.3)',
                'glow-emerald': '0 22px 48px -28px rgba(22, 163, 74, 0.25)',
                'glow-rose': '0 22px 48px -28px rgba(220, 38, 38, 0.28)',
                'glow-amber': '0 22px 48px -28px rgba(245, 158, 11, 0.3)',
                'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.7)',
                'card': '0 22px 48px -30px rgba(15, 23, 42, 0.18), 0 2px 10px 0 rgba(148, 163, 184, 0.08)',
                'card-hover': '0 28px 70px -34px rgba(15, 23, 42, 0.22), 0 8px 18px 0 rgba(11, 87, 208, 0.08)',
            },
            backgroundImage: {
                'brand-gradient': 'linear-gradient(135deg, #003B8F 0%, #6A1BFF 100%)',
                'brand-gradient-soft': 'linear-gradient(135deg, rgba(0, 59, 143, 0.1) 0%, rgba(106, 27, 255, 0.12) 100%)',
            },
            animation: {
                float: 'float 10s ease-in-out infinite',
                'float-delayed': 'float 10s ease-in-out infinite 4s',
                'pulse-glow': 'pulse-glow 3.2s ease-in-out infinite',
                'gradient-shift': 'gradient-shift 9s ease infinite',
                'slide-up': 'slide-up 0.55s ease-out',
                'fade-in': 'fade-in 0.5s ease-out',
                'spin-slow': 'spin 12s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '33%': { transform: 'translateY(-10px) rotate(1deg)' },
                    '66%': { transform: 'translateY(6px) rotate(-1deg)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.45' },
                    '50%': { opacity: '0.9' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(18px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
            },
        },
    },
    plugins: [],
};
