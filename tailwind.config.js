/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",           // All HTML files
    "./js/**/*.js",
    "./src/**/*.{js,jsx}",   // If you have a src folder
    "./components/**/*.js",  // Component folders
  ],
  safelist: [
    // Use regex patterns to match classes
    {
      pattern: /^w-/,
      variants: ['sm', 'md', 'lg', 'xl', '2xl', 'top-' , 'right-', 'left-', 'bottom-', 'mr-'], // Optional: include responsive variants
    },
    // Or be more specific
    {
      pattern: /^w-(0|1|2|3|4|5|6|8|10|11|12|14|16|20|24|28|32|36|40|44|45|46|48|52|56|60|64|72|80|96|auto|px|full|screen|min|max|fit)$/,
    },
    // Padding classes
    'px-4',
    'px-6',
    'py-4',
    'py-1',
    'py-2',
    'pl-4',
    'pr-4',
    'pb-2',
    'pb-3',
    'pb-4', 
    // Margin classes
    'ml-4',
    'mr-4',
    'mt-3',
    'mt-6',
    'mt-8',
    'mt-10',
    'mb-8',  
    // Space classes
    'space-y-1',
    'space-y-3',
    'space-y-4',
    'space-y-6',
    'space-y-8', 
    // Gap classes
    'gap-4',
    'gap-6',
    'gap-8', 
    // Text sizes
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
    'text-2xl',
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
    "flex-end",
    "self-end",
    "absolute",
    "top-2",
    "right-2",
    "left-3",
    "top-1/2",
    "transform",
    "-translate-y-1/2",
    "-translate-x-full",
    "translate-x-full",
    "left-0",
    "right-0",
    "fixed",
    "h-[calc(100vh-40px)]",
    "w-full",
    "bg-white",
    "shadow-lg",
    "transition-transform",
    "duration-300",
    "ease-in-out",
    "z-50",
    "rounded-tr-xl",
    "rounded-br-xl",
    "pb-4",
    "bg-black",
    "bg-opacity-30",
    "z-40",
    "hidden",
    "flex",
    "flex-col",
    "p-4",
    "h-[calc(100vh-1rem)]",
    "h-[calc(100vh-3rem)]",
    "h-[calc(100vh-4rem)]",
    "pl-10",
    "pl-16",
    "pl-8",
    "pl-6",
    "md:pl-0",
    "h-4",
    "w-4",
    "text-gray-700",
    "hover:text-teal-600",
    "hover:bg-gray-100",
    "focus:outline-none",
    "h-[calc(100dvh-4rem)]",
    "top-4",
    "top-6",
    "top-8",
    "top-16",
    "bottom-0",
    "flex-shrink-0",
    "overflow-hidden",
    "-translate-x-[calc(100dvh-40px)]",
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
      } ,
      width: {
        '45': '11.25rem',  // 180px
        '46': '11.5rem',   // 184px
        '47': '11.75rem',  // 188px
      }
    },
  },
  plugins: [],
}
