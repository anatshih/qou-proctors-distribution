/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        qou: {
          primary: '#005a36',     // QOU Forest Green
          dark: '#004227',        // Darker forest green
          light: '#0b7348',       // Lighter forest green
          accent: '#c2a649',      // QOU Gold/Sand
          accentDark: '#9e8331',  // Dark gold
          accentLight: '#f3ebcf', // Very soft gold tint
          surface: '#f8faf9',     // Cool off-white background
        }
      },
      fontFamily: {
        sans: ['Cairo', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
