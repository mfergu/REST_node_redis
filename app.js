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
		client.sismemberAsync("usernames", username ).then( function (contents) {
			if(!contents){
				new_student = true;
			}	
			if( new_student) {
				client.saddAsync("usernames", req.body.username ).then( function(contents) {
					console.log(" [ " + contents + "  ] adding student to the username database");
					res.status(200).json( {_ref : "/students/" + username });
				}).catch( function (error) {
					console.log(" [ " + error + " ] adding student to the name database");
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
		client.sismemberAsync("usernames", username).then( function (contents) {
			//hexist returned contents
			if(contents){
				client.sremAsync( "usernames", username).then( function (contents) {
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
		client.sismemberAsync("usernames", username).then( function (contents) {
			//hexist returned contents
			if(contents){
				client.sremAsync( "usernames", username).then( function (contents) {
					//srem returned contents
					console.log(" [ " + username + "  ] getting student from the set");
					client.saddAsync("usernames", username).then( function (contents){
					}).catch( function (error) {
						console.log(" [ " + error + " ] adding username back to set");
					});
					res.status(200).json( {"username": username, "name": contents, "_ref": "/students/"+ username});
				}).catch( function ( error) {
					//error with hget call
					console.log(" [ " + error + " ] removing username from set");
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

	client.smembersAsync("usernames").then( function ( contents) {
		if(contents){
			console.log(" [ OK   ] getting all students");
			var un_data = [];
			for( var i = 0; i< contents.length; i++){
				un_data[i] = {"username": contents[i], "_ref": "/students/"+contents[i]};
			}
			res.status(200).json( un_data);
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
	client.sismemberAsync("usernames", username).then( function ( contents) {
		if(contents){
			// username exists in the table
			if(!req.body.username){
				//param username should be used
				client.saddAsync("usernames", username).then( function ( contents) {
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

client.setAsync("numgrades", "0").then( function (results){
	console.log(" [ OK   ] created the number of grades");
}).catch( function (error){
	console.log(" [ ERROR] creating the number of grades");
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
		res.status(400).send('missing something when trying to add a grade to grades');
	} else {
		client.incrAsync("numgrades").then( function (vals) {
			//hget username worked
			var id;
			id = vals;
			client.hmsetAsync(id,["type", type, "max", max, "grade", grade, "_ref","/grades/"+id]).then( function ( contents){
				console.log(" [ "+id+ " ] getting numgrades from database");
				res.status(200).json({"username":username, "type": type, "max":max, "grade":grade, "_ref":"/grades/"+id});
			}).catch( function (error){
			});
		}).catch( function (error) {
			//hget username did not work
			console.log(" [ ERROR] getting numgrades from database");
		});	
	}
});

// get a grade in the database
app.get('/grades/:gradeid', authr, function ( req, res) {
	var gradeid = req.params.gradeid;
	client.hgetallAsync(gradeid).then( function (contents){
		console.log(contents);
		res.status(200).json(contents);
	}).catch( function( error){
	});
	console.log('get a grade');
});

// modifies a grade in the database
app.patch('/grades/:gradeid', authr, function ( req, res) {
	var gradeid = req.params.gradeid,
	max = req.body.max,
	grade = req.body.grade,
	type = req.body.type,
	username = req.body.username,
	update = {};
	if( max){
		update["max"] = max;	
	}
       	if( grade){
		update["grade"] = grade;	
	}
	if( type){
		update["type"] = type;	
	}
	if( username){
		update["username"] = username;	
	}
	console.log(update);
	client.hmsetAsync( gradeid, update).then( function (contents){
		res.status(200).json(JSON.stringify(update));
	}).catch( function( error){
		console.log(" [ ERROR ] patching grade");
	});
});

// deletes a grade in the database
app.delete('/grades/:gradeid', authr, function ( req, res) {
	console.log('deleting a grade in the database');
	res.send('hella world!');
});

// returns a list of all the grades
app.get('/grades', authr, function ( req, res) {

	var all_grades = {};
	client.getAsync("numgrades").then( function (contents) {
		for(var i = 1; i <= contents; i++){
			client.hgetallAsync(i).then( function (json_data){
				all_grades[i] = json_data;
			}).catch( function (error){
				console.log('[ ' + error + ' ] getting grade contents');
			});
		}
	}).catch( function (error){
		console.log('[ '+error+' ] getting num of grades ');
	});
	var uname = req.params.username,
	type = req.params.type;
	if(Object.keys(all_grades).length < 1){
		res.status(200).send([]);
		return;
	}
	console.log( uname + " XxX " + type);
	if(!uname && !type){
		res.status(200).json(JSON.stringify(all_grades));
	}
	var queried=[];
	if(uname && type){
		for(var i = 0; i < all_grades.length(); i++){
			if( all_grades[i].username == uname && all_grades[i].type == type){
				queried.push(all_grades[i]);
			}
		} 
		res.status(200).json(JSON.stringify(queried));
	}
	if(uname){
	}
	if(type){
	}
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

