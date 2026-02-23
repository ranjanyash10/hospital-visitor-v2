/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#fff4f0',
                    100: '#ffe4db',
                    200: '#ffc8b5',
                    300: '#ffa080',
                    400: '#f77c55',
                    500: '#f26034',
                    600: '#d94e25',
                    700: '#b53d1c',
                    800: '#8f3118',
                    900: '#6e2814',
                },
            },
        },
    },
    plugins: [],
}
