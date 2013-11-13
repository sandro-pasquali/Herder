Herder
------

This library allows you to create machines that process a list of instructions using an optional list of processors (called "actors"). 

Actors receive the current result set. Actors can be invoked serially or in parallel. 

Machines are started using the `start` method. Pass an `Array` to `start`, which array the actors will act upon.

The machines are evented, such that a `data` event is emitted on each iteration through the instruction list, to which is made available the current result set. When the machine is finished it emits `end`.  

Additionally, the machine can be transformed into a state machine, where state change events are programmable.

Because machines maintain their last state, they can function like Promises, in that one may create a machine and pass it around while it is running. Once it has run, it's results remain available. If it is restarted, your handlers will receive the new data. A machine is a realtime interface to some aspect of your application state. 

Herder is also a straightforward nested callback taming tool.

Flattening function calls and executing serially:

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
	//	serial data last: 2 
	//	serial data last: 4 
	//	serial data last: 6 
	//	serial data last: 8 
	//	serial data last: 10 
	//	serial data last: 1 
	//	serial data last: 0 
	//	serial data last: 1
	//	serial data last: 0
	//	serial data last: 1
	//	FULL SERIAL RESULT OBJECT
	//	[2, 4, 6, 8, 10, 1, 0, 1, 0, 1] 

Flattening function calls and executing in parallel:

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
	.start();
	//	parallel data idx: 3 last: 8 
	//	parallel data idx: 4 last: 10
	//	parallel data idx: 0 last: 2
	//	parallel data idx: 2 last: 6
	//	parallel data idx: 1 last: 4
	//	parallel data idx: 2 last: 1 
	//	parallel data idx: 0 last: 1
	//	parallel data idx: 1 last: 0 
	//	parallel data idx: 3 last: 0 
	//	parallel data idx: 4 last: 1
	//	FULL PARALLEL RESULT OBJECT
	//	[2, 4, 6, 8, 10, 1, 0, 1, 0, 1] 
	
A `map` machine is easy to create:

	var mapper = herder
	.parallel([1,3,5,7,9])
	.on("result", function() {
		console.log("MAP -> " + this.results.stack());
	})
	.actor(function(it, idx, next) {
		next(it * 2);
	})
	.start();
	
	//	MAP -> 2,6,10,14,18 
	
Your new `mapper` machine can be re-used:

	mapper.start([1,2,3,4,5]);
	//	MAP -> 1,2,3,4,5 
	
	mapper.start([10,20,30,40,50]);
	//	MAP -> 10,20,30,40,50

Machines can be re-used, redefined, or take a new list:

	mapper
	.actor(function(it, idx, next) {
		next(it.toUpperCase());
	})
	.start(["foo","bar"]);
	//	MAP -> FOO,BAR

Machines can throw errors, and (optionally) can be stopped:

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

Machine events have access to the result object, so purely evented machines are possible, without actors. Simply update `results` on `data` events:

	var eventedMap = herder
	.parallel()
	.on("data", function(idx) {
		this.results.actual(10 * this.results.last());
	})
	.on("result", function() {
		console.log("PURELY EVENTED MAP -> " + this.results.actual());
	});
	
	eventedMap.start([1,2,3,4,5]);
	//	PURELY EVENTED MAP -> 10,20,30,40,50 

	eventedMap.start([6,7,8,9,10]);
	//	PURELY EVENTED MAP -> 60,70,80,90,100 

You can create a `reduce` method:

	var reducer = herder
	.serial()
	.actor(function(it, idx, next) {
		next(this.results.last() ? this.results.last() + it : it);
	})
	.on("result", function() {
		console.log("REDUCED");
		console.log(this.results.last());
	});
	
	reducer
	.start([10,10,10]);
	//	REDUCED -> 30 
	
	reducer
	.start(["a","b","c"]);
	//	REDUCED -> abc 
	
Or a `filter` (see [ResultObject](#ResultObject)):

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
	//	FILTERED EVEN -> 2,4,6,8

	.start([234,1,777,4,6,8,2001])
	//	FILTERED EVEN -> 234,4,6,8 

Machines can be given a `context` to work with. Here we implement a `find` (or, `some`) machine that matches its instruction list against a given context value:

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
	
	//	cat EXISTS AT -> 2 

Note how a Machine can be stopped at any time. In the `find` method above, we are stopping the moment a match is found (at least one target item exists). Here we use this method to implement `every`:

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
	//	EVERY: true
	
	every
	.start([2,2,3,2,2])
	//	EVERY: false

Note that a stopped machine can always be restarted with `start`.

The instruction list can be pushed onto during iteration, such that an initial list can be dynamically augmented. Here we keep adding to the original buffer passed to `start` until that buffer reaches 20 elements:

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
	
	//	The original array doubled, concat doubled randomly pushed values:
	//	HOT PUSH: 2,4,6,8,10,128,14,184,66,40,124,114,32,126,98,30,100,150,156,154 <- length: 20
	
A total running time (milliseconds) can be set using `timeout`. Here we set it for `200` milliseconds. As our actors will (likely) consume more than 200 milliseconds of time, this machine should time out:

	herder
	.serial()
	.timeout(200)
	.on("timeout", function(idx) {
		console.log("TIMED OUT AT INDEX: " + idx, "WITH RESULTS: " + this.results.stack());
	})
	.on("result", function() {
		console.log("This only executes if timeout is NOT flagged.");
	})
	.actor(function(it, idx, next) {
		setTimeout(next, Math.floor(Math.random() * 100), it);
	})
	.start([11,22,33,44,55,66,77,88,99,1010]);

Try changing the above `timeout` argument to `10000`.

Errors can be flagged:

	herder
	.parallel()
	.actor(function(it, idx, res, next) {
		next(res.error("Boo"));
	})
	.on("error", function(res, idx) {
		console.log("!!!!!!!!!ERRORED!!!!!!!!!");
		console.log(res.error());
	})
	.start()
	
Note that you are passing an error state on to the next iteration, at which point it can be handled. The goal of `error` is to indicate to other actors that an error has occurred upstream, which *may or may not* matter, depending on the machine's purpose. In other words, flagging an error does *not* automatically stop the machine -- use `stop` explicitly if that is needed. 

If the error indicates an *exception* you should `throw` instead.

Asynchronicity is expected at the functional level -- your actors (functions) are making asynchronous calls. However, sometimes you will want a long operation (such as iterating a very long list) to be non blocking, especially in a NodeJS environment. You can force the machine to yield to the javascript execution context's event loop *on each iteration* with `async`:

	.async()
	
The cases where this would be necessary are very rare: you probably want function-level async.

<a id="StateMachine"></a>
State Machine
-------------

To create a state machine, pass a definition object to `addState` (see [StateMachine](#StateMachine)):

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

As you can see, multiple `from` states are possible, sent as an array.

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

<a id="ResultObject"></a>
Result Object
-------------




