module.exports = [
    {
        rules: {
            indent: 0,
            "max-len": "off",
            "comma-dangle": "off",
            "eol-last": "off",
            "object-curly-spacing": "off",
            "no-useless-escape": "off",
            "space-before-function-paren": ["error", {
                anonymous: "always",
                named: "never",
                asyncArrow: "always",
            }],
        }
    }
];
