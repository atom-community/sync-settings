const InputView = require('../lib/input-view')

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

	it('title', () => {
		const view = new InputView({ title: 'title' })
		expect(view.element.querySelector('.input-view-title').textContent).toBe('title')
		view.resolve()
	})

	it('detail', () => {
		const view = new InputView({ detail: 'detail' })
		expect(view.element.querySelector('.input-view-detail').innerHTML).toBe('<p>detail</p>\n')
		view.resolve()
	})

	it('placeholder', () => {
		const view = new InputView({ placeholder: 'placeholder' })
		expect(view.editor.placeholderText).toBe('placeholder')
		view.resolve()
	})

	it('value', async () => {
		const view = new InputView({ value: 'value' })
		view.confirm()
		const output = await view.getInput()
		expect(output).toBe('value')
	})
})
