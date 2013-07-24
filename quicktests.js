if(typeof exports === 'object' && exports) {
    var herder = require("./herder.js");
} 

//	
//	SERIAL ASYNC
//
herder
.serial([1,2,3,4,5])
.actor(
	function(it, idx, res, next) {
		setTimeout(function() {
			next(it * 2);
		}, (Math.random() * 1000));
	},
	
	function(it, idx, res, next) {
		setTimeout(function() {
			next(it & 1);
		}, (Math.random() * 1000));
	}
)
.on("data", function(data) {
	console.log("serial data last: " + data.last()); 
})
.on("end", function(result) {
	console.log("FULL SERIAL RESULT OBJECT");
	console.log(result.stack());
})
.start();

//	
//	PARALLEL ASYNC
//
herder
.parallel([1,2,3,4,5])
.actor(

	function(it, idx, res, next) {
		setTimeout(function() {
			next(it * 2);
		}, (Math.random() * 1000));
	},
	
	function(it, idx, res, next) {
		setTimeout(function() {
			next(it & 1);
		}, (Math.random() * 1000));
	}
)
.on("data", function(data, idx) {
	console.log("parallel data idx: " + idx + " last: " + data.last());
})
.on("end", function(result) {
	console.log("FULL PARALLEL RESULT OBJECT");
	console.log(result.stack());
})
.start();

//
//	TAMING CALLBACKS
//
herder
.serial(
	function(it, idx, res, next) {
		console.log("A");
		next(1);
	},
	function(it, idx, res, next) {
		console.log("B");
		next(1);
	},
	function(it, idx, res, next) {
		console.log("C");
		next(1);
	},
	function(it, idx, res, next) {
		console.log("D");
		next(1);
	}
)

//	Force asynchronous behavior
//	Observe difference when enabled or disabled
//
//.async()

.start()

.start(
	function(it, idx, res, next) {
		console.log("A1");
		next(2);
	},
	function(it, idx, res, next) {
		console.log("B1");
		next(2);
	}
)

.actor(
	function(it, idx, res, next) {
		next("actor1 got: " + it);
	},
	function(it, idx, res, next) {
		next("actor2 got: " + it);
	},
	function(it, idx, res, next) {
		next("actor3 got: " + it);
	}
)
.on("end", function(res) {
	console.log("MULTISTART RESULTS");
	console.log(res.stack());
})
.start(["fee","fi","fo","fum"])

herder
.parallel(
	function(it, idx, res, next) {
		setTimeout(function() {
			next("first");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, res, next) {
		setTimeout(function() {
			next("second");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, res, next) {
		setTimeout(function() {
			next("third");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, res, next) {
		setTimeout(function() {
			next("fourth");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, res, next) {
		setTimeout(function() {
			next("fifth");
		}, parseInt(Math.random() * 500));
	}
)
.on("data", function(res) {
	console.log("PARALLEL EXEC NEXT:");
	console.log(res.last());
})
.on("end", function(res) {
	console.log("PARALLEL EXEC FINAL:");
	console.log(res.stack());
})
.start()

//	
//	REDUCE
//

var reducer = herder
.serial()
.actor(function(it, idx, res, next) {
	next(res.last() ? res.last() + it : it);
})
.on("end", function(res) {
	console.log("REDUCED");
	console.log(res.last());
});

reducer
.start([10,10,10]);

reducer
.start(["a","b","c"]);

//
//	MAP
//

var map = herder
.parallel()
.on("error", function(res) {		
	console.log("MAP ERRORED...");
	this.stop();
})
.on("stop", function() {
	console.log("MAP TERMINATED...");
})
.on("end", function(res) {
	console.log("MAP");
	console.log(res.stack());
});

map
.actor(function(it, idx, res, next) {
	next(it * 2);
})
.start([1,2,3,4,5]);

map
.start([10,20,30,40,50]);

map
.actor(function(it, idx, res, next) {
	res.error(true);
	next(it * 2);
})
.start([1,2,3,4,5]);

map
.start([10,20,30,40,50]);

map
.actor(function(it, idx, res, next) {
	next(it.toUpperCase());
})
.start(["foo","bar"]);

var eventedMap = herder
.parallel()
.on("data", function(res, idx) {
	res.actual(idx, Math.pow(2, res.last()));
})
.on("end", function(res) {
	console.log("PURELY EVENTED MAP");
	console.log(res.actual());
});

eventedMap.start([1,2,3,4,5]);
eventedMap.start([6,7,8,9,10]);

//	
//	FILTER
//
var evens = herder
.parallel()
.actor(function(it, idx, res, next) {
	it%2 === 0 && res.actual(it);
	next();
})
.on("end", function(res) {
	console.log("FILTERED:");
	console.log(res.actual());
})
.start([1,2,3,4,5,6,7,8,9]);

//	
//	SOME
//
var somePet = herder
.parallel()
.actor(function(it, idx, res, next) {
	if(this.context() === it) {
		this.stop();
		return this.emit("end", res, idx);
	}
	next();
})

somePet
.context("cat")
.on("end", function(res, idx) {
	console.log("SOME PET");
	console.log(idx);
})
.start(["fish","dog","cat","turtle"])

somePet
.context("turtle")
.off("end")
.on("end", function(res, idx) {
	console.log("SOME PET 2");
	console.log(idx);
})
.start()

//
//	EVERY
//
var every = herder
.parallel()
.actor(function(it, idx, res, next) {
	res.actual(it === this.context() ? idx : void 0);
	next();
})
.on("end", function(res) {
	this.emit("result", res.actual().length === res.length());
})

every
.context(2)
.on("result", function(bool) {
	console.log("EVERY");
	console.log(bool);
})
.start([2,2,2,2])

every
.start([2,2,3,2,2])

//
//	FIND
//
var needleFinder = herder
.parallel()
.actor(function(it, idx, res, next) {
	if(it === "needle") {
		console.log("FOUND NEEDLE at index: " + idx);
		return this.stop();
	}
	next();
});

needleFinder
.start(["chicken","egg","needle","haystack"]);

needleFinder
.start(["jack","needle","hill","jill"]);

//	
//	STATE MACHINE
//

herder
.serial()
.addState({
  initial: 'none',
  events: [
	{ name: 'openTag',  	from: ['none','inner','open','closed'],  	to: 'open' },
	{ name: 'closeTag', 	from: ['inner','closed','open'], 			to: 'closed'},
	{ name: 'innerHTML', 	from: ['open','inner','closed'], 			to: 'inner'}
]})
.actor(
	function(it, idx, res, next) {
		if(it.match(/^<\/[^>]+>$/)) {
			this.state.closeTag();
		} else if(it.match(/^<[^>]+>$/)) {
			this.state.openTag();
		} else {
			this.state.innerHTML();
		}
		next(this.state.current);
	}
)
.on("end", function(res) {
	console.log("HTML STATE END");
	console.log(res);
})
.on("openTag", function() {
	console.log("OPEN TAG EVENT....");
	console.log(arguments);
})
.on("enteropen", function() {
	console.log("ENTER OPEN STATE...");
	console.log(arguments);
})
.on("leaveopen", function() {
	console.log("LEAVE OPEN STATE...");
	console.log(arguments);
})
.start(['<html>','<div>','hello','</div>','</html>']);

var login = herder
.serial()
.addState({
  initial: 'none',
  terminal: 'confirmed',
  events: [
	{ name: 'candidate',	from: 'none',						to: 'candidate'},
	{ name: 'accepted', 	from: ['candidate', 'denied'],  	to: 'accepted'},
	{ name: 'denied', 		from: ['candidate','accepted'], 	to: 'denied'},
	{ name: 'confirmed', 	from: 'accepted', 					to: 'confirmed'}
]})
.on("candidate", function(ev, from, to, creds) {
	if(creds.password === "safe!") {
		this.state.accepted(creds);
	}
})
.on("accepted", function(ev, from, to, creds) {
	var serverLoad = 13;
	if(serverLoad < 20) {
		return this.state.confirmed(creds);
	}
	this.state.denied(creds);
})
.on("denied", function(ev, from, to, creds) {
	console.log("DENIED");
	console.log(creds);
	this.stop();
})
.on("confirmed", function(ev, from, to, creds) {
	console.log("CONFIRMED");
	console.log(creds);
})
.on("finished", function(ev, from, to, creds) {
	console.log("FINISHED......");
})
.start(function(it, idx, res, next) {
	this.state.candidate({
		username	: "bobloblaw",
		password	: "safe!"
	});
	next();
})

//	
//	TIMEOUT
//
herder
.parallel()
.timeout(1)
.on("timeout", function() {
	console.log("TIMED OUT");
	console.log(arguments);
})
.actor(function(it, idx, res, next) {
	setTimeout(next, 1000);
})
.start();

//
//	Hot push to live buffer
//
map
.actor(function(it, idx, res, next) {
	if(res.length() < 20) {
		res.push(parseInt(Math.random() * 1000));
	}	
	next(it * 2);
})
.start([1,2,3,4,5]);

herder
.parallel()
.timeout(1)
.on("timeout", function() {
	console.log("TIMED OUT");
	console.log(arguments);
})
.actor(function(it, idx, res, next) {
	setTimeout(next, 1000);
})
.start();

herder
.parallel()
.actor(function(it, idx, res, next) {
	res.error("Boo");
	next();
})
.on("error", function(res, idx) {
	console.log("!!!!!!!!!ERRORED!!!!!!!!!");
	console.log(res.error());
})
.start()


herder
.parallel(function(it, idx, res, next) {
	console.log("HIHIIHIIHHHIIHIIIIHIHIHIIHIIHIHIHI");
	//res.push(it);
})
.timeout(10, true)
.start()

