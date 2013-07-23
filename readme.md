Herder
------

This library allows you to create machines which process a list of instructions using an optional list of processors (called "actors"). 

Actors receive the current result set. Actors can be invoked serially or in parallel. 

The machines are evented, such that a #data event is emitted on each iteration through the instruction list, to which is made available the current result set. When the machine is finished it emits #end.  

Additionally, the machine can be transformed into a true state machine, where state change events are programmable.

Importantly, asynchronous execution is supported, such that an actor must yield (with #next) in order for the iteration to continue.

The following will broadast 2 -> 4 -> 6 -> 8 -> 10 -> [2,4,6,8,10]

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

Herder may be used as a straightforward async method taming tool:

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
	
A #map method is easy to create

	var map = herder
	.parallel()
	.actor(function(it, idx, res, next) {
		next(it*2);
	})
	.on("end", function(res) {
		console.log(res.stack());
	})
	.start([1,2,3,4,5])
	
	//	[ 2, 4, 6, 8, 10 ]

As is a #reduce method:

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
	
	//	30
	
	reduce
	.start(["a","b","c"]);
	
	//	abc
	
Or a #filter (see [ResultObject](#ResultObject)):

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
	
	//	[ 2, 4, 6, 8 ]

Machines can be re-used, redefined, or take a new list:

	map
	.actor(function(it, idx, res, next) {
		res.error(true);
		next(it * 2);
	})
	.start([1,2,3,4,5]);
	// [ 2, 4, 6, 8, 10 ]
	
	map
	.start([10,20,30,40,50]);
	
	// [ 20, 40, 60, 80, 100 ]

Machine events have access to the result object, so purely evented machines are possible:

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

The instruction list can be pushed onto during iteration, such that an initial list can be dynamically augmented:

	map
	.actor(function(it, idx, res, next) {
		if(res.length() < 20) {
			res.push(parseInt(Math.random() * 1000));
		}	
		next(it * 2);
	})
	.start([1,2,3,4,5]);
	
	//	[ 2, 4, 6, 8, 10, ..., n[20] ]
	
A total running time (milliseconds) can be set. Here we set it for one(1) millisecond:

	herder
	.parallel()
	.timeout(1)
	.on("timeout", function() {
		console.log("TIMED OUT");
	})
	.actor(function(it, idx, res, next) {
		setTimeout(next, 1000);
	})
	.start();

The machine can also be stopped, such as when a search is complete:

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
	
	//	FOUND NEEDLE at index: 2
	
	needleFinder
	.start(["jack","needle","hill","jill"]);
	
	//	FOUND NEEDLE at index: 1
	
Note that a stopped machine can always be restarted with #start.

Machines can be given an operating context, which can be any type of value:

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
	
	//	true
	
	every
	.start([2,2,3,2,2])
	
	//	false

To create a state machine, pass a definition object to #addState (see [StateMachine](#StateMachine)):

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
		console.log("OPEN_TAG EVENT....");
	})
	.on("enteropen", function() {
		console.log("ENTER OPEN STATE...");
	})
	.on("leaveopen", function() {
		console.log("LEAVE OPEN STATE...");
	})
	.start(['<html>','<div>','hello','</div>','</html>']);
	
	//	ENTER OPEN STATE...
	//	OPEN_TAG EVENT....
	//	OPEN_TAG EVENT....
	//	LEAVE OPEN STATE...
	//	HTML STATE END

As you can see, multiple #from states are possible, sent as an array.

In addition to setting an initial state, one can also set a terminal state:

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

State machine control flow translates easily to evented models:

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

State machines naturally throw on undefined transitions:

	setTimeout(function() {
		login.start(function() {
			
			this.state.accepted();
			
			// 	Error: event accepted inappropriate in current state confirmed
		});
	}, 100);

The library expects asynchronicity to exist at the functional level -- your actors are making asynchronous calls. However, sometimes you will want a long operation (such as iterating a very long list) to be non blocking, especially in a NodeJS environment. You can force the machine to yield to the javascript execution context's event loop *on each iteration* with #async:

	.async()
	
The cases where this would be necessary are very rare: you probably want function-level async.

<a id="ResultObject"></a>
Result Object
-------------

<a id="StateMachine"></a>
State Machine
-------------


