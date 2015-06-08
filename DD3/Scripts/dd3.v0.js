/**
*   Version 0.0.1
*/

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
		id : null,
		peers : [],
		connections: []
	};
	

	var cave = {
		width : 0, // Computed from server data
		height: 0, // Computed from server data
		margin : {
			top : 0,
			bottom : 0,
			left : 0,
			right : 0
		}
	};
	
	var browser = {
		number : null,
		width : 1280 / 4, //$(this).width();
		height : 720 / 2, //$(this).height();
		margin : {
			top : 0,
			bottom : 0,
			left : 0,
			right : 0
		}
	};
	
	var initializer = (function () {
		/*
			Connect to peer server => Get peerId
			Connect to signalR server => Send browser information
									  => Receive configuration
			Connect to data api => Get data and metadata [emulated in js]
		*/
		
		var init = function () {
			if(!init.checkLibraries()) {
				state("fatal")
				return;
			}
			
			state('connecting');
			init.setBrowserConfiguration();
			init.connectToPeerServer(init.connectToSignalRServer);
			init.getDataDimensions();
		};
		
		init.checkLibraries = function () {
			var toCheck = ['d3', 'Peer', 'jQuery', ['jQuery', 'signalR']];
			
			var check = toCheck.some(function (lib) {
				var ok = false;
				if (typeof lib === 'string' && typeof window[lib] === "undefined") {
					log("Initialization failed : " + lib + " was not found", 4);
					ok = true;
				} else if (typeof lib === 'object') {
					var path = window;
					ok = lib.some(function (l) {
						if(!(path = path[l])) {
							log("Initialization failed : " + l + " was not found", 4);
							return true;
						}
						return false;
					});
					lib = lib.join('.');
				}
				return ok;
			});
			
			if(check)
				return false;
			
			log(toCheck.join(', ') + " successfully loaded", 1);
			return true;
		};
		
		init.setBrowserConfiguration = function () {
			var conf = api.getConf();

			browser.initColumn = +getUrlVar('column');
			browser.initRow    = +getUrlVar('row');
			browser.number     = +getUrlVar('number');

			cave.margin = conf.margin;
		};
		
		init.connectToPeerServer = function (callback) {
			
			var p = peer.peer = new Peer({key : 'q35ylav1jljo47vi', debug : 0});
			
			var plotter = function (data) {

			    if (data.type === 'circle') {
			        var f = _dd3.position('html', 'global', 'html', 'local', 'left'),
                        g = _dd3.position('html', 'global', 'html', 'local', 'top');

			        data.attr.cx = f(data.attr.cx);
			        data.attr.cy = g(data.attr.cy);

			        d3.select("svg") // Make sure to select the right svg if many ... To-Do
                        .append("circle")
                        .attr(data.attr);
			    }

			};

			var dataReceiver = function (data) {
			    log("Receiving an object...");

			    if (data.type === 'circle') {
			        plotter(data);
			    }

			};

            //To Do, problem of double connection to same peer
			var connect = function (c, callback) {
			    log("Connection established with Peer : " + c.peer, 0);

			    return peer.peers.some(function (p) {
			        if (p.peerId === c.peer) {
			            peer.connections[p.row][p.col] = c;
			            c.on("data", dataReceiver);
			            callback && callback(c);
			            return true;
			        }
			        return false;
			    });
			};

			p.on('open', function (id) {
				log('Connected to peer server with id : ' + id, 1);
				peer.id = id;
				
				p.on('connection', connect);
				
				callback();
			});
			
			p.on("error", function (e) {
			    if (e.type === "network" || e.type === "unavailable-id") {
			        log("[Peer] " + e, 4);
			        state("fatal");
			    } else {
			        log("[Peer] " + e, 3);
			    }

			});

			peer.sendTo = function (r, c, data) {
			    var conn;

			    var callback = function (c) {
			        c.send(data);
			    };

			    if (!peer.connections[r][c]) {

			        var check = peer.peers.some(function (p) {
			            if (+p.col === +c && +p.row === +r) {
			                var conn = peer.peer.connect(p.peerId);
                            conn.on("open", connect.bind(null, conn, callback));
			                return true;
			            }
			            return false;
			        })

			        if (!check)
			            return false;
			    } else {
			        callback(peer.connections[r][c]);
			    }

			    return true;
			};

			window.onunload = window.onbeforeunload = function(e) {
				if (!!peer.peer && !peer.peer.destroyed) {
					peer.peer.destroy();
				}
			};
		};
		
		init.connectToSignalRServer = function () {
		    var dd3Server = $.connection.dd3Hub;

		    dd3Server.client.receiveConfiguration = init.getCaveConfiguration;

		    $.connection.hub.error(function (error) {
		        console.log('SignalR error: ' + error)
		    });

		    $.connection.hub.start()
                .fail(function(){ log('Unable to connect to signalR server'); })
                .done(function () {
                    log("Connected to signalR server", 1);
                    log("Waiting for everyone to connect", 1);
				
				    var thisInfo = {
				        browserNum: browser.number,
				        peerId: peer.id,
				        row: browser.initRow,
				        col: browser.initColumn,
				        height: browser.height,
				        width: browser.width
				    };

				    dd3Server.server.updateInformation(thisInfo);
			});
		};
		
		init.getCaveConfiguration = function (obj) {
			log("Receiving connected browsers' ids from signalR server", 1);
			
			var peersInfo = JSON.parse(obj);
			var maxCol, minCol, maxRow, minRow;
			
			minCol = d3.min(peersInfo, d('col', true));
			maxCol = d3.max(peersInfo, d('col', true));
			minRow = d3.min(peersInfo, d('row', true));
			maxRow = d3.max(peersInfo, d('row', true));
			
			cave.rows = maxRow - minRow + 1;
			cave.columns = maxCol - minCol + 1;
			
			browser.column = browser.initColumn - minCol;
			browser.row = browser.initRow - minRow;

			peersInfo.forEach(function (p) {
			    p.initColumn = +p.col;
			    p.initRow = +p.row;
			    p.col = p.initColumn - minCol;
			    p.row = p.initRow - minRow;
			});

			peer.peers = peersInfo;
			peer.connections = d3.range(0, cave.rows).map(function () { return []; });
			
			cave.width = cave.columns * browser.width;
			cave.height = cave.rows * browser.height;
			
			cave.svgWidth = cave.width - cave.margin.left - cave.margin.right;
			cave.svgHeight = cave.height - cave.margin.top - cave.margin.bottom;
			
			browser.margin = {
				top    : Math.max(cave.margin.top - browser.row * browser.height, 0),
				left   : Math.max(cave.margin.left - browser.column * browser.width, 0),
				bottom : Math.max(cave.margin.bottom - (cave.rows - browser.row - 1) * browser.height, 0),
				right  : Math.max(cave.margin.right - (cave.columns - browser.column - 1) * browser.width, 0)
			};
			
			browser.svgWidth = Math.max(browser.width - browser.margin.left - browser.margin.right, 0);
			browser.svgHeight = Math.max(browser.height - browser.margin.top - browser.margin.bottom, 0);
			
			//setTimeout(launch, 3000);
			launch();
		};
		
		init.getDataDimensions = function () {
			log("Getting Data dimensions from api", 1);
			data.dataDimensions = api.getDataDimensions();
			return data.dataDimensions;
		};
		
		// For now we get data just for a basic static scatterplot
		init.getData = function (scaleX, scaleY) {
			
			var d = data.dataDimensions;
			var pLeft = _dd3.position('svg','local','svg','global', 'left'),
			    pTop = _dd3.position('svg','local','svg','global', 'top');
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
			var minX = Math.max(pLeft(0), rangeX[0]),
				maxX = Math.min(pLeft(browser.svgWidth), rangeX[1]),
				minY = Math.max(pTop(0), rangeY[0]),
				maxY = Math.min(pTop(browser.svgHeight), rangeY[1]);
			
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
		
		return init;

	})();
	
	/**
	 * dataReceiver
	 * dataHandler
	 */
	
	var launch = function () {
		
		/**
		 * dd3.position
		 */

	    // TO-DO

		function sumWith(s, sign) {
		    return function (x) { return x + sign*s;};
		}

		_dd3.position = function (context1, range1, context2, range2, property) {
		    if (context1 === context2) {
		        var f = dd3.position[(context1 === 'html') ? 'html' : 'svg'][property];
		        var sign = (range1 == range2) ? 0 : (range1 == 'local') ? 1 : -1;
		        return sumWith(f, sign);
		    } else if (range1 === range2) {
		        var f = ((range1 === 'local') ? browser : cave).margin[property];
		        var sign = (context1 === 'html') ? -1 : 1;
		        return sumWith(f, sign);
		    } else {
		        var f = _dd3.position(context1, range1, context1, range2, property);
		        var g = _dd3.position(context1, range2, context2, range2, property);
		        return function (x) { return g(f(x)); };
		    }
		};

		_dd3.position.svg = {
		    left : browser.column * browser.width - cave.margin.left + browser.margin.left,
		    top : browser.row * browser.height - cave.margin.top + browser.margin.top
		};

		_dd3.position.html = {
		    left: browser.column * browser.width,
		    top: browser.row * browser.height
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
			    var f = _dd3.position('svg','global','svg','local', side),
			        g = _dd3.position('svg','local','svg','global', side);

				var dd3_scale = function (x) {
				    return f(d3_scale(x));
				};
				
				_dd3_hookD3Object(d3_scale, dd3_scale);
				dd3_scale.ticks = _dd3_hook_basic(d3_scale.ticks);
				dd3_scale.tickFormat = _dd3_hook_basic(d3_scale.tickFormat);
				dd3_scale.invert = function (x) {
					return d3_scale.invert(g(x));
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
			var fLeft = _dd3.position('svg','global','svg','local', 'left'),
			    fTop = _dd3.position('svg','global','svg','local', 'top');

			var dd3_axis = function (g) {
				g.each(function() {
					var g = d3.select(this);
					var t = d3.transform(g.attr("transform"));
					var left = fLeft(t.translate[0]),
						top = fTop(t.translate[1]),
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
		* dd3.selection
		*/

		_dd3.selection = d3.selection;
		
		//Now we can change any function used with selections & even add some
		
		var findDest = function (el) {
		    var dest = [];
		    var rect = el.getBoundingClientRect();

		    if (rect.bottom > browser.height || rect.top < 0 || rect.right > browser.width || rect.left < 0) {
		        var f = _dd3.position('html', 'local', 'html', 'global', 'left'),
		            g = _dd3.position('html', 'local', 'html', 'global', 'top');
		        var topLeft = findBrowserAt(f(rect.left), g(rect.top), 'html'),
		            topRight = findBrowserAt(f(rect.right), g(rect.top), 'html'),
		            bottomLeft = findBrowserAt(f(rect.left), g(rect.bottom), 'html');

		        for (var i = topLeft[0] ; i <= bottomLeft[0] ; i++) {
		            for (var j = topLeft[1] ; j <= topRight[1] ; j++) { //Check to simplify
		                if (i != browser.row || j != browser.column) {
		                    dest.push([i, j]);
		                }
		            }
		        }
		    }

		    return dest;
		};

		var findBrowserAt = function (left, top, context) {
		    context = context || 'svg';

		    if (context === "svg") {
		        left = _dd3.position('svg', 'global', 'html', 'global', 'left')(left);
		        top = _dd3.position('svg', 'global', 'html', 'global', 'top')(top);
		    }

		    var pos = [];
		    pos[0] = ~~(top / browser.height);
		    pos[1] = ~~(left / browser.width);

            return pos;
		};

		_dd3.selection.prototype.send = function () {
		    var counter = 0;

		    this.select(function (d, i) {
		        var dest, obj;

		        if ((dest = findDest(this)).length > 0) {

		            obj = {
		                type: this.nodeName,
		                attr: getAttr(this)
		            };

		            //As we only send points for now...
		            var f = _dd3.position('html', 'local', 'html', 'global', 'left'),
		                g = _dd3.position('html', 'local', 'html', 'global', 'top'),
                        rect = this.getBoundingClientRect();

		            obj.attr.cx = f(+rect.left + +rect.width / 2);
		            obj.attr.cy = g(+rect.top + +rect.height / 2);
		            obj.attr.style = "stroke:red;fill:red";

		            dest.forEach(function (d) {
		                peer.sendTo(d[0], d[1], obj);
		                counter++;
		            });

		        }

		        return this;
		    });

		    log("Sending " + counter + " objects...");
			return this;
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
		
		state('ready');
	};

	/**
	 * Initialize
	 */
	
	initializer();
	
	
	/**
	* Provide listener function to start on ready state !
	*/
	
	_dd3.on = function (p, f) {
		if (typeof callbackListener[p] !== "undefined") {
			callbackListener[p].push(f);
			return true;
		}
		return false;
	};
	
	return _dd3;
})();



//Saving for memory
/*

init.connectPeers = function () {
			var id = peer.session + "r" + browser.row + "c" + browser.column;
			peer.id = id;
			
			var p = new Peer(id,{key : 'q35ylav1jljo47vi'});
			//var p = new Peer(id,{key : 'x7fwx2kavpy6tj4i'});
			
			p.on("error", function (e) {
				var sev;
				if (e.type === "network" || e.type === "unavailable-id") {
					log("[Peer] " + e, 4);
					state("fatal");
				} else {
					log("[Peer] " + e, 3);
				}
					
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
				
				c.on("data", dataReceiver);
				c.on("close", function () {
					log("Connection " + (out ? "out" : "in") + " closed with peer " + c.peer, 0);
					// If it is not a close due to double initialization, (or it is but update hasn't been done yet)
					// Then remove the connection from the array
					if (peer.connections[targetRow][targetColumn] == c)
						peer.connections[targetRow][targetColumn] = false;
				});
				c.on("error", function (e) {
					log("[Connection] " + e, 3);
				});
			};
			
			var launchConnections = function () {
				log('Launching Connections');
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
				setTimeout(launchConnections, 5000 + 1000 * browser.row);
				
			});
			
			window.onunload = window.onbeforeunload = function(e) {
			  if (!!peer.peer && !peer.peer.destroyed) {
				peer.peer.destroy();
			  }
			};
			
			peer.peer = p;
		};


*/

/*
_dd3.selection = function () {
    return d3.selection.apply(this, arguments);
};

_dd3.selection.prototype = Object.create(d3.selection.prototype);

_dd3.select = function () {
    var selected = d3.select.apply(this, arguments);
    selected.__proto__ = _dd3.selection.prototype;
    return selected;
};

_dd3.selectAll = function () {
    var selected = d3.selectAll.apply(this, arguments);
    selected.__proto__ = _dd3.selection.prototype;
    return selected;
};

//Now we can change any function used with selections & even add some

_dd3.selection.prototype.select = function () {
    var selected = d3.selection.prototype.select.apply(this, arguments);
    selected.__proto__ = _dd3.selection.prototype;
    return selected;
};

_dd3.selection.prototype.selectAll = function () {
    var selected = d3.selection.prototype.selectAll.apply(this, arguments);
    selected.__proto__ = _dd3.selection.prototype;
    return selected;
};

_dd3.selection.prototype.send = function () {
    log("Sending ...");
    return this;
};
//*/