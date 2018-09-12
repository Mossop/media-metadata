module.exports = {
  "parser": "babel-eslint",
  "env": {
    "es6": true,
    "commonjs": true,
  },
  "extends": [
    "eslint:recommended",
    "plugin:import/errors",
  ],
  "parserOptions": {
    "ecmaVersion": 2018,
  },
  "rules": {
    "indent": [
      "error",
      2, {
        "MemberExpression": "off",
        "SwitchCase": 1,
      }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "comma-dangle": [
      "error",
      "always-multiline"
    ],
    "consistent-return": "error",
    "no-console": "off",
  },
};
