export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: '#0F172A',
        cyan: '#00D4FF'
      },
      boxShadow: {
        glow: '0 0 50px rgba(0, 212, 255, 0.22)',
        soft: '0 24px 80px rgba(15, 23, 42, 0.18)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
