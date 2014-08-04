// Connect to MongoDB using Mongoose
var mongoose = require('mongoose');
var db;
if (process.env.VCAP_SERVICES) {
   var env = JSON.parse(process.env.VCAP_SERVICES);
   db = mongoose.createConnection(env['mongodb-2.2'][0].credentials.url);
} else {
   db = mongoose.createConnection('localhost', 'pollsapp');
}

// Get Poll schema and model
var PollSchema = require('../models/Poll.js').PollSchema;
var Poll = db.model('polls', PollSchema);

// Main application view
exports.index = function(req, res) {
	res.render('index');
};

// JSON API for list of polls
exports.list = function(req, res) {
	// Query Mongo for polls, just get back the question text
	Poll.find({}, 'question', function(error, polls) {
		res.json(polls);
	});
};

// JSON API for getting a single poll
exports.poll = function(req, res) {
	console.log('inside exports.poll()');
	// Poll ID comes in the URL
	var pollId = req.params.id;
	
	// Find the poll by its ID, use lean as we won't be changing it
	Poll.findById(pollId, '', { lean: true }, function(err, poll) {
		if(poll) {
			var userVoted = false,
					userChoice,
					userVote,
					totalVotes = 0;

			// Loop through poll choices to determine if user has voted
			// on this poll, and if so, what they selected
			for(c in poll.choices) {
				var choice = poll.choices[c]; 

				for(v in choice.votes) {
					var vote = choice.votes[v];
					totalVotes++;

					if(vote.ip === (req.header('x-forwarded-for') || req.ip)) {
						userVoted = true;
						userVote = { _id: vote._id, ip: vote.ip };
						userChoice = { _id: choice._id, text: choice.text };
					}
				}
			}

			// Attach info about user's past voting on this poll
			poll.userVoted = userVoted;
			poll.userChoice = userChoice;
			poll.userVote = userVote;
			poll.totalVotes = totalVotes;
		
			res.json(poll);
		} else {
			res.json({error:true});
		}
	});
};

// JSON API for creating a new poll
exports.create = function(req, res) {
	console.log('inside exports.create()');
	
	var reqBody = req.body,
			// Filter out choices with empty text
			choices = reqBody.choices.filter(function(v) { return v.text != ''; }),
			// Build up poll object to save
			pollObj = {question: reqBody.question, choices: choices};

	// Create poll model from built up poll object
	var poll = new Poll(pollObj);
	
	// Save poll to DB
	poll.save(function(err, doc) {
		if(err || !doc) {
			console.error(err);
			err.error=true;
			res.json(err);
		} else {
			res.json(doc);
		}
	});
};

exports.remove = function(req, res) {
	console.log('inside exports.remove()');
	console.log("Remove: " + JSON.stringify( req.params.id,null,4));

	var pollObj = {_id: req.params.id};
	// Create poll model from built up poll object
   var poll = new Poll(pollObj);
	
	// Save poll to DB
	poll.remove(function(err, doc) {
		if(err || !doc) {
			err.error=true;
			res.json(err);
		} else {
			res.json(doc);
		}		
	});
};

exports.revote = function(socket) {
	console.log('inside exports.revote()');
	socket.on('send:revote', function(data) {
		var ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
		
		Poll.findById(data.poll_id, function(err, poll) {
			if(err) {
				console.error(err);
				return;
			}
			
			console.log("poll is: " + JSON.stringify(poll,null,4));
			var choice = poll.choices.id(data.choice._id);
			var vote = choice.votes.id(data.vote._id);
			if(vote==null) return;
			console.log("vote: " + vote._id + ":::for : " + poll._id);
			
			Poll.findOneAndUpdate( {'choices.votes._id': vote._id }, {$pull: {'choices.$.votes': {'ip':vote.ip } }}, function(err, doc)  {
				if (err) {
					console.log(err);
					return;
				}
				console.log("after update: " + JSON.stringify(doc,null,4));
				var theDoc = { 
					question: doc.question, _id: doc._id, choices: doc.choices,
					userVoted: false, totalVotes: 0 
				};
				
				socket.emit('myvote', theDoc);
				socket.broadcast.emit('vote', theDoc);
			});			
		});
	});
};

exports.vote = function(socket) {
	console.log('inside exports.vote()');
	socket.on('send:vote', function(data) {
		var ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
		
		Poll.findById(data.poll_id, function(err, poll) {
			var choice = poll.choices.id(data.choice);
			choice.votes.push({ ip: ip });
			
			poll.save(function(err, doc) {
				var theDoc = { 
					question: doc.question, _id: doc._id, choices: doc.choices, 
					userVoted: false, totalVotes: 0 
				};

				// Loop through poll choices to determine if user has voted
				// on this poll, and if so, what they selected
				for(var i = 0, ln = doc.choices.length; i < ln; i++) {
					var choice = doc.choices[i];

					for(var j = 0, jLn = choice.votes.length; j < jLn; j++) {
						var vote = choice.votes[j];
						theDoc.totalVotes++;
						theDoc.ip = ip;

						if(vote.ip === ip) {
							theDoc.userVoted = true;
							theDoc.userVote = { _id: vote._id, ip: ip };
							theDoc.userChoice = { _id: choice._id, text: choice.text };
							
						}
					}
				}
				
				socket.emit('myvote', theDoc);
				socket.broadcast.emit('vote', theDoc);
			});			
		});
	});
};