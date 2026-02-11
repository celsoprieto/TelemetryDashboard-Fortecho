/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/**/*.js"
  ],
  safelist: [
    "bg-teal-600",
    "text-white",
    "border-teal-600",
    "bg-white",
    "text-gray-700",
    "border-gray-200",
    "hover:bg-gray-50",
    "mr-1",
    "inline-flex",
    "items-center",
    "justify-center",
    "min-w-[38px]",
    "h-10",
    "px-3",
    "rounded-xl",
    "text-sm",
    "border",
    "transition",
    "whitespace-nowrap",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
