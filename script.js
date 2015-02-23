var app = angular.module('JukeTubeApp', ['LocalStorageModule', 'ui.bootstrap']);

app.run(function () {
    var tag = document.createElement('script');
    tag.src = "http://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
});

app.config(function ($httpProvider) {
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
});


app.config(function ($routeProvider) {
    $routeProvider.
        when('/search', {templateUrl: 'search.html', controller: 'VideosController'}).
        when('/details/:videoId', {templateUrl: 'details.html', controller: 'VideosController'}).
        when('/playlist', {templateUrl: 'playlist.html', controller: 'VideosController'}).
        otherwise({redirectTo: '/playlist'});
});


// Controller

app.controller('VideosController', function ($scope, $http, $log, $routeParams, $location, VideosService) {

    $scope.totalItems = 64;
    $scope.currentPage = 4;

    $scope.setPage = function (pageNo) {
        $scope.currentPage = pageNo;
    };

    $scope.pageChanged = function () {
        console.log('Page changed to: ' + $scope.currentPage);
    };

    $scope.maxSize = 5;
    $scope.bigTotalItems = 175;
    $scope.bigCurrentPage = 1;


    $scope.videoId = $routeParams.videoId;
    $scope.mode = 'playlist';
    $scope.toggleMode = function (button) {
        $scope.mode = button;
        $location.url(button);
    };

    init();

    function init() {
        $scope.youtube = VideosService.getYoutube();
        $scope.results = VideosService.getResults();
        $scope.upcoming = VideosService.getUpcoming();
        $scope.playlist = true;
    }

    $scope.play = function (id, title) {
        VideosService.play(id, title);
        VideosService.archiveVideo(id, title);
        $scope.upcoming = VideosService.getUpcoming();
    };

    $scope.queue = function (id, title) {
        VideosService.queueVideo(id, title);
        $scope.upcoming = VideosService.getUpcoming();
    };

    $scope.delete = function (list, id) {
        VideosService.deleteVideo(list, id);
        $scope.upcoming = VideosService.getUpcoming();
    };

    $scope.search = function () {
        $http.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: 'AIzaSyC9H9GDO932HvJbVxgiNAmmepZGx77piLg', // jgthms
                type: 'video',
                maxResults: '8',
                part: 'id,snippet',
                fields: 'items/id,items/snippet/title,items/snippet/description,items/snippet/thumbnails/default,items/snippet/channelTitle',
                q: this.query
            }
        })
            .success(function (data) {
                VideosService.listResults(data);
            })
            .error(function () {
            });
    }
});


// Service

app.service('VideosService', ['$window', '$rootScope', '$log', 'localStorageService', function ($window, $rootScope, $log, localStorageService) {

    var service = this;

    var youtube = {
        ready: false,
        player: null,
        playerId: null,
        videoId: null,
        videoTitle: null,
        playerHeight: '240',
        playerWidth: '320',
        state: 'stopped',
        currentVideo: 0
    };

    var results = [];
    var upcoming = localStorageService.get('upcoming');

    function getCurrentVideoById(id) {
        for (var i = 0; i <= upcoming.length; i++) {
            if (upcoming[i].id == id) {
                return i;
            }
        }
        return 0;
    }

    $window.onYouTubeIframeAPIReady = function () {
        youtube.ready = true;
        service.bindPlayer('player');
        service.loadPlayer();
        $rootScope.$apply();
    };

    function onYoutubeReady(event) {
        youtube.player.cueVideoById(upcoming[0].id);
        youtube.videoId = upcoming[0].id;
        youtube.videoTitle = upcoming[0].title;
    }

    function onYoutubeStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
            youtube.state = 'playing';
        } else if (event.data == YT.PlayerState.PAUSED) {
            youtube.state = 'paused';
        } else if (event.data == YT.PlayerState.ENDED) {
            youtube.state = 'ended';
            youtube.currentVideo = getCurrentVideoById(youtube.videoId);
            service.play(upcoming[youtube.currentVideo + 1].id, upcoming[youtube.currentVideo + 1].title);
        }
        $rootScope.$apply();
    }

    this.bindPlayer = function (elementId) {
        youtube.playerId = elementId;
    };

    this.createPlayer = function () {
        return new YT.Player(youtube.playerId, {
            height: youtube.playerHeight,
            width: youtube.playerWidth,
            playerVars: {
                rel: 0,
                showinfo: 0
            },
            events: {
                'onReady': onYoutubeReady,
                'onStateChange': onYoutubeStateChange
            }
        });
    };

    this.loadPlayer = function () {
        if (youtube.ready && youtube.playerId) {
            if (youtube.player) {
                youtube.player.destroy();
            }
            youtube.player = service.createPlayer();
        }
    };

    this.play = function (id, title) {
        youtube.player.loadVideoById(id);
        $log.info(youtube.currentVideo);
        youtube.videoId = id;
        youtube.videoTitle = title;
        return youtube;
    }

    this.listResults = function (data) {
        results.length = 0;
        for (var i = data.items.length - 1; i >= 0; i--) {
            results.push({
                id: data.items[i].id.videoId,
                title: data.items[i].snippet.title,
                description: data.items[i].snippet.description,
                thumbnail: data.items[i].snippet.thumbnails.default.url,
                author: data.items[i].snippet.channelTitle
            });
        }
        return results;
    };

    this.queueVideo = function (id, title) {
        var saved = localStorageService.get('upcoming');
        saved.push({
            id: id,
            title: title
        });
        localStorageService.add('upcoming', saved);
        upcoming = localStorageService.get('upcoming');
        return upcoming;
    };

    this.deleteVideo = function (list, id) {
        var videos = localStorageService.get(list);
        for (var i = videos.length - 1; i >= 0; i--) {
            if (videos[i].id === id) {
                videos.splice(i, 1);
                break;
            }
        }
        localStorageService.add(list, videos);
    };

    this.getYoutube = function () {
        return youtube;
    };

    this.getResults = function () {
        return results;
    };

    this.getUpcoming = function () {
        upcoming = localStorageService.get('upcoming');
        return upcoming;
    };

}]);


