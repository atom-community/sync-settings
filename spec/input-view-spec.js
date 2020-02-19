const InputView = require('../lib/input-view')
// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('InputView', () => {
	it('confirm', async () => {
		const view = new InputView()
		spyOn(view, 'confirm').and.callThrough()
		spyOn(view, 'destroy').and.callThrough()
		view.editor.setText('test')
		atom.commands.dispatch(view.editor.getElement(), 'core:confirm')
		const output = await view.getInput()
		expect(output).toBe('test')
		expect(view.confirm).toHaveBeenCalled()
		expect(view.destroy).toHaveBeenCalled()
	})

	it('cancel', async () => {
		const view = new InputView()
		spyOn(view, 'confirm').and.callThrough()
		spyOn(view, 'destroy').and.callThrough()
		view.editor.setText('test')
		atom.commands.dispatch(view.editor.getElement(), 'core:cancel')
		const output = await view.getInput()
		expect(output).toBe(undefined)
		expect(view.confirm).not.toHaveBeenCalled()
		expect(view.destroy).toHaveBeenCalled()
	})

	it('title', async () => {
		const view = new InputView({ title: 'title' })
		expect(view.element.querySelector('.input-view-title').textContent).toBe('title')
	})

	it('detail', async () => {
		const view = new InputView({ detail: 'detail' })
		expect(view.element.querySelector('.input-view-detail').innerHTML).toBe('<p>detail</p>\n')
	})

	it('placeholder', async () => {
		const view = new InputView({ placeholder: 'placeholder' })
		expect(view.editor.placeholderText).toBe('placeholder')
	})

	it('value', async () => {
		const view = new InputView({ value: 'value' })
		expect(view.editor.getText()).toBe('value')
	})
})
