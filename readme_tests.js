if(typeof exports === 'object' && exports) {
    var herder = require("./herder.js");
} 

herder
.serial([1,2,3,4,5])
.actor(
	function(it, idx, res, next) {
		setTimeout(function() {
			next(it * 2);
		}, (Math.random() * 1000));
	}
)
.on("data", function(data) {
	console.log(data.last()); 
})
.on("end", function(result) {
	console.log(result.stack());
})
.start();

herder
.serial(
	function(idx, res, next) {
		setTimeout(function() {
			console.log("serial A");
			next(1);
		}, Math.random() * 100);
	},
	function(idx, res, next) {
		setTimeout(function() {
			console.log("serial B");
			next(1);
		}, Math.random() * 100);
	},
	function(idx, res, next) {
		setTimeout(function() {
			console.log("serial C");
			next(1);
		}, Math.random() * 100);
	}
)
.start()

herder
.parallel(
	function(idx, res, next) {
		setTimeout(function() {
			console.log("par A");
			next(1);
		}, Math.random() * 100);
	},
	function(idx, res, next) {
		setTimeout(function() {
			console.log("par B");
			next(1);
		}, Math.random() * 100);
	},
	function(idx, res, next) {
		setTimeout(function() {
			console.log("par C");
			next(1);
		}, Math.random() * 100);
	}
)
.on("end", function() {
	console.log("TAMED PARALLEL IS DONE");
})
.start()

var map = herder
.parallel()
.actor(function(it, idx, res, next) {
	next(it*2);
})
.on("end", function(res) {
	console.log(res.stack());
})
.start([1,2,3,4,5])

var reduce = herder
.serial()
.actor(function(it, idx, res, next) {
	next(res.last() ? res.last() + it : it);
})
.on("end", function(res) {
	console.log(res.last());
});

reduce
.start([10,10,10]);

reduce
.start(["a","b","c"]);

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

map
.actor(function(it, idx, res, next) {
	res.error(true);
	next(it * 2);
})
.start([1,2,3,4,5]);

map
.start([10,20,30,40,50]);

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

map
.actor(function(it, idx, res, next) {
	if(res.length() < 20) {
		res.push(parseInt(Math.random() * 1000));
	}	
	next(it * 2);
})
.start([1,2,3,4,5]);

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
})
.on("openTag", function() {
	console.log("OPEN TAG EVENT....");
})
.on("enteropen", function() {
	console.log("ENTER OPEN STATE...");
})
.on("leaveopen", function() {
	console.log("LEAVE OPEN STATE...");
})
.start(['<html>','<div>','hello','</div>','</html>']);

herder
.serial()
.addState({
  initial	: 'none',
  terminal	: 'done',
  events: [
	{ name: 'myCompleteEvent',  	from: 'none',  	to: 'done' }
]})
.actor(
	function() {
		this.state.myCompleteEvent();
	}
)
.on("myCompleteEvent", function(res) {
	console.log("COMPLETE EVENT");
})
.on("enterdone", function() {
	console.log("ENTER DONE STATE");
})
.start();

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
		return this.state.accepted(creds);
	}
	this.state.denied(creds);
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
.start(function(idx, res, next) {
	this.state.candidate({
		username	: "bobloblaw",
		password	: "safe!"
	});
	next();
})

setTimeout(function() {
	login.start(function() {
		
		//this.state.accepted();
		
		// 	Error: event accepted inappropriate in current state confirmed
	});
}, 100);

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