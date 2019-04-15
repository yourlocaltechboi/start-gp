(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');
const md5 = require('blueimp-md5');
const moment = require('moment');

components.register('commit', args => new CommitViewModel(args));

class CommitViewModel {
  constructor(gitNode) {
    this.repoPath = gitNode.graph.repoPath;
    this.sha1 = gitNode.sha1;
    this.server = gitNode.graph.server;
    this.highlighted = gitNode.highlighted;
    this.nodeIsMousehover = gitNode.nodeIsMousehover;
    this.selected = gitNode.selected;
    this.pgpVerifiedString = gitNode.pgpVerifiedString;
    this.element = ko.observable();
    this.commitTime = ko.observable();
    this.authorTime = ko.observable();
    this.message = ko.observable();
    this.title = ko.observable();
    this.body = ko.observable();
    this.authorDate = ko.observable(0);
    this.authorDateFromNow = ko.observable();
    this.authorName = ko.observable();
    this.authorEmail = ko.observable();
    this.fileLineDiffs = ko.observable();
    this.numberOfAddedLines = ko.observable();
    this.numberOfRemovedLines = ko.observable();
    this.authorGravatar = ko.computed(() => md5((this.authorEmail() || "").trim().toLowerCase()));

    this.showCommitDiff = ko.computed(() => this.fileLineDiffs() && this.fileLineDiffs().length > 0);

    this.diffStyle = ko.computed(() => {
      const marginLeft = Math.min((gitNode.branchOrder() * 70), 450) * -1;
      if (this.selected() && this.element()) return { "margin-left": `${marginLeft}px`, width: `${window.innerWidth - 220}px` };
      else return {};
    });
  }

  updateNode(parentElement) {
    ko.renderTemplate('commit', this, {}, parentElement);
  }

  setData(args) {
    this.commitTime(moment(new Date(args.commitDate)));
    this.authorTime(moment(new Date(args.authorDate)));
    const message = args.message.split('\n');
    this.message(args.message);
    this.title(message[0]);
    this.body(message.slice((message[1] ? 1 : 2)).join('\n'));
    this.authorDate(moment(new Date(args.authorDate)));
    this.authorDateFromNow(this.authorDate().fromNow());
    this.authorName(args.authorName);
    this.authorEmail(args.authorEmail);
    this.numberOfAddedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][0] : 0);
    this.numberOfRemovedLines(args.fileLineDiffs.length > 0 ? args.fileLineDiffs[0][1] : 0);
    this.fileLineDiffs(args.fileLineDiffs);
    this.isInited = true;
    this.commitDiff = ko.observable(components.create('commitDiff', {
      fileLineDiffs: this.fileLineDiffs(),
      sha1: this.sha1,
      repoPath: this.repoPath,
      server: this.server
    }));
  }

  updateLastAuthorDateFromNow(deltaT) {
    this.lastUpdatedAuthorDateFromNow = this.lastUpdatedAuthorDateFromNow || 0;
    this.lastUpdatedAuthorDateFromNow += deltaT;
    if(this.lastUpdatedAuthorDateFromNow > 60 * 1000) {
      this.lastUpdatedAuthorDateFromNow = 0;
      this.authorDateFromNow(this.authorDate().fromNow());
    }
  }

  updateAnimationFrame(deltaT) {
    this.updateLastAuthorDateFromNow(deltaT);
  }

  stopClickPropagation(data, event) {
    event.stopImmediatePropagation();
  }
}

},{"blueimp-md5":"blueimp-md5","knockout":"knockout","moment":"moment","ungit-components":"ungit-components","ungit-navigation":"ungit-navigation","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2NvbW1pdC9jb21taXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgY29tcG9uZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LWNvbXBvbmVudHMnKTtcbmNvbnN0IG5hdmlnYXRpb24gPSByZXF1aXJlKCd1bmdpdC1uYXZpZ2F0aW9uJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IG1kNSA9IHJlcXVpcmUoJ2JsdWVpbXAtbWQ1Jyk7XG5jb25zdCBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcblxuY29tcG9uZW50cy5yZWdpc3RlcignY29tbWl0JywgYXJncyA9PiBuZXcgQ29tbWl0Vmlld01vZGVsKGFyZ3MpKTtcblxuY2xhc3MgQ29tbWl0Vmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IoZ2l0Tm9kZSkge1xuICAgIHRoaXMucmVwb1BhdGggPSBnaXROb2RlLmdyYXBoLnJlcG9QYXRoO1xuICAgIHRoaXMuc2hhMSA9IGdpdE5vZGUuc2hhMTtcbiAgICB0aGlzLnNlcnZlciA9IGdpdE5vZGUuZ3JhcGguc2VydmVyO1xuICAgIHRoaXMuaGlnaGxpZ2h0ZWQgPSBnaXROb2RlLmhpZ2hsaWdodGVkO1xuICAgIHRoaXMubm9kZUlzTW91c2Vob3ZlciA9IGdpdE5vZGUubm9kZUlzTW91c2Vob3ZlcjtcbiAgICB0aGlzLnNlbGVjdGVkID0gZ2l0Tm9kZS5zZWxlY3RlZDtcbiAgICB0aGlzLnBncFZlcmlmaWVkU3RyaW5nID0gZ2l0Tm9kZS5wZ3BWZXJpZmllZFN0cmluZztcbiAgICB0aGlzLmVsZW1lbnQgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5jb21taXRUaW1lID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuYXV0aG9yVGltZSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLm1lc3NhZ2UgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy50aXRsZSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmJvZHkgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5hdXRob3JEYXRlID0ga28ub2JzZXJ2YWJsZSgwKTtcbiAgICB0aGlzLmF1dGhvckRhdGVGcm9tTm93ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuYXV0aG9yTmFtZSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmF1dGhvckVtYWlsID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuZmlsZUxpbmVEaWZmcyA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLm51bWJlck9mQWRkZWRMaW5lcyA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLm51bWJlck9mUmVtb3ZlZExpbmVzID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuYXV0aG9yR3JhdmF0YXIgPSBrby5jb21wdXRlZCgoKSA9PiBtZDUoKHRoaXMuYXV0aG9yRW1haWwoKSB8fCBcIlwiKS50cmltKCkudG9Mb3dlckNhc2UoKSkpO1xuXG4gICAgdGhpcy5zaG93Q29tbWl0RGlmZiA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuZmlsZUxpbmVEaWZmcygpICYmIHRoaXMuZmlsZUxpbmVEaWZmcygpLmxlbmd0aCA+IDApO1xuXG4gICAgdGhpcy5kaWZmU3R5bGUgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBjb25zdCBtYXJnaW5MZWZ0ID0gTWF0aC5taW4oKGdpdE5vZGUuYnJhbmNoT3JkZXIoKSAqIDcwKSwgNDUwKSAqIC0xO1xuICAgICAgaWYgKHRoaXMuc2VsZWN0ZWQoKSAmJiB0aGlzLmVsZW1lbnQoKSkgcmV0dXJuIHsgXCJtYXJnaW4tbGVmdFwiOiBgJHttYXJnaW5MZWZ0fXB4YCwgd2lkdGg6IGAke3dpbmRvdy5pbm5lcldpZHRoIC0gMjIwfXB4YCB9O1xuICAgICAgZWxzZSByZXR1cm4ge307XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnY29tbWl0JywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgc2V0RGF0YShhcmdzKSB7XG4gICAgdGhpcy5jb21taXRUaW1lKG1vbWVudChuZXcgRGF0ZShhcmdzLmNvbW1pdERhdGUpKSk7XG4gICAgdGhpcy5hdXRob3JUaW1lKG1vbWVudChuZXcgRGF0ZShhcmdzLmF1dGhvckRhdGUpKSk7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3MubWVzc2FnZS5zcGxpdCgnXFxuJyk7XG4gICAgdGhpcy5tZXNzYWdlKGFyZ3MubWVzc2FnZSk7XG4gICAgdGhpcy50aXRsZShtZXNzYWdlWzBdKTtcbiAgICB0aGlzLmJvZHkobWVzc2FnZS5zbGljZSgobWVzc2FnZVsxXSA/IDEgOiAyKSkuam9pbignXFxuJykpO1xuICAgIHRoaXMuYXV0aG9yRGF0ZShtb21lbnQobmV3IERhdGUoYXJncy5hdXRob3JEYXRlKSkpO1xuICAgIHRoaXMuYXV0aG9yRGF0ZUZyb21Ob3codGhpcy5hdXRob3JEYXRlKCkuZnJvbU5vdygpKTtcbiAgICB0aGlzLmF1dGhvck5hbWUoYXJncy5hdXRob3JOYW1lKTtcbiAgICB0aGlzLmF1dGhvckVtYWlsKGFyZ3MuYXV0aG9yRW1haWwpO1xuICAgIHRoaXMubnVtYmVyT2ZBZGRlZExpbmVzKGFyZ3MuZmlsZUxpbmVEaWZmcy5sZW5ndGggPiAwID8gYXJncy5maWxlTGluZURpZmZzWzBdWzBdIDogMCk7XG4gICAgdGhpcy5udW1iZXJPZlJlbW92ZWRMaW5lcyhhcmdzLmZpbGVMaW5lRGlmZnMubGVuZ3RoID4gMCA/IGFyZ3MuZmlsZUxpbmVEaWZmc1swXVsxXSA6IDApO1xuICAgIHRoaXMuZmlsZUxpbmVEaWZmcyhhcmdzLmZpbGVMaW5lRGlmZnMpO1xuICAgIHRoaXMuaXNJbml0ZWQgPSB0cnVlO1xuICAgIHRoaXMuY29tbWl0RGlmZiA9IGtvLm9ic2VydmFibGUoY29tcG9uZW50cy5jcmVhdGUoJ2NvbW1pdERpZmYnLCB7XG4gICAgICBmaWxlTGluZURpZmZzOiB0aGlzLmZpbGVMaW5lRGlmZnMoKSxcbiAgICAgIHNoYTE6IHRoaXMuc2hhMSxcbiAgICAgIHJlcG9QYXRoOiB0aGlzLnJlcG9QYXRoLFxuICAgICAgc2VydmVyOiB0aGlzLnNlcnZlclxuICAgIH0pKTtcbiAgfVxuXG4gIHVwZGF0ZUxhc3RBdXRob3JEYXRlRnJvbU5vdyhkZWx0YVQpIHtcbiAgICB0aGlzLmxhc3RVcGRhdGVkQXV0aG9yRGF0ZUZyb21Ob3cgPSB0aGlzLmxhc3RVcGRhdGVkQXV0aG9yRGF0ZUZyb21Ob3cgfHwgMDtcbiAgICB0aGlzLmxhc3RVcGRhdGVkQXV0aG9yRGF0ZUZyb21Ob3cgKz0gZGVsdGFUO1xuICAgIGlmKHRoaXMubGFzdFVwZGF0ZWRBdXRob3JEYXRlRnJvbU5vdyA+IDYwICogMTAwMCkge1xuICAgICAgdGhpcy5sYXN0VXBkYXRlZEF1dGhvckRhdGVGcm9tTm93ID0gMDtcbiAgICAgIHRoaXMuYXV0aG9yRGF0ZUZyb21Ob3codGhpcy5hdXRob3JEYXRlKCkuZnJvbU5vdygpKTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVBbmltYXRpb25GcmFtZShkZWx0YVQpIHtcbiAgICB0aGlzLnVwZGF0ZUxhc3RBdXRob3JEYXRlRnJvbU5vdyhkZWx0YVQpO1xuICB9XG5cbiAgc3RvcENsaWNrUHJvcGFnYXRpb24oZGF0YSwgZXZlbnQpIHtcbiAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgfVxufVxuIl19
