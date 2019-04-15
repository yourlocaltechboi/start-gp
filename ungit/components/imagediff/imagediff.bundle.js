(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');

components.register('imagediff', args => new ImageDiffViewModel(args));

class ImageDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.repoPath = args.repoPath;
    this.isNew = ko.observable(false);
    this.isRemoved = ko.observable(false);
    this.sha1 = args.sha1;
    this.state = ko.computed(() => {
      if (this.isNew()) return 'new';
      if (this.isRemoved()) return 'removed';
      return 'changed';
    });
    const gitDiffURL = `${ungit.config.rootPath}/api/diff/image?path=${encodeURIComponent(this.repoPath())}&filename=${this.filename}&version=`;
    this.oldImageSrc = gitDiffURL + (this.sha1 ? this.sha1 + '^': 'HEAD');
    this.newImageSrc = gitDiffURL + (this.sha1 ? this.sha1: 'current');
    this.isShowingDiffs = args.isShowingDiffs;
  }

  updateNode(parentElement) {
    ko.renderTemplate('imagediff', this, {}, parentElement);
  }

  invalidateDiff() {}

  newImageError() {
    this.isRemoved(true);
  }

  oldImageError() {
    this.isNew(true);
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2ltYWdlZGlmZi9pbWFnZWRpZmYuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2ltYWdlZGlmZicsIGFyZ3MgPT4gbmV3IEltYWdlRGlmZlZpZXdNb2RlbChhcmdzKSk7XG5cbmNsYXNzIEltYWdlRGlmZlZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICB0aGlzLmZpbGVuYW1lID0gYXJncy5maWxlbmFtZTtcbiAgICB0aGlzLnJlcG9QYXRoID0gYXJncy5yZXBvUGF0aDtcbiAgICB0aGlzLmlzTmV3ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5pc1JlbW92ZWQgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLnNoYTEgPSBhcmdzLnNoYTE7XG4gICAgdGhpcy5zdGF0ZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzTmV3KCkpIHJldHVybiAnbmV3JztcbiAgICAgIGlmICh0aGlzLmlzUmVtb3ZlZCgpKSByZXR1cm4gJ3JlbW92ZWQnO1xuICAgICAgcmV0dXJuICdjaGFuZ2VkJztcbiAgICB9KTtcbiAgICBjb25zdCBnaXREaWZmVVJMID0gYCR7dW5naXQuY29uZmlnLnJvb3RQYXRofS9hcGkvZGlmZi9pbWFnZT9wYXRoPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMucmVwb1BhdGgoKSl9JmZpbGVuYW1lPSR7dGhpcy5maWxlbmFtZX0mdmVyc2lvbj1gO1xuICAgIHRoaXMub2xkSW1hZ2VTcmMgPSBnaXREaWZmVVJMICsgKHRoaXMuc2hhMSA/IHRoaXMuc2hhMSArICdeJzogJ0hFQUQnKTtcbiAgICB0aGlzLm5ld0ltYWdlU3JjID0gZ2l0RGlmZlVSTCArICh0aGlzLnNoYTEgPyB0aGlzLnNoYTE6ICdjdXJyZW50Jyk7XG4gICAgdGhpcy5pc1Nob3dpbmdEaWZmcyA9IGFyZ3MuaXNTaG93aW5nRGlmZnM7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnaW1hZ2VkaWZmJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgaW52YWxpZGF0ZURpZmYoKSB7fVxuXG4gIG5ld0ltYWdlRXJyb3IoKSB7XG4gICAgdGhpcy5pc1JlbW92ZWQodHJ1ZSk7XG4gIH1cblxuICBvbGRJbWFnZUVycm9yKCkge1xuICAgIHRoaXMuaXNOZXcodHJ1ZSk7XG4gIH1cbn1cbiJdfQ==
