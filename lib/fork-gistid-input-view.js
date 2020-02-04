/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ForkGistIdInputView;
const {CompositeDisposable} = require('atom');
const {$, TextEditorView, View} = require('atom-space-pen-views');

let oldView = null;

module.exports =
  (ForkGistIdInputView = class ForkGistIdInputView extends View {
    static content() {
      return this.div({class: 'command-palette'}, () => {
        return this.subview('selectEditor', new TextEditorView({mini: true, placeholderText: 'Gist ID to fork'}));
      });
    }

    initialize() {
      if (oldView != null) {
        oldView.destroy();
      }
      oldView = this;

      this.disposables = new CompositeDisposable;
      this.disposables.add(atom.commands.add('atom-text-editor', 'core:confirm', () => this.confirm()));
      this.disposables.add(atom.commands.add('atom-text-editor', 'core:cancel', () => this.destroy()));
      return this.attach();
    }

    destroy() {
      this.disposables.dispose();
      return this.detach();
    }

    attach() {
      if (this.panel == null) { this.panel = atom.workspace.addModalPanel({item: this}); }
      this.panel.show();
      return this.selectEditor.focus();
    }

    detach() {
      this.panel.destroy();
      return super.detach(...arguments);
    }

    confirm() {
      const gistId = this.selectEditor.getText();
      this.callbackInstance.forkGistId(gistId);
      return this.destroy();
    }

    setCallbackInstance(callbackInstance) {
      return this.callbackInstance = callbackInstance;
    }
  });
