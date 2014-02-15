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
	var a0 = args[0]
	if(Object.prototype.toString.call(args) === '[object Array]') {
		return args;
	}
	if(typeof a0 === "function" || (a0 instanceof Builder)) {
		return ARR_SLICE.call(args);
	} 
	
	return a0 === void 0 ? [] : a0;
};

//	##access
//
//	General accessor for an object.  Will get or set a value on an object.
//
//	@param	{Object}	ob			The object to traverse.
//	@param	{String}	bindpath	A path to follow in the object tree, such as
//									"this.is.a.path". For root, use "" (empty string).
//	@param	{Mixed}		[val]		When setting, send a value.
//
var ACCESS = function(ob, bindpath, val) {

	var props 	= bindpath ? bindpath.split('.') : [];
	var	pL		= props.length;
	var nopath  = bindpath === "";
	var	i 		= 0;
	var	p;

	// 	Setting
	//
	//	Note that requesting a path that does not exist will result in that
	//	path being created. This may or may not be what you want. ie:
	//	{ top: { middle: { bottom: { foo: "bar" }}}}
	//
	//	.set("top.middle.new.path", "value") will create:
	//
	//	{ top: { middle: {
	//						bottom: {...}
	//						new:	{ path: "value" }
	//					 }}}
	//
	if(arguments.length > 2) {

		while(i < (pL -1)) {
			p 	= props[i];
			ob 	= ob[p] = typeof ob[p] === "object" ? ob[p] : {};
			i++;
		}

		//	If #set was called with an empty string as path (ie. the root), simply
		//	update #ob. Otherwise, update at path position.
		//
		if(nopath) {
			ob = val;
		} else {
			ob[props[i]] = val;
		}

		return val;

	// 	Getting
	//
	} else while((ob = ob[props[i]]) && ++i < pL) {};

	return (ob !== void 0 && ob !== null) ? ob : null;
};

function Builder(buffer, iterator) {
	this.start = function(newArgs) {

		buffer = PROC_ARGS(newArgs ? arguments : buffer);

		var $this = this;
		var runner;
		
		$this._stop = undefined;
		
		//	Ensure that there is at least one actor to process #buffer.
		//	If no actor, assign general function to handle two cases:
		//	1. If next buffer item is a function, execute it.
		//	2. If not a function, #next(value of buffer item)
		//
		var ops	= $this._actor = $this._actor || [function(it, idx, next) {
			if(typeof it === "function") {
				return it.call($this, it, idx, next);
			}
			next(it);
		}];
		
		var	results	= {
			buffer	: buffer,
			readable: 0,
			last	: null,
			grouped	: [],
			actual	: [],
			startMs	: new Date().getTime(),
			api		: function() {
				var $local = this;
				return {
					error : function(err) {
						if(err) {
							$local.errored = err;
						}
						return $local.errored;
					},
					last : function() {
						return $local.last;
					},
					grouped : function() {
						return $local.grouped;
					},
					stack : function() {
						var grp = $local.grouped;
						var out = [];
						var x 	= 0;
						
						while(x < grp.length) {
							out = out.concat(grp[x++]);
						}
						
						return out;
					},
					actual : function(idx, v) {
						if(idx === void 0) {
							return $local.actual;
						} 
						if(v === void 0) {
							return $local.actual.push(idx);
						}
						
						$local.actual[idx] = v;
					},
					stats : function() {
						return {
							startMs	: $local.startMs,
							endMs	: $local.endMs,
							runMs	: $local.endMs - $local.startMs,
							timeout	: $this._timeout,
							stopped	: $this._stop
						};
					}
				};
			}
		};
		
		//	Allow the machine to access results
		//
		$this.results = results.api();
		
		//	Buffer interface
		//
		$this.buffer = {
			push : function(v) {
				if(v !== void 0) {
					results.buffer = results.buffer.concat(v);
				}
			},
			length : function() {
				return results.buffer.length;
			}
		};
		
		//	Send #data #error and #timeout events
		//
		//	Iterators should run this on each iteration after all updates have occurred
		//
		var reportEvents = function(idx, res) {
		
			res.endMs = new Date().getTime();
			
			if($this._timeout && ((res.endMs - res.startMs) > $this._timeout)) { 
				$this.stop();
				$this.emit("timeout", idx);
			}
							
			$this.emit("data", idx);
			
			if($this._stop) {
				++$this._stop === 2 && $this.emit("stop", idx);
				return false;
			} else {
				res.errored && $this.emit("error", idx);			
			}
			
			$this.state 
			&& $this.state.isFinished() 
			&& $this.emit("finished", idx);
			
			return true;
		};
		
		var forceAsync = function(f, a) {
			(ENV.setImmediate || setTimeout)(function() {
				f(a);
			}, 0);
		};

		(runner = function(runs) {
			if(runs >= ops.length) {
				$this.stop();
				return $this.emit("result", runs);
			}
	
			results.grouped[runs] = [];
			
			iterator($this, results, runner, runs, ops[runs], reportEvents, forceAsync);
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
		return this;
	};
	
	//	##set
	//
	this.set = function(k, v) {
		this._context = this._context || {};
		ACCESS(this._context, k, v);
		
		return this;
	};
	
	//	##get
	//	
	//	@param	{String}	[k]	The path to the node to fetch. If no arguments
	//							are sent, #get returns the full #_context.
	//
	this.get = function(k) {
		if(!k) {
			return this._context;
		}
		return ACCESS(this._context || {}, k);
	};
	
	//	##getset
	//
	//	Sets new value, and returns old value.
	//
	//	@param 	{String} 	k 	The path to the key
	//	@param	{Mixed}		v	The value to set at key
	//
	this.getset = function(k, v) {
		var old = this.get(k);
		this.set(k, v);
		
		return old;
	};
	
	//	##push
	//
	//	If the target node is not an array, an array will be created.
	//
	this.push = function(k) {
	
		var adding 	= ARR_SLICE.call(arguments, 1);
		var cur		= this.get(k);
		
		cur = (cur instanceof Array) ? cur : [];
		cur = cur.concat(adding);
		
		this.set(k, cur);

		return cur.length;
	};
	
	//	##pop
	//
	this.pop = function(k) {

		var cur	= this.get(k);
		
		if(cur instanceof Array) {
			return cur.pop();
		}
		
		return null;
	};
	
	//	##unshift
	//
	//	If the target node is not an array, an array will be created.
	//
	this.unshift = function(k) {
	
		var adding 	= ARR_SLICE.call(arguments, 1);
		var cur		= this.get(k);
		
		cur = (cur instanceof Array) ? cur : [];
		cur = adding.concat(cur);
		
		this.set(k, cur);
		
		return cur.length;
	};
	
	//	##shift
	//
	this.shift = function(k) {

		var cur	= this.get(k);
		
		if(cur instanceof Array) {
			return cur.shift();
		}
		
		return null;
	};
	
	this.timeout = function(ms) {
		this._timeout = ms;
		
		return this;
	};

	this.on = function(event, fn) {
		var evs = this._events = this._events || {};
		evs[event] = evs[event] || [];
		evs[event].push(fn);
		
		if(evs[event].length === 11) {
			console.warn('More than 10 listeners are bound to `' + event + '`. You may want to investigate this.');
		}
		
		return this;
	};
	
	this.off = function(event, fn) {
		var evs = this._events;
		if(evs) {
			evs[event] = evs[event].filter(function(efn) {
				return efn !== fn;
			});
		}
		return this;
	};
	
	this.once = function(event, fn) {
		var _this = this;
		var f = function() {
			fn.apply(this, ARR_SLICE.call(arguments));
			_this.off(event, f);
		};
		
		_this.on(event, f);
		
		return _this;
	};
	
	this.async = function() {
		this._async = true;
		return this;
	};
	
	this.emit = function(event) {
		var args 	= ARR_SLICE.call(arguments, 1);
		var _this	= this;
		var evs		= _this._events;
		
		if(!evs || !evs[event]) {
			return _this;
		}

		evs[event].forEach(function(fn) {
			fn.apply(_this, args);
		});

		return _this;
	};
	
	this.stop = function() {
		if(!this._stop) {
			this._stop = 1;
		}
		return this;
	};
	
	//	##override
	//	
	//	Replaces method in current herder instance with a new handler.
	//	If method does not exist, it is created.
	//	The replaced method is preserved, and can be accessed via __name__
	//
	//	@param	{String}	name	Name of the method to override in this instance of herder
	//	@param	{Function}	fn		The new method
	//
	this.override = function(name, fn) {
	
		if(name && fn) {
			if(this[name]) {
				this['__' + name + '__'] = this[name];
			}
			this[name] = fn;
		}

		return this;
	}
};

var facade = {
	serial : function() {
		return new Builder(arguments, function($this, results, runner, runs, fn, reportEvents, forceAsync) {
			var iter;
			(iter = function(idx) {
				fn.call($this, results.buffer[idx], idx, function(res) {
					results.last = res;
					if(reportEvents(idx, results)) {
						results.grouped[runs].push(res);
						++idx < results.buffer.length 
						? $this._async 
							? forceAsync(iter, idx) 
							: iter(idx) 
						: runner(++runs);
					}
				});
			})(0);	
		});
	},
	
	parallel : function() {
		return new Builder(arguments, function($this, results, runner, runs, fn, reportEvents, forceAsync) {
			var cnt = 0;
			var iter;
			(iter = function(idx) {
				fn.call($this, results.buffer[idx], idx, function(res) {	
					results.last = res;
					results.readable++;
					if(reportEvents(idx, results)) {
						results.grouped[runs][idx] = res;
						++cnt === results.buffer.length && runner(++runs);
					}
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