// Angular service module for connecting to JSON APIs
angular.module('pollServices', ['ngResource']).
	factory('Poll', function($resource) {
		return $resource('polls/:pollId', {}, {
			// Use this method for getting a list of polls
			query: { method: 'GET', params: { pollId: 'polls' }, isArray: true },
			create: { method: 'POST', params: { pollId: 'new' }},
			delete: { method: "DELETE", params: { pollId: '@id'} }
		})
	}).
	factory('socket', function($rootScope) {
		var socket = io.connect();
		return {
			on: function (eventName, callback) {
	      socket.on(eventName, function () {  
	        var args = arguments;
	        $rootScope.$apply(function () {
	          callback.apply(socket, args);
	        });
	      });
	    },
	    emit: function (eventName, data, callback) {
	      socket.emit(eventName, data, function () {
	        var args = arguments;
	        $rootScope.$apply(function () {
	          if (callback) {
	            callback.apply(socket, args);
	          }
	        });
	      })
	    }
		};
	});