const ForkGistIdInputView = require('../lib/fork-gistid-input-view')
// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('ForkGistIdInputView', () => {
	let view, callbackInstance, editor

	beforeEach(() => {
		callbackInstance = {
			forkGistId: jasmine.createSpy('forkGistId'),
		}
		view = new ForkGistIdInputView(callbackInstance)
		editor = view.element.querySelector('atom-text-editor')
		spyOn(view, 'destroy').and.callThrough()
	})

	it('confirm', async () => {
		view.editor.setText('test')
		atom.commands.dispatch(editor, 'core:confirm')
		expect(callbackInstance.forkGistId).toHaveBeenCalledWith('test')
		expect(view.destroy).toHaveBeenCalled()
	})

	it('cancel', async () => {
		atom.commands.dispatch(editor, 'core:cancel')
		expect(callbackInstance.forkGistId).not.toHaveBeenCalled()
		expect(view.destroy).toHaveBeenCalled()
	})
})
