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
    "grid",
    "grid-cols-4",
    "gap-4",
    "grid-cols-1",
    "grid-cols-2",
    "md:grid-cols-2",
    "bg-green-500",
    "bg-red-500",
    "text-blue-600",
  ],
  theme: {
    extend: {colors: {
        "custom-green-light": "#56B2AD",  /* soft pastel green */
        "custom-green": "#157372",
        "custom-red": "#DA494E",
        "custom-red-light": "#F8C9CB",
        "custom-blue": "#35AADF",
        "custom-blue-light": "#A3C9FF",  /* soft pastel blue */
        "custom-blue1": "#3366CC",        /* darker base blue */
        "custom-yellow-light": "#FFF2B8", /* soft pastel yellow */
        "custom-yellow": "#FFE066",       /* slightly stronger on hover */
        "custom-orange-light": "#FFDAB3",  /* soft pastel orange */
        "custom-orange": "#FFA64D",        /* slightly stronger on hover */
      } },
  },
  plugins: [],
}
