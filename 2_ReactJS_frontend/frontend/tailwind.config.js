module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: "media", // or 'media' or 'class'
  theme: {
    extend: {
      minWidth: {
        screen: "1540px",
      },
      maxWidth: {
        screen: "1920px",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
