
var dd3 = (function () {
	"use strict";
	var _dd3 = Object.create(d3);
	
	var data = {};
	
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
		width : 1280 / 4, // To be set automatically
		height : 720 / 2, // To be set automatically
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
			init.getConfigurationData();
			init.getDataDimensions();
		};
		
		init.getConfigurationData = function () {
			browser.column = +getUrlVar('column');
			browser.row    = +getUrlVar('row');
			browser.number = +getUrlVar('number');
			
			var conf = api.getConf();
			cave.rows = conf.rows;
			cave.columns = conf.columns;
			
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
			var domainX = scaleX ? scaleX.domain() : [d.xmin, d.xmax],
				rangeX  = scaleX ? scaleX.range()  : [0, cave.svgWidth],
				domainY = scaleY ? scaleY.domain() : [d.ymin, d.ymax],
				rangeY  = scaleY ? scaleY.range()  : [cave.svgHeight, 0];
			
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
	
	var _dd3_hook = function (hook, newObj) {
		var a = function () {
			if (!arguments.length) return hook();
			hook.apply(this, arguments);
			return newObj;
		};
		return a;
	}; 
	
	var _dd3_hookObject = function (oldObj, newObj) {
		for (var func in oldObj) {
			if (oldObj.hasOwnProperty(func)) {
				newObj[func] = _dd3_hook(oldObj[func], newObj);
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
			
			_dd3_hookObject(d3_scale, dd3_scale);
			
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
					
				g.attr("transform", "translate(" + [left, top] + ") rotate(" + rotate + ") scale(" + scale + ")")
			});
			return d3_axis(g);
		};

		_dd3_hookObject(d3_axis, dd3_axis);
		
		return dd3_axis;
	};
	
	
	/**
	 * Getter
	 */
	
	_dd3.dataPoints = function () { return data.dataPoints.slice(); };
	
	_dd3.dataDimensions = function () { return extend({}, data.dataDimensions); };
	
	_dd3.cave = function () { return extend({}, cave);};
	
	_dd3.browser = function () { return extend({}, browser);};
	
	_dd3.getData = initializer.getData;
		
	return _dd3;
})();