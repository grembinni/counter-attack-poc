export default {
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'background', 'background-color', 'border-color', 'border', 'fill', 'stroke'],
      {
        ignoreValues: ['transparent', 'inherit', 'currentColor', 'none'],
      },
    ],
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
  },
};
