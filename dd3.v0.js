
var dd3 = (function () {
	"use strict";
	var _dd3 = Object.create(d3);
	
	
	var state = (function () {
		var _state = 'loading';
		return function (newState) {
			if (arguments.length == 0) return _state;
			
			if (newState === 'connecting') {
				_state = 'connecting';
			} else if (newState === 'ready') {
				_state = 'ready';
				log('DD3 is ready !', 1);
			} else if (newState === 'fatal') {
				_state = 'fatal';
			} else {
				return false;
			}
			
			callbackListener[newState].forEach(function (f) { f(); });
			return true;
		};
	})();

	var callbackListener = {
		connecting : [],
		ready : [],
		fatal : []
	};
	
	var data = {};
	
	var peer = {
		connections : [],
		ready : -1
	};
	
	var cave = {
		width : 0, // Got from server
		height : 0, // Got from server
		margin : {
			top : 0,
			bottom : 0,
			left : 0,
			right : 0
		}
	};
	
	var browser = {
		number : null, // Used as id for peer.js
		width : 1280 / 4, // To be set automatically : (window).width();
		height : 720 / 2, // To be set automatically : $(window).height();
		margin : {
			top : 0,
			bottom : 0,
			left : 0,
			right : 0
		}
	};
	
	var initializer = (function () {
		/*
			Connect to server : to do
			Connect to peers : to do
			Get data and metadata from server : emulated in js
		*/
		
		// Get configuration data
		
		var init = function () {
			if(!init.checkLibraries()) {
				state("fatal")
				return;
			}
			init.getConfigurationData(); // Doit être bloquant !
			init.getDataDimensions();
			init.connectPeers();
			
			state('connecting');
		};
		
		init.getConfigurationData = function () {
			browser.column = +getUrlVar('column');
			browser.row    = +getUrlVar('row');
			browser.number = +getUrlVar('number');
			
			var conf = api.getConf();
			cave.rows = conf.rows;
			cave.columns = conf.columns;
			peer.session = conf.session;
			peer.ready = cave.rows * cave.columns - 1;
			peer.connections = d3.range(0, cave.rows).map(function () { return []; });
			
			cave.width = cave.columns * browser.width;
			cave.height = cave.rows * browser.height;
			cave.margin = conf.margin;
			cave.svgWidth = cave.width - cave.margin.left - cave.margin.right;
			cave.svgHeight = cave.height - cave.margin.top - cave.margin.bottom;
			
			browser.margin = {
				top : Math.max(cave.margin.top - browser.row * browser.height, 0),
				left : Math.max(cave.margin.left - browser.column * browser.width, 0),
				bottom : Math.max(cave.margin.bottom - (cave.rows - browser.row - 1) * browser.height, 0),
				right : Math.max(cave.margin.right - (cave.columns - browser.column - 1) * browser.width, 0)
			};
			
			browser.svgWidth = Math.max(browser.width - browser.margin.left - browser.margin.right, 0);
			browser.svgHeight = Math.max(browser.height - browser.margin.top - browser.margin.bottom, 0);
			
		};
		
		init.getDataDimensions = function () {
			data.dataDimensions = api.getDataDimensions();
			return data.dataDimensions;
		};
		
		// For now we get data just for a basic static scatterplot
		init.getData = function (scaleX, scaleY) {
			
			var d = data.dataDimensions;
			var p = _dd3.position.svg.toGlobal;
			var domainX = scaleX ? scaleX.domain().slice() : [d.xmin, d.xmax],
				rangeX  = scaleX ? scaleX.range().slice()  : [0, cave.svgWidth],
				domainY = scaleY ? scaleY.domain().slice() : [d.ymin, d.ymax],
				rangeY  = scaleY ? scaleY.range().slice()  : [cave.svgHeight, 0];
			
			var invX = 1, invY = 1;
			
			if (domainX[0] > domainX[1]) {
				domainX.reverse();
				invX *= -1;
			}
			if (rangeX[0] > rangeX[1]) {
				rangeX.reverse();
				invX *= -1;
			}
			if (domainY[0] > domainY[1]) {
				domainY.reverse();
				invY *= -1;
			}
			if (rangeY[0] > rangeY[1]) {
				rangeY.reverse();
				invY *= -1;
			}
			
			var limit = {};
			var minX = Math.max(p.left(0), rangeX[0]),
				maxX = Math.min(p.left(browser.svgWidth), rangeX[1]),
				minY = Math.max(p.top(0), rangeY[0]),
				maxY = Math.min(p.top(browser.svgHeight), rangeY[1]);
			
			if (invX > 0) {
				limit.xmin = domainX[0] + (minX - rangeX[0]) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
				limit.xmax = domainX[0] + (maxX - rangeX[0]) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
			} else {
				limit.xmin = domainX[0] + (rangeX[1] - maxX) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
				limit.xmax = domainX[0] + (rangeX[1] - minX) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);				
			}
			
			if (invY > 0) {
				limit.ymin = domainY[0] + (minY - rangeY[0]) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
				limit.ymax = domainY[0] + (maxY - rangeY[0]) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
			} else {
				limit.ymin = domainY[0] + (rangeY[1] - maxY) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
				limit.ymax = domainY[0] + (rangeY[1] - minY) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);				
			}
			
			data.dataPoints = api.getData(limit);
			 
			return data.dataPoints;
		};
		
		init.checkLibraries = function () {
			if (typeof d3 === "undefined") {
				log("Initialization failed : d3.js was not found", 4);
				return false;
			} else if (typeof Peer === "undefined") {
				log("Initialization failed : peer.js was not found", 4);
				return false;
			}
			
			log("Initialization ok : d3.js and peer.js loaded", 1);
			return true;
		};
		
		init.connectPeers = function () {
			var id = peer.session + "r" + browser.row + "c" + browser.column;
			peer.id = id;
			
			var p = new Peer(
					id,
					{
					key : 'x7fwx2kavpy6tj4i'
				});
			
			p.on("error", function (e) {
					log(e, 3);
				});
			
			var connect = function (c, targetRow, targetColumn, out) {
				var previous = peer.connections[targetRow][targetColumn],
					check = (targetRow > browser.row || (targetRow === browser.row && targetColumn > browser.column)) ^ out; // Priority to browser with higher row
				
				if (previous && !check){
					log("No changes !", 0);
					return;
				}
				
				if (previous)
					previous.close();
				else
					(peer.ready -= 1) == 0 ? state('ready') : "";
				
				peer.connections[targetRow][targetColumn] = c;
				c.on("data", function (d) {log("Data : " + d);});
				c.on("close", function () {
					log("Connection " + (out ? "out" : "in") + " closed with peer " + c.peer, 0);
					// If it is not a close due to double initialization, (or it is but update hasn't been done yet)
					// Then remove the connection from the array
					if (peer.connections[targetRow][targetColumn] == c)
						peer.connections[targetRow][targetColumn] = false;
				});
				c.on("error", function (e) {
					log(e, 3);
				});
			};
			
			var launchConnections = function () {
				for (var i = 0 ; i < cave.rows ; i++) {
					for (var j = 0 ; j < cave.columns ; j++) {
						if (!peer.connections[i][j] && (i != browser.row || j != browser.column)) {
							var connTemp = p.connect(peer.session + "r" + i + "c" + j);
							
							connTemp.on("open", (function (i,j, c) {
								return function () {
									log("(initiated) Connected to peer " + c.peer, 0);		
									connect(c, i, j, true);								
								}
							}) (i,j, connTemp));
							
						}
					}
				}
			};
			
			p.on('open', function (id) {
				log('Connected to peer server', 1);
				log('Browser Peer ID : ' + id, 1);
				
				p.on('connection', function (c) {
					log("(incoming) Connected to peer " + c.peer, 0)
					
					var pos = new RegExp(peer.session + "r(\\d+)c(\\d+)").exec(c.peer);
					connect(c, +pos[1], +pos[2], false);
				});
				
				// Prevent from launching all connections if some browsers have already sent their request (reduce traffic) :
				// Give time to the 'on' connection handling function to handle already incoming connections
				setTimeout(launchConnections, 2000);
				
			});
			
			window.onunload = window.onbeforeunload = function(e) {
			  if (!!peer.peer && !peer.peer.destroyed) {
				peer.peer.destroy();
			  }
			};
			
			peer.peer = p;
		};

		return init;

		})();
	
	/**
	 * Initialize
	 */
	
	initializer();
	
	/**
	 * dd3.position
	 */
	
	_dd3.position = {
		svg : {
			toLeft : browser.column * browser.width - cave.margin.left + browser.margin.left,
			toTop : browser.row * browser.height - cave.margin.top + browser.margin.top
		},
		browser : {
			toLeft : browser.column * browser.width,
			toTop : browser.row * browser.height
		}
	};
	
	_dd3.position.svg.toLocal = {
		left : function (left) { return left - _dd3.position.svg.toLeft; },
		top : function (top) { return top - _dd3.position.svg.toTop; }
	};
	
	_dd3.position.browser.toLocal = {
		left : function (left) { return left - _dd3.position.browser.toLeft; },
		top : function (top) { return top - _dd3.position.browser.toTop; }
	};
	
	_dd3.position.svg.toGlobal = {
		left : function (left) { return left + _dd3.position.svg.toLeft; },
		top : function (top) { return top + _dd3.position.svg.toTop; }
	};
	
	_dd3.position.browser.toGlobal = {
		left : function (left) { return left + _dd3.position.browser.toLeft; },
		top : function (top) { return top + _dd3.position.browser.toTop; }
	};
		
	/**
	 * Hook helper functions for d3
	 */
	
	var _dd3_hook_d3 = function (hook, newObj) {
		var a = function () {
			if (!arguments.length) return hook();
			hook.apply(this, arguments);
			return newObj;
		};
		return a;
	};
	
	var _dd3_hook_basic = function (hook) {
		var a = function () {
			return hook.apply(this, arguments);
		}; 
		return a;
	};
	
	var _dd3_hookD3Object = function (oldObj, newObj) {
		for (var func in oldObj) {
			if (oldObj.hasOwnProperty(func)) {
				newObj[func] = _dd3_hook_d3(oldObj[func], newObj);
			} 
		}
	};
	
	var _dd3_hookObject = function (oldObj, newObj) {
		for (var func in oldObj) {
			if (oldObj.hasOwnProperty(func)) {
				newObj[func] = _dd3_hook_basic(oldObj[func]);
			} 
		}
	};
	
	
	/**
	 * dd3.scale
	 */
	 
	_dd3.scale = Object.create(d3.scale);
	
	var _dd3_scale_toLocal = function (side, d3_scale)  {
		var a = function () {
			
			var dd3_scale = function (x) {
				return _dd3.position.svg.toLocal[side](d3_scale(x));
			};
			
			_dd3_hookD3Object(d3_scale, dd3_scale);
			dd3_scale.ticks = _dd3_hook_basic(d3_scale.ticks);
			dd3_scale.tickFormat = _dd3_hook_basic(d3_scale.tickFormat);
			dd3_scale.invert = function (x) {
				return d3_scale.invert(_dd3.position.svg.toGlobal[side](x));
			}; 
			
			return dd3_scale;
		};
		return  a;
	};
	
	_dd3.scale.linear = function () {
		var scale = d3.scale.linear();
		scale.toLocalLeft = _dd3_scale_toLocal('left', scale);
		scale.toLocalTop = _dd3_scale_toLocal('top', scale);
		return scale;
	};
	
	/**
	 * dd3.svg.axis
	 */
	 
	_dd3.svg = Object.create(d3.svg);
	
	_dd3.svg.axis = function () {
		var d3_axis = d3.svg.axis();
		
		var dd3_axis = function (g) {
			g.each(function() {
				var g = d3.select(this);
				var t = d3.transform(g.attr("transform"));
				var left = _dd3.position.svg.toLocal.left(t.translate[0]),
					top = _dd3.position.svg.toLocal.top(t.translate[1]),
					rotate = t.rotate,
					scale = t.scale;
					
				g.attr("transform", "translate(" + [left, top] + ") rotate(" + rotate + ") scale(" + scale + ")");
			});
			return d3_axis(g);
		};

		_dd3_hookD3Object(d3_axis, dd3_axis);
		
		return dd3_axis;
	};
	
	/**
	*
	*/
	
	_dd3.on = function (p, f) {
		if (typeof callbackListener[p] !== "undefined") {
			peer.callback[p].push(f);
			return true;
		}
		return false;
	};
	
	
	/**
	 * Getter
	 */
	
	_dd3.dataPoints = function () { return data.dataPoints.slice(); };
	
	_dd3.dataDimensions = function () { return extend({}, data.dataDimensions); };
	
	_dd3.peers = function () { return extend({}, peer); };
	
	_dd3.cave = function () { return extend({}, cave);};
	
	_dd3.browser = function () { return extend({}, browser);};
	
	_dd3.getData = initializer.getData;
	
	_dd3.state = function () { return state(); };
		
	return _dd3.state() == 'connecting' ? _dd3 : {};
})();