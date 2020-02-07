module.exports = {
	env: {
		node: true,
		jasmine: true,
		atomtest: true,
	},
	extends: [
		'standard',
	],
	globals: {
		atom: 'readonly',
	},
	parserOptions: {
		ecmaVersion: 2018,
	},
	rules: {
		"handle-callback-err": "off",
		camelcase: "off",
		"no-warning-comments": "warn",
		"comma-dangle": ["error", "always-multiline"],
		semi: ["error", "always"],
		indent: ["error", "tab"],
		"no-tabs": ["error", { allowIndentationTabs: true }],
	},
};
