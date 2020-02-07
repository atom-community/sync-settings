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
		"no-warning-comments": "warn",
		"comma-dangle": ["error", "always-multiline"],
		indent: ["error", "tab"],
		"no-tabs": ["error", { allowIndentationTabs: true }],
	},
}
