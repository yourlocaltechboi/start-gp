(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

components.register('refreshbutton', () => new RefreshButton());

class RefreshButton {
  refresh() {
    programEvents.dispatch({ event: 'request-app-content-refresh' });
    return true;
  }

  updateNode(parentElement) {
    ko.renderTemplate('refreshbutton', this, {}, parentElement);
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3JlZnJlc2hidXR0b24vcmVmcmVzaGJ1dHRvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgY29tcG9uZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LWNvbXBvbmVudHMnKTtcbmNvbnN0IHByb2dyYW1FdmVudHMgPSByZXF1aXJlKCd1bmdpdC1wcm9ncmFtLWV2ZW50cycpO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdyZWZyZXNoYnV0dG9uJywgKCkgPT4gbmV3IFJlZnJlc2hCdXR0b24oKSk7XG5cbmNsYXNzIFJlZnJlc2hCdXR0b24ge1xuICByZWZyZXNoKCkge1xuICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlcXVlc3QtYXBwLWNvbnRlbnQtcmVmcmVzaCcgfSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgncmVmcmVzaGJ1dHRvbicsIHRoaXMsIHt9LCBwYXJlbnRFbGVtZW50KTtcbiAgfVxufVxuIl19
