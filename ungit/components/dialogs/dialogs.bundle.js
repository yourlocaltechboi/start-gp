(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const inherits = require('util').inherits;
const components = require('ungit-components');
const Bluebird = require('bluebird');
const programEvents = require('ungit-program-events');

components.register('formdialog', args => new FormDialogViewModel(args.title));
components.register('credentialsdialog', args => new CredentialsDialogViewModel({remote: args.remote}));
components.register('addremotedialog', args => new AddRemoteDialogViewModel());
components.register('addsubmoduledialog', args => new AddSubmoduleDialogViewModel());
components.register('promptdialog', args => new PromptDialogViewModel(args.title, args.details));
components.register('yesnodialog', args => new YesNoDialogViewModel(args.title, args.details));
components.register('yesnomutedialog', args => new YesNoMuteDialogViewModel(args.title, args.details));
components.register('toomanyfilesdialogviewmodel', args => new TooManyFilesDialogViewModel(args.title, args.details));
components.register('texteditdialog', args => new TextEditDialog(args.title, args.content));

class DialogViewModel {
  constructor(title) {
    this.onclose = null;
    this.title = ko.observable(title);
    this.taDialogName = ko.observable('');
    this.closePromise = new Bluebird(resolve => {
      this.onclose = resolve;
    });
  }

  closeThen(thenFunc) {
    this.closePromise = this.closePromise.then(thenFunc);
    return this;
  }

  setCloser(closer) {
    this.closer = closer;
  }

  close() {
    this.closer();
  }

  show() {
    programEvents.dispatch({ event: 'request-show-dialog', dialog: this });
    return this;
  }
}

class FormDialogViewModel extends DialogViewModel {
  constructor(title) {
    super(title);
    this.items = ko.observable([]);
    this.isSubmitted = ko.observable(false);
    this.showCancel = ko.observable(true);
  }

  get template() { return 'formDialog'; }

  submit() {
    this.isSubmitted(true);
    this.close();
  }
}

class CredentialsDialogViewModel extends FormDialogViewModel {
  constructor(args) {
    super(`Remote ${args.remote} requires authentication`);
    this.taDialogName('credentials-dialog');
    this.showCancel(false);
    this.username = ko.observable();
    this.password = ko.observable();
    const self = this;
    this.items([
      { name: 'Username', value: self.username, placeholder: 'Username', type: 'text', autofocus: true, taName: 'username' },
      { name: 'Password', value: self.password, placeholder: 'Password', type: 'password', autofocus: false, taName: 'password' }
    ]);
  }
}

class AddRemoteDialogViewModel extends FormDialogViewModel {
  constructor() {
    super('Add new remote');
    this.taDialogName('add-remote');
    this.name = ko.observable();
    this.url = ko.observable();
    const self = this;
    this.items([
      { name: 'Name', value: self.name, placeholder: 'Name', type: 'text', autofocus: true, taName: 'name' },
      { name: 'Url', value: self.url, placeholder: 'Url', type: 'text', autofocus: false, taName: 'url' }
    ]);
  }
}

class AddSubmoduleDialogViewModel extends FormDialogViewModel {
  constructor() {
    super('Add new submodule');
    this.taDialogName('add-submodule');
    this.path = ko.observable();
    this.url = ko.observable();
    const self = this;
    this.items([
      { name: 'Path', value: self.path, placeholder: 'Path', type: 'text', autofocus: true, taName: 'path' },
      { name: 'Url', value: self.url, placeholder: 'Url', type: 'text', autofocus: false, taName: 'url' }
    ]);
  }
}

class PromptDialogViewModel extends DialogViewModel {
  constructor(title, details) {
    super(title);
    this.alternatives = ko.observable();
    this.details = ko.observable(details);
  }

  get template() { return 'prompt'; }
}

class YesNoDialogViewModel extends PromptDialogViewModel {
  constructor(title, details) {
    super(title, details);
    this.taDialogName('yes-no-dialog');
    this.result = ko.observable(false);
    const self = this;
    this.alternatives([
      { label: 'Yes', primary: true, taId: 'yes', click() { self.result(true); self.close(); } },
      { label: 'No', primary: false, taId: 'no', click() { self.result(false); self.close(); } },
    ]);
  }
}

class YesNoMuteDialogViewModel extends PromptDialogViewModel {
  constructor(title, details) {
    super(title, details);
    this.taDialogName('yes-no-mute-dialog');
    this.result = ko.observable(false);
    const self = this;
    this.alternatives([
      { label: 'Yes', primary: true, taId: 'yes', click() { self.result(true); self.close(); } },
      { label: 'Yes and mute for awhile', primary: false, taId: 'mute', click() { self.result("mute"); self.close() } },
      { label: 'No', primary: false, taId: 'no', click() { self.result(false); self.close(); } }
    ]);
  }
}

class TooManyFilesDialogViewModel extends PromptDialogViewModel {
  constructor(title, details) {
    super(title, details);
    this.taDialogName('yes-no-dialog');
    this.result = ko.observable(false);
    const self = this;
    this.alternatives([
      { label: "Don't load", primary: true, taId: 'noLoad', click() { self.result(false); self.close(); } },
      { label: 'Load anyway', primary: false, taId: 'loadAnyway', click() { self.result(true); self.close(); } },
    ]);
  }
}

class TextEditDialog extends PromptDialogViewModel {
  constructor(title, content) {
    super(title, `<textarea class="text-area-content" rows="30" cols="75" style="height:250px;width: 100%">${content}</textarea>`);
    this.taDialogName('text-edit-dialog');
    this.result = ko.observable(false);
    const self = this;
    this.alternatives([
      {
        label: "Save", primary: true, taId: 'save', click() {
          self.textAreaContent = document.querySelector('.modal-body .text-area-content').value;
          self.result(true);
          self.close();
        }
      },
      { label: 'Cancel', primary: false, taId: 'cancel', click() { self.result(false); self.close(); } },
    ]);
  }
}

},{"bluebird":undefined,"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events","util":undefined}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2RpYWxvZ3MvZGlhbG9ncy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgaW5oZXJpdHMgPSByZXF1aXJlKCd1dGlsJykuaW5oZXJpdHM7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuY29uc3QgQmx1ZWJpcmQgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgcHJvZ3JhbUV2ZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LXByb2dyYW0tZXZlbnRzJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2Zvcm1kaWFsb2cnLCBhcmdzID0+IG5ldyBGb3JtRGlhbG9nVmlld01vZGVsKGFyZ3MudGl0bGUpKTtcbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2NyZWRlbnRpYWxzZGlhbG9nJywgYXJncyA9PiBuZXcgQ3JlZGVudGlhbHNEaWFsb2dWaWV3TW9kZWwoe3JlbW90ZTogYXJncy5yZW1vdGV9KSk7XG5jb21wb25lbnRzLnJlZ2lzdGVyKCdhZGRyZW1vdGVkaWFsb2cnLCBhcmdzID0+IG5ldyBBZGRSZW1vdGVEaWFsb2dWaWV3TW9kZWwoKSk7XG5jb21wb25lbnRzLnJlZ2lzdGVyKCdhZGRzdWJtb2R1bGVkaWFsb2cnLCBhcmdzID0+IG5ldyBBZGRTdWJtb2R1bGVEaWFsb2dWaWV3TW9kZWwoKSk7XG5jb21wb25lbnRzLnJlZ2lzdGVyKCdwcm9tcHRkaWFsb2cnLCBhcmdzID0+IG5ldyBQcm9tcHREaWFsb2dWaWV3TW9kZWwoYXJncy50aXRsZSwgYXJncy5kZXRhaWxzKSk7XG5jb21wb25lbnRzLnJlZ2lzdGVyKCd5ZXNub2RpYWxvZycsIGFyZ3MgPT4gbmV3IFllc05vRGlhbG9nVmlld01vZGVsKGFyZ3MudGl0bGUsIGFyZ3MuZGV0YWlscykpO1xuY29tcG9uZW50cy5yZWdpc3RlcigneWVzbm9tdXRlZGlhbG9nJywgYXJncyA9PiBuZXcgWWVzTm9NdXRlRGlhbG9nVmlld01vZGVsKGFyZ3MudGl0bGUsIGFyZ3MuZGV0YWlscykpO1xuY29tcG9uZW50cy5yZWdpc3RlcigndG9vbWFueWZpbGVzZGlhbG9ndmlld21vZGVsJywgYXJncyA9PiBuZXcgVG9vTWFueUZpbGVzRGlhbG9nVmlld01vZGVsKGFyZ3MudGl0bGUsIGFyZ3MuZGV0YWlscykpO1xuY29tcG9uZW50cy5yZWdpc3RlcigndGV4dGVkaXRkaWFsb2cnLCBhcmdzID0+IG5ldyBUZXh0RWRpdERpYWxvZyhhcmdzLnRpdGxlLCBhcmdzLmNvbnRlbnQpKTtcblxuY2xhc3MgRGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IodGl0bGUpIHtcbiAgICB0aGlzLm9uY2xvc2UgPSBudWxsO1xuICAgIHRoaXMudGl0bGUgPSBrby5vYnNlcnZhYmxlKHRpdGxlKTtcbiAgICB0aGlzLnRhRGlhbG9nTmFtZSA9IGtvLm9ic2VydmFibGUoJycpO1xuICAgIHRoaXMuY2xvc2VQcm9taXNlID0gbmV3IEJsdWViaXJkKHJlc29sdmUgPT4ge1xuICAgICAgdGhpcy5vbmNsb3NlID0gcmVzb2x2ZTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsb3NlVGhlbih0aGVuRnVuYykge1xuICAgIHRoaXMuY2xvc2VQcm9taXNlID0gdGhpcy5jbG9zZVByb21pc2UudGhlbih0aGVuRnVuYyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRDbG9zZXIoY2xvc2VyKSB7XG4gICAgdGhpcy5jbG9zZXIgPSBjbG9zZXI7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICB0aGlzLmNsb3NlcigpO1xuICB9XG5cbiAgc2hvdygpIHtcbiAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdyZXF1ZXN0LXNob3ctZGlhbG9nJywgZGlhbG9nOiB0aGlzIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG59XG5cbmNsYXNzIEZvcm1EaWFsb2dWaWV3TW9kZWwgZXh0ZW5kcyBEaWFsb2dWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3Rvcih0aXRsZSkge1xuICAgIHN1cGVyKHRpdGxlKTtcbiAgICB0aGlzLml0ZW1zID0ga28ub2JzZXJ2YWJsZShbXSk7XG4gICAgdGhpcy5pc1N1Ym1pdHRlZCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMuc2hvd0NhbmNlbCA9IGtvLm9ic2VydmFibGUodHJ1ZSk7XG4gIH1cblxuICBnZXQgdGVtcGxhdGUoKSB7IHJldHVybiAnZm9ybURpYWxvZyc7IH1cblxuICBzdWJtaXQoKSB7XG4gICAgdGhpcy5pc1N1Ym1pdHRlZCh0cnVlKTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cbn1cblxuY2xhc3MgQ3JlZGVudGlhbHNEaWFsb2dWaWV3TW9kZWwgZXh0ZW5kcyBGb3JtRGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IoYXJncykge1xuICAgIHN1cGVyKGBSZW1vdGUgJHthcmdzLnJlbW90ZX0gcmVxdWlyZXMgYXV0aGVudGljYXRpb25gKTtcbiAgICB0aGlzLnRhRGlhbG9nTmFtZSgnY3JlZGVudGlhbHMtZGlhbG9nJyk7XG4gICAgdGhpcy5zaG93Q2FuY2VsKGZhbHNlKTtcbiAgICB0aGlzLnVzZXJuYW1lID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMucGFzc3dvcmQgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5pdGVtcyhbXG4gICAgICB7IG5hbWU6ICdVc2VybmFtZScsIHZhbHVlOiBzZWxmLnVzZXJuYW1lLCBwbGFjZWhvbGRlcjogJ1VzZXJuYW1lJywgdHlwZTogJ3RleHQnLCBhdXRvZm9jdXM6IHRydWUsIHRhTmFtZTogJ3VzZXJuYW1lJyB9LFxuICAgICAgeyBuYW1lOiAnUGFzc3dvcmQnLCB2YWx1ZTogc2VsZi5wYXNzd29yZCwgcGxhY2Vob2xkZXI6ICdQYXNzd29yZCcsIHR5cGU6ICdwYXNzd29yZCcsIGF1dG9mb2N1czogZmFsc2UsIHRhTmFtZTogJ3Bhc3N3b3JkJyB9XG4gICAgXSk7XG4gIH1cbn1cblxuY2xhc3MgQWRkUmVtb3RlRGlhbG9nVmlld01vZGVsIGV4dGVuZHMgRm9ybURpYWxvZ1ZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCdBZGQgbmV3IHJlbW90ZScpO1xuICAgIHRoaXMudGFEaWFsb2dOYW1lKCdhZGQtcmVtb3RlJyk7XG4gICAgdGhpcy5uYW1lID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMudXJsID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuaXRlbXMoW1xuICAgICAgeyBuYW1lOiAnTmFtZScsIHZhbHVlOiBzZWxmLm5hbWUsIHBsYWNlaG9sZGVyOiAnTmFtZScsIHR5cGU6ICd0ZXh0JywgYXV0b2ZvY3VzOiB0cnVlLCB0YU5hbWU6ICduYW1lJyB9LFxuICAgICAgeyBuYW1lOiAnVXJsJywgdmFsdWU6IHNlbGYudXJsLCBwbGFjZWhvbGRlcjogJ1VybCcsIHR5cGU6ICd0ZXh0JywgYXV0b2ZvY3VzOiBmYWxzZSwgdGFOYW1lOiAndXJsJyB9XG4gICAgXSk7XG4gIH1cbn1cblxuY2xhc3MgQWRkU3VibW9kdWxlRGlhbG9nVmlld01vZGVsIGV4dGVuZHMgRm9ybURpYWxvZ1ZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCdBZGQgbmV3IHN1Ym1vZHVsZScpO1xuICAgIHRoaXMudGFEaWFsb2dOYW1lKCdhZGQtc3VibW9kdWxlJyk7XG4gICAgdGhpcy5wYXRoID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMudXJsID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuaXRlbXMoW1xuICAgICAgeyBuYW1lOiAnUGF0aCcsIHZhbHVlOiBzZWxmLnBhdGgsIHBsYWNlaG9sZGVyOiAnUGF0aCcsIHR5cGU6ICd0ZXh0JywgYXV0b2ZvY3VzOiB0cnVlLCB0YU5hbWU6ICdwYXRoJyB9LFxuICAgICAgeyBuYW1lOiAnVXJsJywgdmFsdWU6IHNlbGYudXJsLCBwbGFjZWhvbGRlcjogJ1VybCcsIHR5cGU6ICd0ZXh0JywgYXV0b2ZvY3VzOiBmYWxzZSwgdGFOYW1lOiAndXJsJyB9XG4gICAgXSk7XG4gIH1cbn1cblxuY2xhc3MgUHJvbXB0RGlhbG9nVmlld01vZGVsIGV4dGVuZHMgRGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IodGl0bGUsIGRldGFpbHMpIHtcbiAgICBzdXBlcih0aXRsZSk7XG4gICAgdGhpcy5hbHRlcm5hdGl2ZXMgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5kZXRhaWxzID0ga28ub2JzZXJ2YWJsZShkZXRhaWxzKTtcbiAgfVxuXG4gIGdldCB0ZW1wbGF0ZSgpIHsgcmV0dXJuICdwcm9tcHQnOyB9XG59XG5cbmNsYXNzIFllc05vRGlhbG9nVmlld01vZGVsIGV4dGVuZHMgUHJvbXB0RGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IodGl0bGUsIGRldGFpbHMpIHtcbiAgICBzdXBlcih0aXRsZSwgZGV0YWlscyk7XG4gICAgdGhpcy50YURpYWxvZ05hbWUoJ3llcy1uby1kaWFsb2cnKTtcbiAgICB0aGlzLnJlc3VsdCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuYWx0ZXJuYXRpdmVzKFtcbiAgICAgIHsgbGFiZWw6ICdZZXMnLCBwcmltYXJ5OiB0cnVlLCB0YUlkOiAneWVzJywgY2xpY2soKSB7IHNlbGYucmVzdWx0KHRydWUpOyBzZWxmLmNsb3NlKCk7IH0gfSxcbiAgICAgIHsgbGFiZWw6ICdObycsIHByaW1hcnk6IGZhbHNlLCB0YUlkOiAnbm8nLCBjbGljaygpIHsgc2VsZi5yZXN1bHQoZmFsc2UpOyBzZWxmLmNsb3NlKCk7IH0gfSxcbiAgICBdKTtcbiAgfVxufVxuXG5jbGFzcyBZZXNOb011dGVEaWFsb2dWaWV3TW9kZWwgZXh0ZW5kcyBQcm9tcHREaWFsb2dWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3Rvcih0aXRsZSwgZGV0YWlscykge1xuICAgIHN1cGVyKHRpdGxlLCBkZXRhaWxzKTtcbiAgICB0aGlzLnRhRGlhbG9nTmFtZSgneWVzLW5vLW11dGUtZGlhbG9nJyk7XG4gICAgdGhpcy5yZXN1bHQgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICB0aGlzLmFsdGVybmF0aXZlcyhbXG4gICAgICB7IGxhYmVsOiAnWWVzJywgcHJpbWFyeTogdHJ1ZSwgdGFJZDogJ3llcycsIGNsaWNrKCkgeyBzZWxmLnJlc3VsdCh0cnVlKTsgc2VsZi5jbG9zZSgpOyB9IH0sXG4gICAgICB7IGxhYmVsOiAnWWVzIGFuZCBtdXRlIGZvciBhd2hpbGUnLCBwcmltYXJ5OiBmYWxzZSwgdGFJZDogJ211dGUnLCBjbGljaygpIHsgc2VsZi5yZXN1bHQoXCJtdXRlXCIpOyBzZWxmLmNsb3NlKCkgfSB9LFxuICAgICAgeyBsYWJlbDogJ05vJywgcHJpbWFyeTogZmFsc2UsIHRhSWQ6ICdubycsIGNsaWNrKCkgeyBzZWxmLnJlc3VsdChmYWxzZSk7IHNlbGYuY2xvc2UoKTsgfSB9XG4gICAgXSk7XG4gIH1cbn1cblxuY2xhc3MgVG9vTWFueUZpbGVzRGlhbG9nVmlld01vZGVsIGV4dGVuZHMgUHJvbXB0RGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IodGl0bGUsIGRldGFpbHMpIHtcbiAgICBzdXBlcih0aXRsZSwgZGV0YWlscyk7XG4gICAgdGhpcy50YURpYWxvZ05hbWUoJ3llcy1uby1kaWFsb2cnKTtcbiAgICB0aGlzLnJlc3VsdCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuYWx0ZXJuYXRpdmVzKFtcbiAgICAgIHsgbGFiZWw6IFwiRG9uJ3QgbG9hZFwiLCBwcmltYXJ5OiB0cnVlLCB0YUlkOiAnbm9Mb2FkJywgY2xpY2soKSB7IHNlbGYucmVzdWx0KGZhbHNlKTsgc2VsZi5jbG9zZSgpOyB9IH0sXG4gICAgICB7IGxhYmVsOiAnTG9hZCBhbnl3YXknLCBwcmltYXJ5OiBmYWxzZSwgdGFJZDogJ2xvYWRBbnl3YXknLCBjbGljaygpIHsgc2VsZi5yZXN1bHQodHJ1ZSk7IHNlbGYuY2xvc2UoKTsgfSB9LFxuICAgIF0pO1xuICB9XG59XG5cbmNsYXNzIFRleHRFZGl0RGlhbG9nIGV4dGVuZHMgUHJvbXB0RGlhbG9nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IodGl0bGUsIGNvbnRlbnQpIHtcbiAgICBzdXBlcih0aXRsZSwgYDx0ZXh0YXJlYSBjbGFzcz1cInRleHQtYXJlYS1jb250ZW50XCIgcm93cz1cIjMwXCIgY29scz1cIjc1XCIgc3R5bGU9XCJoZWlnaHQ6MjUwcHg7d2lkdGg6IDEwMCVcIj4ke2NvbnRlbnR9PC90ZXh0YXJlYT5gKTtcbiAgICB0aGlzLnRhRGlhbG9nTmFtZSgndGV4dC1lZGl0LWRpYWxvZycpO1xuICAgIHRoaXMucmVzdWx0ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5hbHRlcm5hdGl2ZXMoW1xuICAgICAge1xuICAgICAgICBsYWJlbDogXCJTYXZlXCIsIHByaW1hcnk6IHRydWUsIHRhSWQ6ICdzYXZlJywgY2xpY2soKSB7XG4gICAgICAgICAgc2VsZi50ZXh0QXJlYUNvbnRlbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keSAudGV4dC1hcmVhLWNvbnRlbnQnKS52YWx1ZTtcbiAgICAgICAgICBzZWxmLnJlc3VsdCh0cnVlKTtcbiAgICAgICAgICBzZWxmLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgcHJpbWFyeTogZmFsc2UsIHRhSWQ6ICdjYW5jZWwnLCBjbGljaygpIHsgc2VsZi5yZXN1bHQoZmFsc2UpOyBzZWxmLmNsb3NlKCk7IH0gfSxcbiAgICBdKTtcbiAgfVxufVxuIl19
