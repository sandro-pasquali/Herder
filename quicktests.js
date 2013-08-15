if(typeof exports === 'object' && exports) {
    var herder = require("./herder.js");
} 

//	
//	SERIAL ASYNC
//
herder
.serial([1,2,3,4,5])
.actor(
	function(it, idx, next) {
		setTimeout(function() {
			next(it * 2);
		}, (Math.random() * 1000));
	},
	
	function(it, idx, next) {
		setTimeout(function() {
			next(it & 1);
		}, (Math.random() * 1000));
	}
)
.on("data", function() {
	console.log("serial data last: " + this.results.last()); 
})
.on("end", function() {
	console.log("FULL SERIAL RESULT OBJECT");
	console.log(this.results.stack());
})
.start();

//	
//	PARALLEL ASYNC
//
herder
.parallel([1,2,3,4,5])
.actor(

	function(it, idx, next) {
		setTimeout(function() {
			next(it * 2);
		}, (Math.random() * 1000));
	},
	
	function(it, idx, next) {
		setTimeout(function() {
			next(it & 1);
		}, (Math.random() * 1000));
	}
)
.on("data", function(idx) {
	console.log("parallel data idx: " + idx + " last: " + this.results.last());
})
.on("end", function() {
	console.log("FULL PARALLEL RESULT OBJECT");
	console.log(this.results.stack());
})
.start();

//
//	TAMING CALLBACKS
//
herder
.serial(
	function(it, idx, next) {
		console.log("A");
		next(1);
	},
	function(it, idx, next) {
		console.log("B");
		next(1);
	},
	function(it, idx, next) {
		console.log("C");
		next(1);
	},
	function(it, idx, next) {
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
	function(it, idx, next) {
		console.log("A1");
		next(2);
	},
	function(it, idx, next) {
		console.log("B1");
		next(2);
	}
)

.actor(
	function(it, idx, next) {
		next("actor1 got: " + it);
	},
	function(it, idx, next) {
		next("actor2 got: " + it);
	},
	function(it, idx, next) {
		next("actor3 got: " + it);
	}
)
.on("end", function() {
	console.log("MULTISTART RESULTS");
	console.log(this.results.stack());
})
.start(["fee","fi","fo","fum"])

herder
.parallel(
	function(it, idx, next) {
		setTimeout(function() {
			next("first");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, next) {
		setTimeout(function() {
			next("second");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, next) {
		setTimeout(function() {
			next("third");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, next) {
		setTimeout(function() {
			next("fourth");
		}, parseInt(Math.random() * 500));
	},
	function(it, idx, next) {
		setTimeout(function() {
			next("fifth");
		}, parseInt(Math.random() * 500));
	}
)
.on("data", function() {
	console.log("PARALLEL EXEC NEXT:");
	console.log(this.results.last());
})
.on("end", function() {
	console.log("PARALLEL EXEC FINAL:");
	console.log(this.results.stack());
})
.start()

//	
//	REDUCE
//

var reducer = herder
.serial()
.actor(function(it, idx, next) {
	next(this.results.last() ? this.results.last() + it : it);
})
.on("end", function() {
	console.log("REDUCED");
	console.log(this.results.last());
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
.on("error", function() {		
	console.log("MAP ERRORED...");
	this.stop();
})
.on("stop", function() {
	console.log("MAP TERMINATED...");
})
.on("end", function() {
	console.log("MAP");
	console.log(this.results.stack());
});

map
.actor(function(it, idx, next) {
	next(it * 2);
})
.start([1,2,3,4,5]);

map
.start([10,20,30,40,50]);

map
.actor(function(it, idx, next) {
	this.results.error(true);
	next(it * 2);
})
.start([1,2,3,4,5]);

map
.start([10,20,30,40,50]);

map
.actor(function(it, idx, next) {
	next(it.toUpperCase());
})
.start(["foo","bar"]);

var eventedMap = herder
.parallel()
.on("data", function(idx) {
	this.results.actual(idx, Math.pow(2, this.results.last()));
})
.on("end", function() {
	console.log("PURELY EVENTED MAP");
	console.log(this.results.actual());
});

eventedMap.start([1,2,3,4,5]);
eventedMap.start([6,7,8,9,10]);

//	
//	FILTER
//
var evens = herder
.parallel()
.actor(function(it, idx, next) {
	it%2 === 0 && this.results.actual(it);
	next();
})
.on("end", function() {
	console.log("FILTERED:");
	console.log(this.results.actual());
})
.start([1,2,3,4,5,6,7,8,9]);

//	
//	SOME
//
var somePet = herder
.parallel()
.actor(function(it, idx, next) {
	if(this.context() === it) {
		this.stop();
		return this.emit("end", idx);
	}
	next();
})

somePet
.context("cat")
.on("end", function(idx) {
	console.log("SOME PET");
	console.log(idx);
})
.start(["fish","dog","cat","turtle"])

somePet
.context("turtle")
.off("end")
.on("end", function(idx) {
	console.log("SOME PET 2");
	console.log(idx);
})
.start()

//
//	EVERY
//
var every = herder
.parallel()
.actor(function(it, idx, next) {
	this.results.actual(it === this.context() ? idx : void 0);
	next();
})
.on("end", function() {
	this.emit("result", this.results.actual().length === this.buffer.length());
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
.actor(function(it, idx, next) {
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
	function(it, idx, next) {
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
.on("end", function() {
	console.log("HTML STATE END");
	console.log(this.results);
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
.start(function(it, idx, next) {
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
.serial()
.timeout(2000)
.on("timeout", function(idx) {
	console.log("TIMED OUT AT INDEX: " + idx);
})
.actor(function(it, idx, next) {
	setTimeout(next, 1000);
})
.start([1,2,3,4,5,6,7,8,9,10]);

//
//	Hot push to live buffer
//
map
.actor(function(it, idx, next) {
	if(this.buffer.length() < 20) {
		this.buffer.push(parseInt(Math.random() * 1000));
	}	
	next(it * 2);
})
.start([1,2,3,4,5]);

herder
.parallel()
.actor(function(it, idx, next) {
	this.results.error("Boo");
	next();
})
.on("error", function(idx) {
	console.log("!!!!!!!!!ERRORED!!!!!!!!!");
	console.log(this.results.error());
})
.start()


//	Serial makes more sense here.
//
herder
.serial(function(it, idx, next) {
	console.log("ADDING NEW ITERATIONS " + idx);
	var ctx = this.context();
	++ctx;
	if(ctx === 10) {
		this.stop();
	}
	ctx > 0 && this.context(ctx) && this.buffer.push(it);
	next()
})
.on("timeout", function() {
	console.log("<<<<--------------------- timeout");
})
.on("stop", function() {
	console.log("<<<<--------------------- stopped");
})
.context(0)
//.timeout(1)
.start()

var machineA = herder
.parallel()
.actor(function(it, idx, next) {
	console.log("machine A got: " + it);
	next(it * 10);
})

var machineB = herder
.parallel()
.actor(function(it, idx, next) {
	console.log("machine B got: " + it);
	next(it * 100);
})

var machineC = herder
.parallel()
.actor(function(it, idx, next) {
	console.log("machine C got: " + it);
	next(it * 1000);
})

var machineRunner = herder
.parallel()
.on("end", function(idx) {
	console.log("RUNNING MACHINES");
	var s = this.results.stack();
	var i;
	while(i = s.shift()) {
		console.log(i.results.stack())
	}
})
.actor(function(it, idx, next) {
	next(it.start(this.context().shift()));
});


machineRunner
.context([
	[1,2,3],
	[4,5,6],
	[7,8,9]
])
.start(
	machineA, 
	machineB, 
	machineC
)

machineRunner
.context([
	[23,55,88]
])
.start(machineC)

machineRunner
.start(
	machineA,
	machineB,
	machineC
)


