(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const ko = require('knockout');
const CommitLineDiff = require('./commitlinediff.js').CommitLineDiff;
const components = require('ungit-components');

components.register('commitDiff', args => new CommitDiff(args));

class CommitDiff {
  constructor(args) {
    this.commitLineDiffs = ko.observableArray();
    this.sha1 = args.sha1;

    // parent components can provide their own buttons (e.g. staging component)
    this.showDiffButtons = ko.observable(!args.textDiffType);
    this.textDiffType = args.textDiffType = args.textDiffType || components.create('textdiff.type');
    this.wordWrap = args.wordWrap = args.wordWrap || components.create('textdiff.wordwrap');
    this.whiteSpace = args.whiteSpace = args.whiteSpace || components.create('textdiff.whitespace');

    args.fileLineDiffs.shift();  // remove first line that has "total"
    this.loadFileLineDiffs(args);
  }

  updateNode(parentElement) {
    ko.renderTemplate('commitdiff', this, {}, parentElement);
  }

  loadFileLineDiffs(args) {
    const tempCommitLineDiffs = [];
    const lineDiffLength = this.commitLineDiffs().length;

    args.fileLineDiffs.slice(lineDiffLength === 0 ? 0 : lineDiffLength + 1, this.maxNumberOfFilesShown).forEach(fileLineDiff => {
      tempCommitLineDiffs.push(new CommitLineDiff(args, fileLineDiff));
    });

    this.commitLineDiffs(this.commitLineDiffs().concat(tempCommitLineDiffs));
  }
}

},{"./commitlinediff.js":2,"knockout":"knockout","ungit-components":"ungit-components"}],2:[function(require,module,exports){
const ko = require('knockout');
const components = require('ungit-components');
const inherits = require('util').inherits;
const programEvents = require('ungit-program-events');

class CommitLineDiff {
  constructor(args, fileLineDiff) {
    this.added = ko.observable(fileLineDiff[0]);
    this.removed = ko.observable(fileLineDiff[1]);
    this.fileName = ko.observable(fileLineDiff[2]);
    this.fileType = fileLineDiff[3];
    this.isShowingDiffs = ko.observable(false);
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = args.sha1;
    this.textDiffType = args.textDiffType;
    this.wordWrap = args.wordWrap;
    this.whiteSpace = args.whiteSpace;
    this.specificDiff = ko.observable(this.getSpecificDiff());
  }

  getSpecificDiff() {
    return components.create(`${this.fileType}diff`, {
      filename: this.fileName(),
      repoPath: this.repoPath,
      server: this.server,
      sha1: this.sha1,
      textDiffType: this.textDiffType,
      isShowingDiffs: this.isShowingDiffs,
      whiteSpace: this.whiteSpace,
      wordWrap: this.wordWrap
    });
  }

  fileNameClick() {
    this.isShowingDiffs(!this.isShowingDiffs());
    programEvents.dispatch({ event: 'graph-render' });
  }
}

exports.CommitLineDiff = CommitLineDiff;

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events","util":undefined}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2NvbW1pdGRpZmYvY29tbWl0ZGlmZi5qcyIsImNvbXBvbmVudHMvY29tbWl0ZGlmZi9jb21taXRsaW5lZGlmZi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJjb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBDb21taXRMaW5lRGlmZiA9IHJlcXVpcmUoJy4vY29tbWl0bGluZWRpZmYuanMnKS5Db21taXRMaW5lRGlmZjtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2NvbW1pdERpZmYnLCBhcmdzID0+IG5ldyBDb21taXREaWZmKGFyZ3MpKTtcblxuY2xhc3MgQ29tbWl0RGlmZiB7XG4gIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICB0aGlzLmNvbW1pdExpbmVEaWZmcyA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuICAgIHRoaXMuc2hhMSA9IGFyZ3Muc2hhMTtcblxuICAgIC8vIHBhcmVudCBjb21wb25lbnRzIGNhbiBwcm92aWRlIHRoZWlyIG93biBidXR0b25zIChlLmcuIHN0YWdpbmcgY29tcG9uZW50KVxuICAgIHRoaXMuc2hvd0RpZmZCdXR0b25zID0ga28ub2JzZXJ2YWJsZSghYXJncy50ZXh0RGlmZlR5cGUpO1xuICAgIHRoaXMudGV4dERpZmZUeXBlID0gYXJncy50ZXh0RGlmZlR5cGUgPSBhcmdzLnRleHREaWZmVHlwZSB8fCBjb21wb25lbnRzLmNyZWF0ZSgndGV4dGRpZmYudHlwZScpO1xuICAgIHRoaXMud29yZFdyYXAgPSBhcmdzLndvcmRXcmFwID0gYXJncy53b3JkV3JhcCB8fCBjb21wb25lbnRzLmNyZWF0ZSgndGV4dGRpZmYud29yZHdyYXAnKTtcbiAgICB0aGlzLndoaXRlU3BhY2UgPSBhcmdzLndoaXRlU3BhY2UgPSBhcmdzLndoaXRlU3BhY2UgfHwgY29tcG9uZW50cy5jcmVhdGUoJ3RleHRkaWZmLndoaXRlc3BhY2UnKTtcblxuICAgIGFyZ3MuZmlsZUxpbmVEaWZmcy5zaGlmdCgpOyAgLy8gcmVtb3ZlIGZpcnN0IGxpbmUgdGhhdCBoYXMgXCJ0b3RhbFwiXG4gICAgdGhpcy5sb2FkRmlsZUxpbmVEaWZmcyhhcmdzKTtcbiAgfVxuXG4gIHVwZGF0ZU5vZGUocGFyZW50RWxlbWVudCkge1xuICAgIGtvLnJlbmRlclRlbXBsYXRlKCdjb21taXRkaWZmJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgbG9hZEZpbGVMaW5lRGlmZnMoYXJncykge1xuICAgIGNvbnN0IHRlbXBDb21taXRMaW5lRGlmZnMgPSBbXTtcbiAgICBjb25zdCBsaW5lRGlmZkxlbmd0aCA9IHRoaXMuY29tbWl0TGluZURpZmZzKCkubGVuZ3RoO1xuXG4gICAgYXJncy5maWxlTGluZURpZmZzLnNsaWNlKGxpbmVEaWZmTGVuZ3RoID09PSAwID8gMCA6IGxpbmVEaWZmTGVuZ3RoICsgMSwgdGhpcy5tYXhOdW1iZXJPZkZpbGVzU2hvd24pLmZvckVhY2goZmlsZUxpbmVEaWZmID0+IHtcbiAgICAgIHRlbXBDb21taXRMaW5lRGlmZnMucHVzaChuZXcgQ29tbWl0TGluZURpZmYoYXJncywgZmlsZUxpbmVEaWZmKSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbW1pdExpbmVEaWZmcyh0aGlzLmNvbW1pdExpbmVEaWZmcygpLmNvbmNhdCh0ZW1wQ29tbWl0TGluZURpZmZzKSk7XG4gIH1cbn1cbiIsImNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBpbmhlcml0cyA9IHJlcXVpcmUoJ3V0aWwnKS5pbmhlcml0cztcbmNvbnN0IHByb2dyYW1FdmVudHMgPSByZXF1aXJlKCd1bmdpdC1wcm9ncmFtLWV2ZW50cycpO1xuXG5jbGFzcyBDb21taXRMaW5lRGlmZiB7XG4gIGNvbnN0cnVjdG9yKGFyZ3MsIGZpbGVMaW5lRGlmZikge1xuICAgIHRoaXMuYWRkZWQgPSBrby5vYnNlcnZhYmxlKGZpbGVMaW5lRGlmZlswXSk7XG4gICAgdGhpcy5yZW1vdmVkID0ga28ub2JzZXJ2YWJsZShmaWxlTGluZURpZmZbMV0pO1xuICAgIHRoaXMuZmlsZU5hbWUgPSBrby5vYnNlcnZhYmxlKGZpbGVMaW5lRGlmZlsyXSk7XG4gICAgdGhpcy5maWxlVHlwZSA9IGZpbGVMaW5lRGlmZlszXTtcbiAgICB0aGlzLmlzU2hvd2luZ0RpZmZzID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5yZXBvUGF0aCA9IGFyZ3MucmVwb1BhdGg7XG4gICAgdGhpcy5zZXJ2ZXIgPSBhcmdzLnNlcnZlcjtcbiAgICB0aGlzLnNoYTEgPSBhcmdzLnNoYTE7XG4gICAgdGhpcy50ZXh0RGlmZlR5cGUgPSBhcmdzLnRleHREaWZmVHlwZTtcbiAgICB0aGlzLndvcmRXcmFwID0gYXJncy53b3JkV3JhcDtcbiAgICB0aGlzLndoaXRlU3BhY2UgPSBhcmdzLndoaXRlU3BhY2U7XG4gICAgdGhpcy5zcGVjaWZpY0RpZmYgPSBrby5vYnNlcnZhYmxlKHRoaXMuZ2V0U3BlY2lmaWNEaWZmKCkpO1xuICB9XG5cbiAgZ2V0U3BlY2lmaWNEaWZmKCkge1xuICAgIHJldHVybiBjb21wb25lbnRzLmNyZWF0ZShgJHt0aGlzLmZpbGVUeXBlfWRpZmZgLCB7XG4gICAgICBmaWxlbmFtZTogdGhpcy5maWxlTmFtZSgpLFxuICAgICAgcmVwb1BhdGg6IHRoaXMucmVwb1BhdGgsXG4gICAgICBzZXJ2ZXI6IHRoaXMuc2VydmVyLFxuICAgICAgc2hhMTogdGhpcy5zaGExLFxuICAgICAgdGV4dERpZmZUeXBlOiB0aGlzLnRleHREaWZmVHlwZSxcbiAgICAgIGlzU2hvd2luZ0RpZmZzOiB0aGlzLmlzU2hvd2luZ0RpZmZzLFxuICAgICAgd2hpdGVTcGFjZTogdGhpcy53aGl0ZVNwYWNlLFxuICAgICAgd29yZFdyYXA6IHRoaXMud29yZFdyYXBcbiAgICB9KTtcbiAgfVxuXG4gIGZpbGVOYW1lQ2xpY2soKSB7XG4gICAgdGhpcy5pc1Nob3dpbmdEaWZmcyghdGhpcy5pc1Nob3dpbmdEaWZmcygpKTtcbiAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdncmFwaC1yZW5kZXInIH0pO1xuICB9XG59XG5cbmV4cG9ydHMuQ29tbWl0TGluZURpZmYgPSBDb21taXRMaW5lRGlmZjtcbiJdfQ==
