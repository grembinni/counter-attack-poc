export default {
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'background', 'background-color', 'border-color', 'fill', 'stroke'],
      {
        ignoreValues: ['transparent', 'inherit', 'currentColor', 'none'],
        expandShorthand: true,
      },
    ],
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
  },
};
