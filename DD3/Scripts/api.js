var api = {};
var uid = 0;

api.dataPoints = d3.range(0, 26, 0.1).map(function(d) {return {id : uid++, x : d, y : Math.cos(d)*3};});
//api.dataPoints = d3.range(-10,15,0.2).map(function(d) {return [d, d*d];});

api.getConf;

api.getDataDimensions = function () {
	var dimensions = {};
	dimensions.xmin = d3.min(api.dataPoints, d('x'));
	dimensions.xmax = d3.max(api.dataPoints, d('x'));
	dimensions.ymin = d3.min(api.dataPoints, d('y'));
	dimensions.ymax = d3.max(api.dataPoints, d('y'));
	return dimensions;
};

//Not perfect ... need the case x = xmax
api.getData = function (limit) {
	var filteredData = api.dataPoints.filter(function (d) { return d['x'] >= limit.xmin && d['x'] < limit.xmax && d['y'] >= limit.ymin && d['y'] < limit.ymax;})
	return filteredData;
};

api.getConf = function () {
	var c = {};
	c.margin = {
			top : 20,
			bottom : 20,
			left : 60,
			right : 60
	};
	
	return c;
};
