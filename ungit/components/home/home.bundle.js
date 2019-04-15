(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');

components.register('home', args => new HomeViewModel(args.app));

class HomeRepositoryViewModel {
  constructor(home, path) {
    this.home = home;
    this.app = home.app;
    this.server = this.app.server;
    this.path = path;
    this.title = path;
    this.link = `${ungit.config.rootPath}/#/repository?path=${encodeURIComponent(path)}`;
    this.pathRemoved = ko.observable(false);
    this.remote = ko.observable('...');
    this.updateState();
  }

  updateState() {
    this.server.getPromise(`/fs/exists?path=${encodeURIComponent(this.path)}`)
      .then(exists => { this.pathRemoved(!exists); })
      .catch((e) => this.server.unhandledRejection(e));
    this.server.getPromise(`/remotes/origin?path=${encodeURIComponent(this.path)}`)
      .then(remote => {	this.remote(remote.address.replace(/\/\/.*?\@/, "//***@")); })
      .catch(err => { this.remote(''); });
  }

  remove() {
    this.app.repoList.remove(this.path);
    this.home.update();
  }
}

class HomeViewModel {
  constructor(app) {
    this.app = app;
    this.repos = ko.observableArray();
    this.showNux = ko.computed(() => this.repos().length == 0);
  }

  updateNode(parentElement) {
    ko.renderTemplate('home', this, {}, parentElement);
  }

  shown() {
    this.update();
  }

  update() {
    const reposByPath = {};
    this.repos().forEach(repo => { reposByPath[repo.path] = repo; });
    this.repos(this.app.repoList().sort().map(path => {
      if (!reposByPath[path])
        reposByPath[path] = new HomeRepositoryViewModel(this, path);
      return reposByPath[path];
    }));
  }
  get template() { return 'home'; }
}

},{"knockout":"knockout","ungit-components":"ungit-components"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2hvbWUvaG9tZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiXG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdob21lJywgYXJncyA9PiBuZXcgSG9tZVZpZXdNb2RlbChhcmdzLmFwcCkpO1xuXG5jbGFzcyBIb21lUmVwb3NpdG9yeVZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGhvbWUsIHBhdGgpIHtcbiAgICB0aGlzLmhvbWUgPSBob21lO1xuICAgIHRoaXMuYXBwID0gaG9tZS5hcHA7XG4gICAgdGhpcy5zZXJ2ZXIgPSB0aGlzLmFwcC5zZXJ2ZXI7XG4gICAgdGhpcy5wYXRoID0gcGF0aDtcbiAgICB0aGlzLnRpdGxlID0gcGF0aDtcbiAgICB0aGlzLmxpbmsgPSBgJHt1bmdpdC5jb25maWcucm9vdFBhdGh9LyMvcmVwb3NpdG9yeT9wYXRoPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHBhdGgpfWA7XG4gICAgdGhpcy5wYXRoUmVtb3ZlZCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMucmVtb3RlID0ga28ub2JzZXJ2YWJsZSgnLi4uJyk7XG4gICAgdGhpcy51cGRhdGVTdGF0ZSgpO1xuICB9XG5cbiAgdXBkYXRlU3RhdGUoKSB7XG4gICAgdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZShgL2ZzL2V4aXN0cz9wYXRoPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMucGF0aCl9YClcbiAgICAgIC50aGVuKGV4aXN0cyA9PiB7IHRoaXMucGF0aFJlbW92ZWQoIWV4aXN0cyk7IH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSk7XG4gICAgdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZShgL3JlbW90ZXMvb3JpZ2luP3BhdGg9JHtlbmNvZGVVUklDb21wb25lbnQodGhpcy5wYXRoKX1gKVxuICAgICAgLnRoZW4ocmVtb3RlID0+IHtcdHRoaXMucmVtb3RlKHJlbW90ZS5hZGRyZXNzLnJlcGxhY2UoL1xcL1xcLy4qP1xcQC8sIFwiLy8qKipAXCIpKTsgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4geyB0aGlzLnJlbW90ZSgnJyk7IH0pO1xuICB9XG5cbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMuYXBwLnJlcG9MaXN0LnJlbW92ZSh0aGlzLnBhdGgpO1xuICAgIHRoaXMuaG9tZS51cGRhdGUoKTtcbiAgfVxufVxuXG5jbGFzcyBIb21lVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5yZXBvcyA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuICAgIHRoaXMuc2hvd051eCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMucmVwb3MoKS5sZW5ndGggPT0gMCk7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnaG9tZScsIHRoaXMsIHt9LCBwYXJlbnRFbGVtZW50KTtcbiAgfVxuXG4gIHNob3duKCkge1xuICAgIHRoaXMudXBkYXRlKCk7XG4gIH1cblxuICB1cGRhdGUoKSB7XG4gICAgY29uc3QgcmVwb3NCeVBhdGggPSB7fTtcbiAgICB0aGlzLnJlcG9zKCkuZm9yRWFjaChyZXBvID0+IHsgcmVwb3NCeVBhdGhbcmVwby5wYXRoXSA9IHJlcG87IH0pO1xuICAgIHRoaXMucmVwb3ModGhpcy5hcHAucmVwb0xpc3QoKS5zb3J0KCkubWFwKHBhdGggPT4ge1xuICAgICAgaWYgKCFyZXBvc0J5UGF0aFtwYXRoXSlcbiAgICAgICAgcmVwb3NCeVBhdGhbcGF0aF0gPSBuZXcgSG9tZVJlcG9zaXRvcnlWaWV3TW9kZWwodGhpcywgcGF0aCk7XG4gICAgICByZXR1cm4gcmVwb3NCeVBhdGhbcGF0aF07XG4gICAgfSkpO1xuICB9XG4gIGdldCB0ZW1wbGF0ZSgpIHsgcmV0dXJuICdob21lJzsgfVxufVxuIl19
