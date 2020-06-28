module.exports = {
	env: {
		node: true,
		jasmine: true,
		atomtest: true,
	},
	plugins: [
		'react',
	],
	settings: {
		react: {
			version: '16',
		},
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
		'no-warning-comments': 'warn',
		'comma-dangle': ['error', 'always-multiline'],
		indent: ['error', 'tab', { SwitchCase: 1 }],
		'no-tabs': ['error', { allowIndentationTabs: true }],
		'no-restricted-globals': [
			'error',
			{
				name: 'fit',
				message: 'Do not commit focused tests.',
			},
			{
				name: 'fdescribe',
				message: 'Do not commit focused tests.',
			},
		],
		'react/jsx-uses-react': 'error',
		'react/jsx-uses-vars': 'error',
		'react/jsx-indent': ['error', 'tab'],
		'react/jsx-no-bind': 'error',
	},
}
