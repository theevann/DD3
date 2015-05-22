var api = {};

api.dataPoints = d3.range(0, 26, 0.1).map(function(d) {return [d, Math.cos(d)*3];});
//api.dataPoints = d3.range(-10,15,0.2).map(function(d) {return [d, d*d];});

api.getConf;

api.getDataDimensions = function () {
	var dimensions = {};
	dimensions.xmin = d3.min(api.dataPoints, d(0));
	dimensions.xmax = d3.max(api.dataPoints, d(0));
	dimensions.ymin = d3.min(api.dataPoints, d(1));
	dimensions.ymax = d3.max(api.dataPoints, d(1));
	return dimensions;
};

//Not perfect ... need the case x = xmax
api.getData = function (limit) {
	var filteredData = api.dataPoints.filter(function (d) { return d[0] >= limit.xmin && d[0] < limit.xmax && d[1] >= limit.ymin && d[1] < limit.ymax;})
	return filteredData;
};

api.getConf = function () {
	var c = {};
	c.columns = 4;
	c.rows = 2;
	c.margin = {
			top : 20,
			bottom : 20,
			left : 60,
			right : 60
	};
	
	return c;
};
