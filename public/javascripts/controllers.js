// Controller for the poll list
function PollListCtrl($scope, Poll) {
	$scope.polls = Poll.query();
	
	$scope.removePoll = function(poll_id) {
	    Poll.delete({pollId:poll_id}, function(p, resp) {
	      if(!p.error) {
				// If there is no error, redirect to the main view
				$scope.polls = Poll.query();
				$location.path('polls');

			} else {
				alert('Could not create poll.');
			}
	    });
 };
}

// Controller for an individual poll
function PollItemCtrl($scope, $routeParams, socket, Poll) {
	$scope.poll = Poll.get({pollId: $routeParams.pollId});
	
	socket.on('myvote', function(data) {
		console.dir(data);
		if(data._id === $routeParams.pollId) {
			$scope.poll = data;
		}
	});
	
	socket.on('vote', function(data) {
		console.dir(data);
		if(data._id === $routeParams.pollId) {
			$scope.poll.choices = data.choices;
			$scope.poll.totalVotes = data.totalVotes;
		}
	});
	
	$scope.vote = function() {
		var pollId = $scope.poll._id,
				choiceId = $scope.poll.userVote;
		
		if(choiceId) {
			var voteObj = { poll_id: pollId, choice: choiceId };
			socket.emit('send:vote', voteObj);
		} else {
			alert('You must select an option to vote for.');
		}
	};
	
	$scope.revote = function() {
		var pollId = $scope.poll._id,
				choiceId = $scope.poll.userChoice,
				voteId = $scope.poll.userVote;
		
		if(choiceId) {
			var voteObj = { poll_id: pollId, choice: choiceId, vote:voteId };
			socket.emit('send:revote', voteObj);
		} else {
			alert('You must select an option to vote for.');
		}
	};
	
	// Remove poll from the database
	/*
	$scope.revote = function() {
		var poll = $scope.poll;
		
				// Create a new poll from the model
				var newPoll = new Poll(poll);
				
				// Call API to remove poll from the database
				newPoll.$remove(function(p, resp) {
					if(!p.error) {
						// If there is no error, redirect to the main view
						$location.path('/poll/:pollId');
					} else {
						alert('Could not delete poll');
					}
				});
		
	};
*/	
	/*$scope.delete = function() {
	    
	      
	        $scope.poll.$delete({id: $scope.poll._id}, function() {
	          $scope.polls.splice(index, 1);
	        });
	      
	     };*/
}

// Controller for creating a new poll
function PollNewCtrl($scope, $location, Poll) {
	// Define an empty poll model object
	$scope.poll = {
		question: '',
		choices: [ { text: '' }, { text: '' }, { text: '' }]
	};
	
	// Method to add an additional choice option
	$scope.addChoice = function() {
		$scope.poll.choices.push({ text: '' });
	};
	
	// Validate and save the new poll to the database
	$scope.createPoll = function() {
		var poll = $scope.poll;
		
		// Check that a question was provided
		if(poll.question.length > 0) {
			var choiceCount = 0;
			
			// Loop through the choices, make sure at least two provided
			for(var i = 0, ln = poll.choices.length; i < ln; i++) {
				var choice = poll.choices[i];
				
				if(choice.text.length > 0) {
					choiceCount++;
				}
			}

			if(choiceCount > 1) {
				// Create a new poll from the model
				var newPoll = new Poll(poll);
				
				// Call API to save poll to the database
				newPoll.$create(function(p, resp) {
					if(!p.error) {
						// If there is no error, redirect to the main view
						$location.path('polls');
					} else {
						if(p.code='11000')
							alert('Duplicate poll.');
						else
							alert('Could not create poll.');
					}
				});
			} else {
				alert('You must enter at least two choices');
			}
		} else {
			alert('You must enter a question');
		}
	};
}