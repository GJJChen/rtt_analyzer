/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用基于 class 的暗色模式
  theme: {
    extend: {
      colors: {
        // 黑金主题主色
        primary: '#C79B45',
        gold: '#C79B45',
      },
    },
  },
  plugins: [],
}