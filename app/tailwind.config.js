/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				// 设计令牌颜色系统
				primary: {
					50: '#E0F7F4',
					100: '#B3EDE5',
					500: '#26C6B0',
					700: '#1A9B8A',
					900: '#0D5A4F',
				},
				secondary: {
					50: '#FFF4E6',
					100: '#FFE4C2',
					500: '#FF9F43',
					700: '#E8852E',
					900: '#A65E1F',
				},
				neutral: {
					50: '#FAFAF9',
					100: '#F5F5F4',
					200: '#E7E5E4',
					400: '#A8A29E',
					600: '#57534E',
					800: '#292524',
				},
				success: {
					500: '#22C55E',
					700: '#16A34A',
				},
				warning: {
					500: '#F59E0B',
				},
				error: {
					500: '#EF4444',
				},
				info: {
					500: '#3B82F6',
				},
				// 背景色
				bg: {
					primary: '#FAFAF9',
					card: '#FFFFFF',
					elevated: '#FFFFFF',
				},
			},
			fontFamily: {
				french: ['Nunito', 'Noto Sans', 'system-ui', 'sans-serif'],
				chinese: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
				phonetic: ['Noto Sans', 'Doulos SIL', 'system-ui', 'sans-serif'],
				number: ['Roboto', 'Tabular Nums', 'sans-serif'],
			},
			fontSize: {
				'xs': '12px',
				'sm': '14px',
				'base': '16px',
				'lg': '20px',
				'xl': '24px',
				'2xl': '32px',
				'3xl': '40px',
				'4xl': '48px',
			},
			borderRadius: {
				sm: '4px',
				base: '8px',
				md: '12px',
				lg: '16px',
				xl: '20px',
				full: '9999px',
			},
			spacing: {
				'1': '4px',
				'2': '8px',
				'3': '12px',
				'4': '16px',
				'5': '20px',
				'6': '24px',
				'8': '32px',
				'10': '40px',
				'12': '48px',
				'16': '64px',
				'20': '80px',
			},
			boxShadow: {
				sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
				base: '0 2px 8px rgba(0, 0, 0, 0.08)',
				md: '0 4px 16px rgba(0, 0, 0, 0.1)',
				lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
				colored: '0 4px 16px rgba(38, 198, 176, 0.2)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}