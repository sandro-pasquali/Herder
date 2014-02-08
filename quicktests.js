if(typeof exports === 'object' && exports) {
    var herder = require("./herder.js");
} 

//	data store methods
//

//
//	set/get
//
var h1 = herder.serial().set("foo.bar", "baz");
console.log("set/get (should be `baz`): ", h1.get("foo.bar"));

//
//	push
//
h1
.set('arrale', [1,2,3])
.push('arrale', 44, 55, 66)

console.log(".push (should be [1,2,3,44,55,66]): ", h1.get('arrale'));

//	
//	pop
//
console.log(".pop get val (should be 66): ", h1.pop('arrale'));
console.log(".pop check orig (should be [1,2,3,44,55]): ", h1.get('arrale'));

//
//	unshift
//
h1.unshift('arrale', 'a', 'b');
console.log(".unshift (should be ['a','b',1,2,3,44,55]): ", h1.get('arrale'));

//
//	shift
//
console.log(".shift get val (should be 'a'): ", h1.shift('arrale'));
console.log(".shift check orig (should be ['b',1,2,3,44,55]): ", h1.get('arrale'));

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
.on("result", function() {
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
.on("result", function() {
	console.log("FULL PARALLEL RESULT OBJECT");
	console.log(this.results.stack());
})
.start()

//
//	MAP
//
var mapper = herder
.parallel([1,3,5,7,9])
.on("result", function() {
	console.log("MAP -> " + this.results.stack());
	console.log(this.results.stats())
})
.actor(function(it, idx, next) {
	next(it * 2);
})
.start();

mapper.start([1,2,3,4,5]);
mapper.start([10,20,30,40,50]);


mapper
.actor(function(it, idx, next) {
	next(it.toUpperCase());
})
.start(["foo","bar"]);

mapper
.on("error", function() {		
	console.log("MAP ERRORED...");
	console.log(this.results.error());
	this.stop();
})
.on("stop", function() {
	console.log("MAP STOPPED...");
	console.log(this.results.stats());
})
.actor(function(it, idx, next) {
	next(this.results.error("Something bad happened"));
})
.start([1,2])

var eventedMap = herder
.parallel()
.on("data", function(idx) {
	this.results.actual(10 * this.results.last());
})
.on("result", function() {
	console.log("PURELY EVENTED MAP -> " + this.results.actual());
});

eventedMap.start([1,2,3,4,5]);
eventedMap.start([6,7,8,9,10]);

//
//	REDUCE
//
var reducer = herder
.serial()
.actor(function(it, idx, next) {
	next(this.results.last() ? this.results.last() + it : it);
})
.on("result", function() {
	console.log("REDUCED -> " + this.results.last());
});

reducer
.start([10,10,10]);

reducer
.start(["a","b","c"]);

//	
//	FILTER
//
herder
.parallel()
.actor(function(it, idx, next) {
	it & 1 || this.results.actual(it);
	next();
})
.on("result", function() {
	console.log("FILTERED EVEN -> " + this.results.actual());
})
.start([1,2,3,4,5,6,7,8,9])
.start([234,1,777,4,6,8,2001])

//	
//	FIND/SOME
//
var somePet = herder
.parallel()
.actor(function(it, idx, next) {
	if(this.context() !== it) {
		return next();
	}
	this.stop();
	return this.emit("result", idx, it);
})
.context("cat")
.on("result", function(idx, item) {
	console.log(item + " EXISTS AT -> " + idx);
})
.start(["fish","dog","cat","turtle"])

//	
//	EVERY
//
var every = herder
.parallel()
.actor(function(it, idx, next) {
	it !== this.context() && this.stop();
	next();
});

every
.context(2)
.on("stop", function(idx) {
	console.log("EVERY: false");
})
.on("result", function(bool) {
	console.log("EVERY: true");
})
.start([2,2,2,2])

every
.start([2,2,3,2,2])

//
//	Hot push to live buffer
//
herder
.parallel()
.actor(function(it, idx, next) {
	if(this.buffer.length() < 20) {
		this.buffer.push(Math.floor(Math.random() * 100));
	}	
	next(it * 2);
})
.on("result", function() {
	console.log("HOT PUSH: " + this.results.stack());
})
.start([1,2,3,4,5]);

//	
//	TIMEOUT
//
herder
.serial()
.timeout(200)
.on("timeout", function(idx) {
	console.log("TIMED OUT AT INDEX: " + idx, "WITH RESULTS: " + this.results.stack());
	console.log(this);
	console.log(this.results.stats())
})
.on("result", function() {
	console.log("This only executes if timeout is NOT flagged.");
})
.actor(function(it, idx, next) {
	setTimeout(next, Math.floor(Math.random() * 100), it);
})

.start([11,22,33,44,55,66,77,88,99,1010])
.start([11,22,33,44,55,66,77,88,99,1010])
.start([11,22,33,44,55,66,77,88,99,1010])


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
.timeout(1)
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
.on("result", function(idx) {
	console.log("RUNNING MACHINES");
	var s = this.results.stack();
	var i;
	var c = 0;
	while(i = s.shift()) {
		console.log("Machine" + ++c + " results: " + i.results.stack())
	}
})
.actor(function(it, idx, next) {
	next(it.start(this.get().shift()));
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

/*

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
.timeout(1)
.start()

*/