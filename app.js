// express for server interaction
const express = require('express');
// redis database manager
const redis = require('redis');
// bluebird asynch
// http://bluebirdjs.com/docs/api/promisification.html
const bluebird = require('bluebird');
// bauth authorization
const auth = require('basic-auth');
// body parse incoming requests 
const body = require('body-parser');
//express 
const app = express();

// https://github.com/NodeRedis/node_redis
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);



// https://davidbeath.com/posts/expressjs-40-basicauth.html
var authr = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = auth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === 'teacher' && user.pass === 't1g3rTester!@#') {
//	console.log(user.name + ' ' + user.pass);
    return next();
  } else {
    return unauthorized(res);
  };
};

app.use(body.json()); //support JSON bodies
app.use(body.urlencoded({extended: false})); //support URL bodies
//use req.body object to access post info stored in body

//create a redis database to store students' info
client = redis.createClient();

//home screen 
app.get('/', authr, function ( req, res) {
	console.log(" [ OK  ] homescreen connection!");
	res.status(200);
});

// add a student to the database
app.post('/students', authr, function ( req, res) {
	//should accept a JSON request body 
	//https://stackoverflow.com/questions/8742982/how-to-receive-json-in-express-node-js-post-request

	var username = req.body.username;
	var name = req.body.name;
	var new_student = 0;

	if(!username || !name){
		//username or name DNE
		console.log(' [ERROR] missing username or name');
		res.status(400).send('missing username or name');
	} else {
		//use bluebirded asynch redis set of a student
		client.sismemberAsync("students", username ).then( function (contents) {
			if(!contents){
				new_student = true;
			}	
			if( new_student) {
				client.saddAsync("students", req.body.username, req.body.name ).then( function(contents) {
					console.log(" [ " + contents + "  ] adding student to the database");
					res.status(200).json( {_ref : "/students/" + username });
				}).catch( function (error) {
					console.log(" [ " + error + " ] adding student to the database");
				});
			} else {
				console.log(" [ " + true + "] student already exists in the database");
				res.status(400).send("student already exists");
			}
		}).catch( function (error) {
			console.log(" [ " + error + "  ] checking existent student in the database");
		});
	}
});

// deletes a student from the database
app.delete('/students/:username', authr,function ( req, res) {

	var username = req.params.username;
	if(!username){
		//username DNE
		res.status(400).send('missing username');
	} else {
		client.sismemberAsync("students", username).then( function (contents) {
			//hexist returned contents
			if(contents){
				client.sremAsync( "students", username).then( function (contents) {
					//hdel returned contents
					console.log(" [ " + contents + "  ] removing student from the database");
					res.status(200).send(username + " removed from the table");
				}).catch( function ( error) {
					//error with hdel call
				console.log(" [ " + error + " ] removing student in the database");
				});
			} else {
				res.status(400).send(username + " does not exist in the database");
			}
		}).catch( function (error) {
			//error in making hexist call
			console.log(" [ " + error + " ] making hexist in removing student");
		});
	}
});

// gets a student's info
app.get('/students/:username', authr,function ( req, res) {
	var username = req.params.username;
	if(!username){
		//username DNE
		res.status(400).send('missing username');
	} else {
		client.hexistsAsync("students", username).then( function (contents) {
			//hexist returned contents
			if(contents){
				client.sremAsync( "students", username).then( function (contents) {
					//hdel returned contents
					console.log(" [ " + username + "  ] getting student from the database");
					res.status(200).json( {"username": username, "name": contents, "_ref": "/students/"+ username});
				}).catch( function ( error) {
					//error with hget call
					console.log(" [ " + error + " ] getting student in the database");
				});
			} else {
				console.log(" [ ERROR ] student does not exist in the database");
				res.status(404).send(username + " does not exist in the database");
			}
		}).catch( function (error) {
			//error in making hexist call
			console.log(" [ " + error + " ] making hexist in getting student");
		});
	}
});

// returns all students
app.get('/students', authr, function ( req, res) {

	client.smembersAsync("students").then( function ( contents) {
		if(contents){
			console.log(" [ OK   ] getting all students");
			res.status(200).json( contents);
			return;
		} else {
			console.log(" [ OK   ] getting all students");
			res.status(200).end();
			return;
		}
	}).catch( function (error) {
		console.log(" [ " + error + " ] error in hgetall in getting /Students");
		res.status(404).send('error');
	});
});

app.patch('/students/:username', authr,function ( req, res) {
	var username = req.params.username;
	client.smemberAsync("students", username).then( function ( contents) {
		if(contents){
			// username exists in the table
			if(!req.body.username){
				//param username should be used
				client.saddAsync("students", username, req.body.name).then( function ( contents) {
					//hset worked 
					console.log("[ OK  ] 1/1 patching student");
					res.status(200).send(' student updated');
				}).catch( function (error) {
					//hset did not work
					console.log("[ ERROR] patching student");
					res.status(404).send(' student patch');
				});
			} else {
				//param username needs to be removed 
					console.log("[ ERROR] patching student");
					res.status(400).send(' student patch');
			}
		} else {
			//username DNE in the table
			console.log( " [ OK  ] student DNE for patch");
			res.status(400).send(' student patch');
		}

	}).catch( function (error) {
		//hexists doesn't work
		res.status(404).send(' student patch');
	});
});
// adds a new grade to the database
app.post('/grades', authr, function ( req, res) {
	var ready = 1,
	username = req.body.username,
	type = req.body.type,
	max = req.body.max,
	grade = req.body.grade;
	if( !username){
		ready = 0;
	} else if( !type){
		ready = 0;
	} else if( !max){
		ready = 0;
	} else if( !grade){
		ready = 0;
	}
	if(!ready){
		res.status(400).send('missing something');
	} else {
		client.hgetAsync("grades", username).then( function ( contents){
			//hget username worked
		}).catch( function (error) {
			//hget username did not work
		});	
	}
});

// get a grade in the database
app.get('/grades/:gradeid', authr, function ( req, res) {
	console.log('get a grade');
	res.send('hella world!');
});

// modifies a grade in the database
app.patch('/grades/:gradeid', authr, function ( req, res) {
	console.log('modifying a grade in the database');
	res.send('hella world!');
});

// deletes a grade in the database
app.delete('/grades/:gradeid', authr, function ( req, res) {
	console.log('deleting a grade in the database');
	res.send('hella world!');
});

// returns a list of all the grades
app.get('/grades', authr, function ( req, res) {
	console.log('getting all the grades');
	res.send('hella world!');
});

// drop table
app.delete('/db', authr, function ( req, res) {
	client.flushallAsync().then( function (contents){
		console.log( " [ " + contents + "  ] table cleared");
		res.status(200).send("table cleared");
	}).catch( function (error) {
		res.status(400).send("error clearing table");

	});
});

app.listen(3000, () => {
	console.log('starting node.js server');
});

