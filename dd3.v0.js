
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
		
		var getConfigurationData = function () {
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
			
			
			extend(_dd3.position.svg, {
				toLeft : browser.column * browser.width - cave.margin.left + browser.margin.left,
				toTop : browser.row * browser.height - cave.margin.top + browser.margin.top
			});
			
			extend(_dd3.position.browser, {
				toLeft : browser.column * browser.width,
				toTop : browser.row * browser.height
			});
			
		};
		
		// For now we get data just for a basic static scatterplot
		var getData = function () {
			var d = api.getDataDimensions();
			var limit = {};
			var p = _dd3.position.svg.toGlobal;
			
			limit.xmin = d.xmin + p.left(0) / cave.svgWidth * (d.xmax - d.xmin);
			limit.xmax = d.xmin + p.left(browser.svgWidth) / cave.svgWidth * (d.xmax - d.xmin);
			limit.ymin = d.ymin + (1 - p.top(browser.svgHeight) / cave.svgHeight) * (d.ymax - d.ymin);
			limit.ymax = d.ymin + (1 - p.top(0) / cave.svgHeight) * (d.ymax - d.ymin);
			
			data.dataDimensions = d;
			data.dataPoints = api.getData(limit);
		};
		
		return (function () {
			getConfigurationData();
			getData();
		});
			
	})();
		
	/**
	 * dd3.position
	 */
	
	_dd3.position = {
		svg : {},
		browser : {}
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
	 * dd3.scale
	 *
	 *  TO DO : Create hook as for axis !
	 */
	 
	_dd3.scale = Object.create(d3.scale);
	
	var _dd3_scale_toLocalLeft = function (scale)  {
		var a = function () {
			
			var b = function (x) {
				return _dd3.position.svg.toLocal.left(scale(x));
			};
			b.__proto__ = scale;
			
			return b;
		};
		return  a;
	};
	
	var _dd3_scale_toLocalTop = function (scale)  {
		var a = function () {
			
			var b = function (x) {
				return _dd3.position.svg.toLocal.top(scale(x));
			};
			b.__proto__ = scale;
			
			return b;
		};
		return  a;
	};
	
	_dd3.scale.linear = function () {
		var scale = d3.scale.linear();
		scale.toLocalLeft = _dd3_scale_toLocalLeft(scale);
		scale.toLocalTop = _dd3_scale_toLocalTop(scale);
		return scale;
	};
	
	/**
	 * dd3.svg.axis
	 */
	 
	var _dd3_svg_axis_hook = function (hook, axis) {
		var a = function (scale) {
			if (!arguments.length) return hook();
			hook(scale);
			return axis;
		};
		return a;
	}; 
	 
	_dd3.svg = Object.create(d3.svg);
	_dd3.svg.axis = function () {
		var hook = d3.svg.axis();
		
		var axis = function (g) {
			g.each(function() {
				var g = d3.select(this);
				var t = d3.transform(g.attr("transform"));
				var left = _dd3.position.svg.toLocal.left(t.translate[0]),
				    top = _dd3.position.svg.toLocal.top(t.translate[1]),
					rotate = t.rotate,
					scale = t.scale;
					
				g.attr("transform", "translate(" + [left, top] + ") rotate(" + rotate + ") scale(" + scale + ")")
			});
			return hook(g);
		};

		for (var func in hook) {
			if (hook.hasOwnProperty(func)) {
				axis[func] = _dd3_svg_axis_hook(hook[func], axis);
			} 
		}
		
		/*
		axis.scale         = _dd3_svg_axis_hook(hook.scale, axis);
		axis.orient        = _dd3_svg_axis_hook(hook.orient, axis);
		axis.ticks         = _dd3_svg_axis_hook(hook.ticks, axis);
		axis.tickValues    = _dd3_svg_axis_hook(hook.tickValues, axis);
		axis.tickFormat    = _dd3_svg_axis_hook(hook.tickFormat, axis);
		axis.tickSize      = _dd3_svg_axis_hook(hook.tickSize, axis);
		axis.innerTickSize = _dd3_svg_axis_hook(hook.innerTickSize, axis);
		axis.outerTickSize = _dd3_svg_axis_hook(hook.outerTickSize, axis);
		axis.tickPadding   = _dd3_svg_axis_hook(hook.tickPadding, axis);
		axis.tickSubdivide    = _dd3_svg_axis_hook(hook.tickSubdivide, axis);
		*/
		
		return axis;
	};
	
	
	
	/**
	* Initialize
	*/
	
	initializer();
	
	/**
	 * Getter (Has to be set after initialization)
	 */
	
	_dd3.dataPoints = function () { return data.dataPoints.slice(); };
	
	_dd3.dataDimensions = function () { return extend({}, data.dataDimensions); };
	
	_dd3.cave = function () { return extend({}, cave);};
	
	_dd3.browser =function () { return extend({}, browser);};
	
	return _dd3;
})();