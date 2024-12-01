/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Adjust based on your project structure
  ],
  theme: {
    extend: {
      colors: {
        primary: "#14B8A6",    // Cyan
        secondary: "#F43F5E",  // Pink
        background: "#1E293B", // Dark Navy
        text: "#F8FAFC",       // Light White
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Optional: Add a clean font
      },
    },
  },
  plugins: [],
};
