/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          light: '#25D366',
          teal: '#128C7E',
          dark: '#075E54',
          chatbg: '#ECE5DD',
          bubble: '#DCF8C6',
          blue: '#34B7F1'
        }
      }
    },
  },
  plugins: [],
}

