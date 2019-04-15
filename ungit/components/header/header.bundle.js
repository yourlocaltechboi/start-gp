(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');

components.register('header', args => new HeaderViewModel(args.app));

class HeaderViewModel {
  constructor(app) {
    this.app = app;
    this.showBackButton = ko.observable(false);
    this.path = ko.observable();
    this.currentVersion = ungit.version;
    this.refreshButton = components.create('refreshbutton');
    this.showAddToRepoListButton = ko.computed(() => this.path() && !this.app.repoList().includes(this.path()));
  }

  updateNode(parentElement) {
    ko.renderTemplate('header', this, {}, parentElement);
  }

  submitPath() {
    navigation.browseTo(`repository?path=${encodeURIComponent(this.path())}`);
  }

  onProgramEvent(event) {
    if (event.event == 'navigation-changed') {
      this.showBackButton(event.path != '');
      if (event.path == '') this.path('');
    } else if (event.event == 'navigated-to-path') {
      this.path(event.path);
    }
  }

  addCurrentPathToRepoList() {
    programEvents.dispatch({ event: 'request-remember-repo', repoPath: this.path() });
    return true;
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-navigation":"ungit-navigation","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2hlYWRlci9oZWFkZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiXG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuY29uc3QgbmF2aWdhdGlvbiA9IHJlcXVpcmUoJ3VuZ2l0LW5hdmlnYXRpb24nKTtcbmNvbnN0IHByb2dyYW1FdmVudHMgPSByZXF1aXJlKCd1bmdpdC1wcm9ncmFtLWV2ZW50cycpO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdoZWFkZXInLCBhcmdzID0+IG5ldyBIZWFkZXJWaWV3TW9kZWwoYXJncy5hcHApKTtcblxuY2xhc3MgSGVhZGVyVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5zaG93QmFja0J1dHRvbiA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMucGF0aCA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmN1cnJlbnRWZXJzaW9uID0gdW5naXQudmVyc2lvbjtcbiAgICB0aGlzLnJlZnJlc2hCdXR0b24gPSBjb21wb25lbnRzLmNyZWF0ZSgncmVmcmVzaGJ1dHRvbicpO1xuICAgIHRoaXMuc2hvd0FkZFRvUmVwb0xpc3RCdXR0b24gPSBrby5jb21wdXRlZCgoKSA9PiB0aGlzLnBhdGgoKSAmJiAhdGhpcy5hcHAucmVwb0xpc3QoKS5pbmNsdWRlcyh0aGlzLnBhdGgoKSkpO1xuICB9XG5cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7XG4gICAga28ucmVuZGVyVGVtcGxhdGUoJ2hlYWRlcicsIHRoaXMsIHt9LCBwYXJlbnRFbGVtZW50KTtcbiAgfVxuXG4gIHN1Ym1pdFBhdGgoKSB7XG4gICAgbmF2aWdhdGlvbi5icm93c2VUbyhgcmVwb3NpdG9yeT9wYXRoPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMucGF0aCgpKX1gKTtcbiAgfVxuXG4gIG9uUHJvZ3JhbUV2ZW50KGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmV2ZW50ID09ICduYXZpZ2F0aW9uLWNoYW5nZWQnKSB7XG4gICAgICB0aGlzLnNob3dCYWNrQnV0dG9uKGV2ZW50LnBhdGggIT0gJycpO1xuICAgICAgaWYgKGV2ZW50LnBhdGggPT0gJycpIHRoaXMucGF0aCgnJyk7XG4gICAgfSBlbHNlIGlmIChldmVudC5ldmVudCA9PSAnbmF2aWdhdGVkLXRvLXBhdGgnKSB7XG4gICAgICB0aGlzLnBhdGgoZXZlbnQucGF0aCk7XG4gICAgfVxuICB9XG5cbiAgYWRkQ3VycmVudFBhdGhUb1JlcG9MaXN0KCkge1xuICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlcXVlc3QtcmVtZW1iZXItcmVwbycsIHJlcG9QYXRoOiB0aGlzLnBhdGgoKSB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIl19
