"use strict";

(function(ENV) {

/*

  Javascript State Machine Library - https://github.com/jakesgordon/javascript-state-machine

  Copyright (c) 2012, 2013 Jake Gordon and contributors
  Released under the MIT license - https://github.com/jakesgordon/javascript-state-machine/blob/master/LICENSE

*/
var StateMachine = {

//---------------------------------------------------------------------------

VERSION: "2.2.0",

//---------------------------------------------------------------------------

Result: {
  SUCCEEDED:    1, // the event transitioned successfully from one state to another
  NOTRANSITION: 2, // the event was successfull but no state transition was necessary
  CANCELLED:    3, // the event was cancelled by the caller in a beforeEvent callback
  PENDING:      4  // the event is asynchronous and the caller is in control of when the transition occurs
},

Error: {
  INVALID_TRANSITION: 100, // caller tried to fire an event that was innapropriate in the current state
  PENDING_TRANSITION: 200, // caller tried to fire an event while an async transition was still pending
  INVALID_CALLBACK:   300 // caller provided callback function threw an exception
},

WILDCARD: '*',
ASYNC: 'async',

//---------------------------------------------------------------------------

create: function(cfg, target) {

  var initial   = (typeof cfg.initial == 'string') ? { state: cfg.initial } : cfg.initial; // allow for a simple string, or an object with { state: 'foo', event: 'setup', defer: true|false }
  var terminal  = cfg.terminal || cfg['final'];
  var fsm       = target || cfg.target  || {};
  var events    = cfg.events || [];
  var callbacks = cfg.callbacks || {};
  var map       = {};

  var add = function(e) {
	var from = (e.from instanceof Array) ? e.from : (e.from ? [e.from] : [StateMachine.WILDCARD]); // allow 'wildcard' transition if 'from' is not specified
	map[e.name] = map[e.name] || {};
	for (var n = 0 ; n < from.length ; n++)
	  map[e.name][from[n]] = e.to || from[n]; // allow no-op transition if 'to' is not specified
  };

  if (initial) {
	initial.event = initial.event || 'startup';
	add({ name: initial.event, from: 'none', to: initial.state });
  }

  for(var n = 0 ; n < events.length ; n++)
	add(events[n]);

  for(var name in map) {
	if (map.hasOwnProperty(name))
	  fsm[name] = StateMachine.buildEvent(name, map[name]);
  }

  for(var name in callbacks) {
	if (callbacks.hasOwnProperty(name))
	  fsm[name] = callbacks[name]
  }

  fsm.current = 'none';
  fsm.is      = function(state) { return (state instanceof Array) ? (state.indexOf(this.current) >= 0) : (this.current === state); };
  fsm.can     = function(event) { return !this.transition && (map[event].hasOwnProperty(this.current) || map[event].hasOwnProperty(StateMachine.WILDCARD)); }
  fsm.cannot  = function(event) { return !this.can(event); };
  fsm.error   = cfg.error || function(name, from, to, args, error, msg, e) { throw e || msg; }; // default behavior when something unexpected happens is to throw an exception, but caller can override this behavior if desired (see github issue #3 and #17)

  fsm.isFinished = function() { return this.is(terminal); };

  if (initial && !initial.defer)
	fsm[initial.event]();

  return fsm;

},

//===========================================================================

doCallback: function(fsm, func, name, from, to, args) {
  if (func) {
	try {
	  return func.apply(fsm, [name, from, to].concat(args));
	}
	catch(e) {
	  return fsm.error(name, from, to, args, StateMachine.Error.INVALID_CALLBACK, "an exception occurred in a caller-provided callback function", e);
	}
  }
},

beforeAnyEvent:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onbeforeevent'],                       name, from, to, args); },
afterAnyEvent:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onafterevent'] || fsm['onevent'],      name, from, to, args); },
leaveAnyState:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onleavestate'],                        name, from, to, args); },
enterAnyState:   function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onenterstate'] || fsm['onstate'],      name, from, to, args); },
changeState:     function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onchangestate'],                       name, from, to, args); },

beforeThisEvent: function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onbefore' + name],                     name, from, to, args); },
afterThisEvent:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onafter'  + name] || fsm['on' + name], name, from, to, args); },
leaveThisState:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onleave'  + from],                     name, from, to, args); },
enterThisState:  function(fsm, name, from, to, args) { return StateMachine.doCallback(fsm, fsm['onenter'  + to]   || fsm['on' + to],   name, from, to, args); },

beforeEvent: function(fsm, name, from, to, args) {
  if ((false === StateMachine.beforeThisEvent(fsm, name, from, to, args)) ||
	  (false === StateMachine.beforeAnyEvent( fsm, name, from, to, args)))
	return false;
},

afterEvent: function(fsm, name, from, to, args) {
  StateMachine.afterThisEvent(fsm, name, from, to, args);
  StateMachine.afterAnyEvent( fsm, name, from, to, args);
},

leaveState: function(fsm, name, from, to, args) {
  var specific = StateMachine.leaveThisState(fsm, name, from, to, args),
	  general  = StateMachine.leaveAnyState( fsm, name, from, to, args);
  if ((false === specific) || (false === general))
	return false;
  else if ((StateMachine.ASYNC === specific) || (StateMachine.ASYNC === general))
	return StateMachine.ASYNC;
},

enterState: function(fsm, name, from, to, args) {
  StateMachine.enterThisState(fsm, name, from, to, args);
  StateMachine.enterAnyState( fsm, name, from, to, args);
},

//===========================================================================

buildEvent: function(name, map) {
  return function() {

	var from  = this.current;
	var to    = map[from] || map[StateMachine.WILDCARD] || from;
	var args  = Array.prototype.slice.call(arguments); // turn arguments into pure array

	if (this.transition)
	  return this.error(name, from, to, args, StateMachine.Error.PENDING_TRANSITION, "event " + name + " inappropriate because previous transition did not complete");

	if (this.cannot(name))
	  return this.error(name, from, to, args, StateMachine.Error.INVALID_TRANSITION, "event " + name + " inappropriate in current state " + this.current);

	if (false === StateMachine.beforeEvent(this, name, from, to, args))
	  return StateMachine.Result.CANCELLED;

	if (from === to) {
	  StateMachine.afterEvent(this, name, from, to, args);
	  return StateMachine.Result.NOTRANSITION;
	}

	// prepare a transition method for use EITHER lower down, or by caller if they want an async transition (indicated by an ASYNC return value from leaveState)
	var fsm = this;
	this.transition = function() {
	  fsm.transition = null; // this method should only ever be called once
	  fsm.current = to;
	  StateMachine.enterState( fsm, name, from, to, args);
	  StateMachine.changeState(fsm, name, from, to, args);
	  StateMachine.afterEvent( fsm, name, from, to, args);
	  return StateMachine.Result.SUCCEEDED;
	};
	this.transition.cancel = function() { // provide a way for caller to cancel async transition if desired (issue #22)
	  fsm.transition = null;
	  StateMachine.afterEvent(fsm, name, from, to, args);
	}

	var leave = StateMachine.leaveState(this, name, from, to, args);
	if (false === leave) {
	  this.transition = null;
	  return StateMachine.Result.CANCELLED;
	}
	else if (StateMachine.ASYNC === leave) {
	  return StateMachine.Result.PENDING;
	}
	else {
	  if (this.transition) // need to check in case user manually called transition() but forgot to return StateMachine.ASYNC
		return this.transition();
	}

  };
}

}; // StateMachine

var ARR_SLICE = Array.prototype.slice;

var PROC_ARGS = function(args) {
	var _args = ARR_SLICE.call(args);
	if(typeof _args[0] === "function") {
		return _args;
	} 
	return args[0];
};

function Builder(buffer, iterator) {
	this.start = function(newArgs) {
	
		//	A previously terminated herder can be restarted.
		//
		this._stop = null;
		
		if(newArgs) {
			buffer = PROC_ARGS(arguments);
		}
		
		buffer = buffer || [];

		var $this 	= this;
		var runner;
		
		var ops	= this._actor || [function(it, idx, res, next) {
			if(typeof it === "function") {
				return it.call($this, idx, res, next);
			}
			next(it);
		}];
		
		var	results	= {
		
			errored	: false,
			buffer	: buffer,
			last	: null,
			grouped	: [],
			actual	: [],
			startMs	: new Date().getTime(),
			api		: function() {
				var $this = this;
				return {
					error : function(err) {
						if(err) {
							return $this.errored = err;
						}
						return $this.errored;
					},
					last : function() {
						return $this.last;
					},
					grouped : function() {
						return $this.grouped;
					},
					stack : function() {
						var grp = $this.grouped;
						var out = [];
						var x 	= 0;
						
						while(x < grp.length) {
							out = out.concat(grp[x++]);
						}
						
						return out;
					},
					actual : function(idx, v) {
						if(idx === void 0) {
							return $this.actual;
						} else if(!v) {
							return $this.actual.push(idx);
						}
						
						$this.actual[idx] = v;
					},
					runtime : function() {
						return {
							start 	: $this.startMs,
							end		: $this.endMs,
							total	: $this.endMs - $this.startMs
						};
					},
					push : function(v) {
						v = typeof v !== "string" ? [v] : v;
						$this.buffer = $this.buffer.concat(v);
					},
					length : function() {
						return $this.buffer.length;
					}
				};
			}
		};
		
		//	Send #data #error and #timeout events
		//
		//	Iterators should run this on each iteration after all updates have occurred
		//
		var reportEvents = function(idx, res) {
			res.endMs = new Date().getTime();
			$this.emit("data", res.api(), idx);
			res.errored && $this.emit("error", res.api(), idx);
			$this._timeout && ((res.endMs - res.startMs) > $this._timeout) && $this.emit("timeout", res.api(), idx);
			$this.state && $this.state.isFinished() && $this.emit("finished", res.api(), idx);
		};
		
		var forceAsync = function(f, a) {
			(ENV.setImmediate || setTimeout)(function() {
				console.log("---> FORCE --->");
				f(a);
			}, 0);
		};

		(runner = function(runs) {
			if(runs === ops.length) {
				return $this.emit("end", results.api());
			}
			
			var fn 	= ops[runs];			
			results.grouped[runs] = [];

			iterator($this, results, runner, runs, fn, reportEvents, forceAsync);
		})(0);
		
		return this;
	};
};

Builder.prototype = new function() {
	this.addState = function(smDef) {
	
		var evs = smDef.events;
		
		if(!evs) {
			throw "Invalid state machine definition";
		}
		
		var state = this.state = StateMachine.create(smDef);
		!state.initial && state.startup();
		
		var len 	= evs.length;
		var $this 	= this;
		var evname;
		
		var emit = function(name, args) {
			$this.emit.apply($this, [name].concat(ARR_SLICE.call(args))); 
		};
				
		//	Set state event emits
		//
		state.onbeforeevent = function(ev, from, to) {
			emit("before" + ev, arguments);
		};
		state.onafterevent = function(ev, from, to) {
			emit("after" + ev, arguments);
			emit(ev, arguments);
		};
		state.onenterstate = function(ev, from, to) {
			emit("enter" + to, arguments);
		};
		state.onleavestate = function(ev, from, to) {
			emit("leave" + from, arguments);
		};
		
		return this;
	};
	
	this.actor = function() {
		this._actor = PROC_ARGS(arguments);
		return this;
	};
	
	this.context = function(ctxt) {
		if(ctxt !== void 0) {
			this._context = ctxt;
			return this;
		}
		return this._context;
	};
	
	this.timeout = function(ms) {
		this._timeout = ms;
		return this;
	};

	this.on = function(event, fn) {
		this._events = this._events || {};
		this._events[event] = this._events[event] || [];
		this._events[event].push(fn);
		return this;
	};
	
	this.off = function(event) {
		if(this._events && this._events[event]) {
			this._events[event].length = 0;
		}
		return this;
	};
	
	this.async = function() {
		this._async = true;
		return this;
	};
	
	this.emit = function(event) {
		var args = ARR_SLICE.call(arguments, 1);
		if(!this._events || !this._events[event]) {
			return;
		}

		var len = this._events[event].length;
		var x 	= 0;
		
		while(x < len) {
			this._events[event][x].apply(this, args);
			x++;
		}
		return this;
	};
	
	this.stop = function() {
		this._stop = 1;
		return this;
	};
};

var facade = {
	serial : function() {
		return new Builder(PROC_ARGS(arguments), function($this, results, runner, runs, fn, reportEvents, forceAsync) {
			var iter;
			(iter = function(idx) {
				fn.call($this, results.buffer[idx], idx, results.api(), function(res) {
					if($this._stop) {
						++$this._stop === 2 && $this.emit("stop", results.api(), idx);
						return;
					}
					results.last = res;
					results.grouped[runs].push(res);
					res !== void 0 && results.actual.push(res);
					
					reportEvents(idx, results);

					++idx < results.buffer.length 
					? $this._async 
						? forceAsync(iter, idx) 
						: iter(idx) 
					: runner(++runs);
				});
			})(0);	
		});
	},
	
	parallel : function() {
		return new Builder(PROC_ARGS(arguments), function($this, results, runner, runs, fn, reportEvents, forceAsync) {
			var cnt = 0;
			var iter;
			(iter = function(idx) {
				fn.call($this, results.buffer[idx], idx, results.api(), function(res) {			
					if($this._stop) {
						++$this._stop === 2 && $this.emit("stop", results.api(), idx);
						return;
					}

					results.last = res;
					results.grouped[runs][idx] = res;
					if(res !== void 0) {
						results.actual[idx] = res;
					}
					
					reportEvents(idx, results);
					
					++cnt === results.buffer.length && runner(++runs);
				});
				(idx +1) < results.buffer.length && ($this._async ? forceAsync(iter, idx +1) : iter(idx +1));
			})(0);
		});
	}
};

if(typeof exports === 'object' && exports) {
    exports.serial 		= facade.serial;
    exports.parallel 	= facade.parallel;
} else {
    window.herder = facade;
}

})(this);