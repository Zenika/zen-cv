const bemName = '[a-z][a-z0-9]*(-[a-z0-9]+)*'

/** @type {import('stylelint').Config} */
export default {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-standard-vue/scss',
    'stylelint-config-recess-order',
  ],
  rules: {
    'selector-class-pattern': [
      `^${bemName}(__${bemName})?(--${bemName})?$`,
      {
        resolveNestedSelectors: true,
        message: (selector) => `Expected "${selector}" to follow BEM: block__element--modifier`,
      },
    ],
    'declaration-no-important': true,
    'selector-max-id': 0,
    'selector-max-type': 0,
    'max-nesting-depth': [3, { ignoreAtRules: ['media', 'include'] }],
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-box-decoration-break'] }],
  },
  overrides: [
    {
      files: ['src/styles/cv.scss'],
      rules: { 'selector-max-type': null },
    },
  ],
}
