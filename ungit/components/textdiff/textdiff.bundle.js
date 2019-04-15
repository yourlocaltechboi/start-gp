(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const diff2html = require('diff2html').Diff2Html;
const programEvents = require('ungit-program-events');
const promise = require("bluebird");
const sideBySideDiff = 'sidebysidediff';
const textDiff = 'textdiff';

components.register('textdiff', args => new TextDiffViewModel(args));
components.register('textdiff.type', () => new Type());
components.register('textdiff.wordwrap', () => new WordWrap());
components.register('textdiff.whitespace', () => new WhiteSpace());

const loadLimit = 100;

class WordWrap {
  constructor() {
    this.text = ko.observable("No Wrap");
    this.value = ko.observable(false);
    this.value.subscribe(value => { this.text(value ? "Word Wrap" : "No Wrap"); });
    this.toggle = () => { this.value(!this.value()); }
    this.isActive = ko.computed(() => !!this.value());
  }
}

class Type {
  constructor() {
    this.text = ko.observable("Default");

    if (!!ungit.config.diffType && ungit.config.diffType !== 'textdiff' && ungit.config.diffType !== 'sidebysidediff') {
      ungit.config.diffType = 'textdiff';
      console.log('Config "diffType" must be either "textdiff" or "sidebysidediff".');
    }

    this.value = ko.observable(ungit.config.diffType || textDiff);
    this.value.subscribe(value => {
      this.text(value === textDiff ? "Default" : "Side By Side");
      programEvents.dispatch({ event: 'invalidate-diff-and-render' });
    });
    this.toggle = () => {
      this.value(this.value() === textDiff ? sideBySideDiff : textDiff);
    }
    this.isActive = ko.computed(() => this.value() === 'textdiff');
  }
}

class WhiteSpace {
  constructor() {
    this.text = ko.observable("Show/Ignore white space diff");
    this.value = ko.observable(ungit.config.ignoreWhiteSpaceDiff);
    this.value.subscribe(value => {
      this.text(value ? "Ignoring White Space diff" : "Showing White Space diff");
      programEvents.dispatch({ event: 'invalidate-diff-and-render' });
    });
    this.toggle = () => { this.value(!this.value()); }
    this.isActive = ko.computed(() => !this.value());
  }
}

class TextDiffViewModel {
  constructor(args) {
    this.filename = args.filename;
    this.repoPath = args.repoPath;
    this.server = args.server;
    this.sha1 = args.sha1;
    this.loadMoreCount = ko.observable(0);
    this.diffJson = null;
    this.loadCount = loadLimit;
    this.textDiffType = args.textDiffType;
    this.whiteSpace = args.whiteSpace;
    this.isShowingDiffs = args.isShowingDiffs;
    this.editState = args.editState;
    this.wordWrap = args.wordWrap;
    this.patchLineList = args.patchLineList;
    this.numberOfSelectedPatchLines = 0;
    this.htmlSrc = undefined;
    this.isParsed = ko.observable(false);

    programEvents.add(event => {
      if (event.event === "invalidate-diff-and-render" || event.event === "working-tree-changed") {
        this.invalidateDiff();
        if (this.isShowingDiffs()) this.render();
      }
    });

    this.isShowingDiffs.subscribe(newValue => {
      if (newValue) this.render();
    });

    if (this.isShowingDiffs()) { this.render(); }
  }

  updateNode(parentElement) {
    ko.renderTemplate('textdiff', this, {}, parentElement);
  }

  getDiffArguments() {
    return {
      file: this.filename,
      path: this.repoPath(),
      sha1: this.sha1 ? this.sha1 : '',
      whiteSpace: this.whiteSpace.value()
    };
  }

  invalidateDiff() {
    this.diffJson = null;
  }

  getDiffJson() {
    return this.server.getPromise('/diff', this.getDiffArguments()).then((diffs) => {
      if (typeof diffs !== 'string') {
        // Invalid value means there is no changes, show dummy diff withotu any changes
        diffs = `diff --git a/${this.filename} b/${this.filename}
                  index aaaaaaaa..bbbbbbbb 111111
                  --- a/${this.filename}
                  +++ b/${this.filename}`;
      }
      this.diffJson = diff2html.getJsonFromDiff(diffs);
    }).catch(err => {
      // The file existed before but has been removed, but we're trying to get a diff for it
      // Most likely it will just disappear with the next refresh of the staging area
      // so we just ignore the error here
      if (err.errorCode != 'no-such-file') this.server.unhandledRejection(err);
    });
  }

  render(isInvalidate) {
    return promise.resolve().then(() => {
      if (!this.diffJson || isInvalidate) {
        return this.getDiffJson();
      }
    }).then(() => {
      if (!this.diffJson || this.diffJson.length == 0) return; // check if diffs are available (binary files do not support them)
      let lineCount = 0;

      if (!this.diffJson[0].isTrimmed) {
        this.diffJson[0].blocks = this.diffJson[0].blocks.reduce((blocks, block) => {
          const length = block.lines.length;
          if (lineCount < this.loadCount) {
            block.lines = block.lines.slice(0, this.loadCount - lineCount);
            blocks.push(block);
          }
          lineCount += length;
          return blocks;
        }, []);
      }
      this.diffJson[0].isTrimmed = true;

      this.loadMoreCount(Math.min(loadLimit, Math.max(0, lineCount - this.loadCount)));

      let html;

      if (this.textDiffType.value() === 'sidebysidediff') {
        html = diff2html.getPrettySideBySideHtmlFromJson(this.diffJson);
      } else {
        html = diff2html.getPrettyHtmlFromJson(this.diffJson);
      }

      this.numberOfSelectedPatchLines = 0;
      let index = 0;

      // ko's binding resolution is not recursive, which means below ko.bind refresh method doesn't work for
      // data bind at getPatchCheckBox that is rendered with "html" binding.
      // which is reason why manually updating the html content and refreshing kobinding to have it render...
      if (this.patchLineList) {
        html = html.replace(/<span class="d2h-code-line-[a-z]+">(\+|\-)/g, (match, capture) => {
          if (this.patchLineList()[index] === undefined) {
            this.patchLineList()[index] = true;
          }

          return this.getPatchCheckBox(capture, index, this.patchLineList()[index++]);
        });
      }

      if (html !== this.htmlSrc) {
        // diff has changed since last we displayed and need refresh
        this.htmlSrc = html;
        this.isParsed(false);
        this.isParsed(true);
      }
    });
  }

  loadMore() {
    this.loadCount += this.loadMoreCount();
    programEvents.dispatch({ event: 'invalidate-diff-and-render' });
  }

  getPatchCheckBox(symbol, index, isActive) {
    if (isActive) {
      this.numberOfSelectedPatchLines++;
    }
    return `<div class="d2h-code-line-prefix"><span data-bind="visible: editState() !== 'patched'">${symbol}</span><input ${isActive ? 'checked' : ''} type="checkbox" data-bind="visible: editState() === 'patched', click: togglePatchLine.bind($data, ${index})"></input>`;
  }

  togglePatchLine(index) {
    this.patchLineList()[index] = !this.patchLineList()[index];

    if (this.patchLineList()[index]) {
      this.numberOfSelectedPatchLines++;
    } else {
      this.numberOfSelectedPatchLines--;
    }

    if (this.numberOfSelectedPatchLines === 0) {
      this.editState('none');
    }

    return true;
  }
}

},{"bluebird":undefined,"diff2html":undefined,"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3RleHRkaWZmL3RleHRkaWZmLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBkaWZmMmh0bWwgPSByZXF1aXJlKCdkaWZmMmh0bWwnKS5EaWZmMkh0bWw7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IHByb21pc2UgPSByZXF1aXJlKFwiYmx1ZWJpcmRcIik7XG5jb25zdCBzaWRlQnlTaWRlRGlmZiA9ICdzaWRlYnlzaWRlZGlmZic7XG5jb25zdCB0ZXh0RGlmZiA9ICd0ZXh0ZGlmZic7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ3RleHRkaWZmJywgYXJncyA9PiBuZXcgVGV4dERpZmZWaWV3TW9kZWwoYXJncykpO1xuY29tcG9uZW50cy5yZWdpc3RlcigndGV4dGRpZmYudHlwZScsICgpID0+IG5ldyBUeXBlKCkpO1xuY29tcG9uZW50cy5yZWdpc3RlcigndGV4dGRpZmYud29yZHdyYXAnLCAoKSA9PiBuZXcgV29yZFdyYXAoKSk7XG5jb21wb25lbnRzLnJlZ2lzdGVyKCd0ZXh0ZGlmZi53aGl0ZXNwYWNlJywgKCkgPT4gbmV3IFdoaXRlU3BhY2UoKSk7XG5cbmNvbnN0IGxvYWRMaW1pdCA9IDEwMDtcblxuY2xhc3MgV29yZFdyYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnRleHQgPSBrby5vYnNlcnZhYmxlKFwiTm8gV3JhcFwiKTtcbiAgICB0aGlzLnZhbHVlID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy52YWx1ZS5zdWJzY3JpYmUodmFsdWUgPT4geyB0aGlzLnRleHQodmFsdWUgPyBcIldvcmQgV3JhcFwiIDogXCJObyBXcmFwXCIpOyB9KTtcbiAgICB0aGlzLnRvZ2dsZSA9ICgpID0+IHsgdGhpcy52YWx1ZSghdGhpcy52YWx1ZSgpKTsgfVxuICAgIHRoaXMuaXNBY3RpdmUgPSBrby5jb21wdXRlZCgoKSA9PiAhIXRoaXMudmFsdWUoKSk7XG4gIH1cbn1cblxuY2xhc3MgVHlwZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMudGV4dCA9IGtvLm9ic2VydmFibGUoXCJEZWZhdWx0XCIpO1xuXG4gICAgaWYgKCEhdW5naXQuY29uZmlnLmRpZmZUeXBlICYmIHVuZ2l0LmNvbmZpZy5kaWZmVHlwZSAhPT0gJ3RleHRkaWZmJyAmJiB1bmdpdC5jb25maWcuZGlmZlR5cGUgIT09ICdzaWRlYnlzaWRlZGlmZicpIHtcbiAgICAgIHVuZ2l0LmNvbmZpZy5kaWZmVHlwZSA9ICd0ZXh0ZGlmZic7XG4gICAgICBjb25zb2xlLmxvZygnQ29uZmlnIFwiZGlmZlR5cGVcIiBtdXN0IGJlIGVpdGhlciBcInRleHRkaWZmXCIgb3IgXCJzaWRlYnlzaWRlZGlmZlwiLicpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSBrby5vYnNlcnZhYmxlKHVuZ2l0LmNvbmZpZy5kaWZmVHlwZSB8fCB0ZXh0RGlmZik7XG4gICAgdGhpcy52YWx1ZS5zdWJzY3JpYmUodmFsdWUgPT4ge1xuICAgICAgdGhpcy50ZXh0KHZhbHVlID09PSB0ZXh0RGlmZiA/IFwiRGVmYXVsdFwiIDogXCJTaWRlIEJ5IFNpZGVcIik7XG4gICAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdpbnZhbGlkYXRlLWRpZmYtYW5kLXJlbmRlcicgfSk7XG4gICAgfSk7XG4gICAgdGhpcy50b2dnbGUgPSAoKSA9PiB7XG4gICAgICB0aGlzLnZhbHVlKHRoaXMudmFsdWUoKSA9PT0gdGV4dERpZmYgPyBzaWRlQnlTaWRlRGlmZiA6IHRleHREaWZmKTtcbiAgICB9XG4gICAgdGhpcy5pc0FjdGl2ZSA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMudmFsdWUoKSA9PT0gJ3RleHRkaWZmJyk7XG4gIH1cbn1cblxuY2xhc3MgV2hpdGVTcGFjZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMudGV4dCA9IGtvLm9ic2VydmFibGUoXCJTaG93L0lnbm9yZSB3aGl0ZSBzcGFjZSBkaWZmXCIpO1xuICAgIHRoaXMudmFsdWUgPSBrby5vYnNlcnZhYmxlKHVuZ2l0LmNvbmZpZy5pZ25vcmVXaGl0ZVNwYWNlRGlmZik7XG4gICAgdGhpcy52YWx1ZS5zdWJzY3JpYmUodmFsdWUgPT4ge1xuICAgICAgdGhpcy50ZXh0KHZhbHVlID8gXCJJZ25vcmluZyBXaGl0ZSBTcGFjZSBkaWZmXCIgOiBcIlNob3dpbmcgV2hpdGUgU3BhY2UgZGlmZlwiKTtcbiAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2ludmFsaWRhdGUtZGlmZi1hbmQtcmVuZGVyJyB9KTtcbiAgICB9KTtcbiAgICB0aGlzLnRvZ2dsZSA9ICgpID0+IHsgdGhpcy52YWx1ZSghdGhpcy52YWx1ZSgpKTsgfVxuICAgIHRoaXMuaXNBY3RpdmUgPSBrby5jb21wdXRlZCgoKSA9PiAhdGhpcy52YWx1ZSgpKTtcbiAgfVxufVxuXG5jbGFzcyBUZXh0RGlmZlZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICB0aGlzLmZpbGVuYW1lID0gYXJncy5maWxlbmFtZTtcbiAgICB0aGlzLnJlcG9QYXRoID0gYXJncy5yZXBvUGF0aDtcbiAgICB0aGlzLnNlcnZlciA9IGFyZ3Muc2VydmVyO1xuICAgIHRoaXMuc2hhMSA9IGFyZ3Muc2hhMTtcbiAgICB0aGlzLmxvYWRNb3JlQ291bnQgPSBrby5vYnNlcnZhYmxlKDApO1xuICAgIHRoaXMuZGlmZkpzb24gPSBudWxsO1xuICAgIHRoaXMubG9hZENvdW50ID0gbG9hZExpbWl0O1xuICAgIHRoaXMudGV4dERpZmZUeXBlID0gYXJncy50ZXh0RGlmZlR5cGU7XG4gICAgdGhpcy53aGl0ZVNwYWNlID0gYXJncy53aGl0ZVNwYWNlO1xuICAgIHRoaXMuaXNTaG93aW5nRGlmZnMgPSBhcmdzLmlzU2hvd2luZ0RpZmZzO1xuICAgIHRoaXMuZWRpdFN0YXRlID0gYXJncy5lZGl0U3RhdGU7XG4gICAgdGhpcy53b3JkV3JhcCA9IGFyZ3Mud29yZFdyYXA7XG4gICAgdGhpcy5wYXRjaExpbmVMaXN0ID0gYXJncy5wYXRjaExpbmVMaXN0O1xuICAgIHRoaXMubnVtYmVyT2ZTZWxlY3RlZFBhdGNoTGluZXMgPSAwO1xuICAgIHRoaXMuaHRtbFNyYyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmlzUGFyc2VkID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG5cbiAgICBwcm9ncmFtRXZlbnRzLmFkZChldmVudCA9PiB7XG4gICAgICBpZiAoZXZlbnQuZXZlbnQgPT09IFwiaW52YWxpZGF0ZS1kaWZmLWFuZC1yZW5kZXJcIiB8fCBldmVudC5ldmVudCA9PT0gXCJ3b3JraW5nLXRyZWUtY2hhbmdlZFwiKSB7XG4gICAgICAgIHRoaXMuaW52YWxpZGF0ZURpZmYoKTtcbiAgICAgICAgaWYgKHRoaXMuaXNTaG93aW5nRGlmZnMoKSkgdGhpcy5yZW5kZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuaXNTaG93aW5nRGlmZnMuc3Vic2NyaWJlKG5ld1ZhbHVlID0+IHtcbiAgICAgIGlmIChuZXdWYWx1ZSkgdGhpcy5yZW5kZXIoKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmlzU2hvd2luZ0RpZmZzKCkpIHsgdGhpcy5yZW5kZXIoKTsgfVxuICB9XG5cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7XG4gICAga28ucmVuZGVyVGVtcGxhdGUoJ3RleHRkaWZmJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgZ2V0RGlmZkFyZ3VtZW50cygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZmlsZTogdGhpcy5maWxlbmFtZSxcbiAgICAgIHBhdGg6IHRoaXMucmVwb1BhdGgoKSxcbiAgICAgIHNoYTE6IHRoaXMuc2hhMSA/IHRoaXMuc2hhMSA6ICcnLFxuICAgICAgd2hpdGVTcGFjZTogdGhpcy53aGl0ZVNwYWNlLnZhbHVlKClcbiAgICB9O1xuICB9XG5cbiAgaW52YWxpZGF0ZURpZmYoKSB7XG4gICAgdGhpcy5kaWZmSnNvbiA9IG51bGw7XG4gIH1cblxuICBnZXREaWZmSnNvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL2RpZmYnLCB0aGlzLmdldERpZmZBcmd1bWVudHMoKSkudGhlbigoZGlmZnMpID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZGlmZnMgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIEludmFsaWQgdmFsdWUgbWVhbnMgdGhlcmUgaXMgbm8gY2hhbmdlcywgc2hvdyBkdW1teSBkaWZmIHdpdGhvdHUgYW55IGNoYW5nZXNcbiAgICAgICAgZGlmZnMgPSBgZGlmZiAtLWdpdCBhLyR7dGhpcy5maWxlbmFtZX0gYi8ke3RoaXMuZmlsZW5hbWV9XG4gICAgICAgICAgICAgICAgICBpbmRleCBhYWFhYWFhYS4uYmJiYmJiYmIgMTExMTExXG4gICAgICAgICAgICAgICAgICAtLS0gYS8ke3RoaXMuZmlsZW5hbWV9XG4gICAgICAgICAgICAgICAgICArKysgYi8ke3RoaXMuZmlsZW5hbWV9YDtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGlmZkpzb24gPSBkaWZmMmh0bWwuZ2V0SnNvbkZyb21EaWZmKGRpZmZzKTtcbiAgICB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgLy8gVGhlIGZpbGUgZXhpc3RlZCBiZWZvcmUgYnV0IGhhcyBiZWVuIHJlbW92ZWQsIGJ1dCB3ZSdyZSB0cnlpbmcgdG8gZ2V0IGEgZGlmZiBmb3IgaXRcbiAgICAgIC8vIE1vc3QgbGlrZWx5IGl0IHdpbGwganVzdCBkaXNhcHBlYXIgd2l0aCB0aGUgbmV4dCByZWZyZXNoIG9mIHRoZSBzdGFnaW5nIGFyZWFcbiAgICAgIC8vIHNvIHdlIGp1c3QgaWdub3JlIHRoZSBlcnJvciBoZXJlXG4gICAgICBpZiAoZXJyLmVycm9yQ29kZSAhPSAnbm8tc3VjaC1maWxlJykgdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGVycik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXIoaXNJbnZhbGlkYXRlKSB7XG4gICAgcmV0dXJuIHByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmRpZmZKc29uIHx8IGlzSW52YWxpZGF0ZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXREaWZmSnNvbigpO1xuICAgICAgfVxuICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmRpZmZKc29uIHx8IHRoaXMuZGlmZkpzb24ubGVuZ3RoID09IDApIHJldHVybjsgLy8gY2hlY2sgaWYgZGlmZnMgYXJlIGF2YWlsYWJsZSAoYmluYXJ5IGZpbGVzIGRvIG5vdCBzdXBwb3J0IHRoZW0pXG4gICAgICBsZXQgbGluZUNvdW50ID0gMDtcblxuICAgICAgaWYgKCF0aGlzLmRpZmZKc29uWzBdLmlzVHJpbW1lZCkge1xuICAgICAgICB0aGlzLmRpZmZKc29uWzBdLmJsb2NrcyA9IHRoaXMuZGlmZkpzb25bMF0uYmxvY2tzLnJlZHVjZSgoYmxvY2tzLCBibG9jaykgPT4ge1xuICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IGJsb2NrLmxpbmVzLmxlbmd0aDtcbiAgICAgICAgICBpZiAobGluZUNvdW50IDwgdGhpcy5sb2FkQ291bnQpIHtcbiAgICAgICAgICAgIGJsb2NrLmxpbmVzID0gYmxvY2subGluZXMuc2xpY2UoMCwgdGhpcy5sb2FkQ291bnQgLSBsaW5lQ291bnQpO1xuICAgICAgICAgICAgYmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsaW5lQ291bnQgKz0gbGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBibG9ja3M7XG4gICAgICAgIH0sIFtdKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGlmZkpzb25bMF0uaXNUcmltbWVkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5sb2FkTW9yZUNvdW50KE1hdGgubWluKGxvYWRMaW1pdCwgTWF0aC5tYXgoMCwgbGluZUNvdW50IC0gdGhpcy5sb2FkQ291bnQpKSk7XG5cbiAgICAgIGxldCBodG1sO1xuXG4gICAgICBpZiAodGhpcy50ZXh0RGlmZlR5cGUudmFsdWUoKSA9PT0gJ3NpZGVieXNpZGVkaWZmJykge1xuICAgICAgICBodG1sID0gZGlmZjJodG1sLmdldFByZXR0eVNpZGVCeVNpZGVIdG1sRnJvbUpzb24odGhpcy5kaWZmSnNvbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBodG1sID0gZGlmZjJodG1sLmdldFByZXR0eUh0bWxGcm9tSnNvbih0aGlzLmRpZmZKc29uKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5udW1iZXJPZlNlbGVjdGVkUGF0Y2hMaW5lcyA9IDA7XG4gICAgICBsZXQgaW5kZXggPSAwO1xuXG4gICAgICAvLyBrbydzIGJpbmRpbmcgcmVzb2x1dGlvbiBpcyBub3QgcmVjdXJzaXZlLCB3aGljaCBtZWFucyBiZWxvdyBrby5iaW5kIHJlZnJlc2ggbWV0aG9kIGRvZXNuJ3Qgd29yayBmb3JcbiAgICAgIC8vIGRhdGEgYmluZCBhdCBnZXRQYXRjaENoZWNrQm94IHRoYXQgaXMgcmVuZGVyZWQgd2l0aCBcImh0bWxcIiBiaW5kaW5nLlxuICAgICAgLy8gd2hpY2ggaXMgcmVhc29uIHdoeSBtYW51YWxseSB1cGRhdGluZyB0aGUgaHRtbCBjb250ZW50IGFuZCByZWZyZXNoaW5nIGtvYmluZGluZyB0byBoYXZlIGl0IHJlbmRlci4uLlxuICAgICAgaWYgKHRoaXMucGF0Y2hMaW5lTGlzdCkge1xuICAgICAgICBodG1sID0gaHRtbC5yZXBsYWNlKC88c3BhbiBjbGFzcz1cImQyaC1jb2RlLWxpbmUtW2Etel0rXCI+KFxcK3xcXC0pL2csIChtYXRjaCwgY2FwdHVyZSkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLnBhdGNoTGluZUxpc3QoKVtpbmRleF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5wYXRjaExpbmVMaXN0KClbaW5kZXhdID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXRjaENoZWNrQm94KGNhcHR1cmUsIGluZGV4LCB0aGlzLnBhdGNoTGluZUxpc3QoKVtpbmRleCsrXSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoaHRtbCAhPT0gdGhpcy5odG1sU3JjKSB7XG4gICAgICAgIC8vIGRpZmYgaGFzIGNoYW5nZWQgc2luY2UgbGFzdCB3ZSBkaXNwbGF5ZWQgYW5kIG5lZWQgcmVmcmVzaFxuICAgICAgICB0aGlzLmh0bWxTcmMgPSBodG1sO1xuICAgICAgICB0aGlzLmlzUGFyc2VkKGZhbHNlKTtcbiAgICAgICAgdGhpcy5pc1BhcnNlZCh0cnVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGxvYWRNb3JlKCkge1xuICAgIHRoaXMubG9hZENvdW50ICs9IHRoaXMubG9hZE1vcmVDb3VudCgpO1xuICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2ludmFsaWRhdGUtZGlmZi1hbmQtcmVuZGVyJyB9KTtcbiAgfVxuXG4gIGdldFBhdGNoQ2hlY2tCb3goc3ltYm9sLCBpbmRleCwgaXNBY3RpdmUpIHtcbiAgICBpZiAoaXNBY3RpdmUpIHtcbiAgICAgIHRoaXMubnVtYmVyT2ZTZWxlY3RlZFBhdGNoTGluZXMrKztcbiAgICB9XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZDJoLWNvZGUtbGluZS1wcmVmaXhcIj48c3BhbiBkYXRhLWJpbmQ9XCJ2aXNpYmxlOiBlZGl0U3RhdGUoKSAhPT0gJ3BhdGNoZWQnXCI+JHtzeW1ib2x9PC9zcGFuPjxpbnB1dCAke2lzQWN0aXZlID8gJ2NoZWNrZWQnIDogJyd9IHR5cGU9XCJjaGVja2JveFwiIGRhdGEtYmluZD1cInZpc2libGU6IGVkaXRTdGF0ZSgpID09PSAncGF0Y2hlZCcsIGNsaWNrOiB0b2dnbGVQYXRjaExpbmUuYmluZCgkZGF0YSwgJHtpbmRleH0pXCI+PC9pbnB1dD5gO1xuICB9XG5cbiAgdG9nZ2xlUGF0Y2hMaW5lKGluZGV4KSB7XG4gICAgdGhpcy5wYXRjaExpbmVMaXN0KClbaW5kZXhdID0gIXRoaXMucGF0Y2hMaW5lTGlzdCgpW2luZGV4XTtcblxuICAgIGlmICh0aGlzLnBhdGNoTGluZUxpc3QoKVtpbmRleF0pIHtcbiAgICAgIHRoaXMubnVtYmVyT2ZTZWxlY3RlZFBhdGNoTGluZXMrKztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5udW1iZXJPZlNlbGVjdGVkUGF0Y2hMaW5lcy0tO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm51bWJlck9mU2VsZWN0ZWRQYXRjaExpbmVzID09PSAwKSB7XG4gICAgICB0aGlzLmVkaXRTdGF0ZSgnbm9uZScpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG4iXX0=
