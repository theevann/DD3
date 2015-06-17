var api = {};
var uid = 0;

api.dataPoints = d3.range(0, 100, 0.05).map(function (d) { return { id: uid++, x: d, y: Math.cos(d) * 3 }; });
//api.dataPoints = d3.range(0, 26, 0.8).map(function (d) { return { id: uid++, x: d, y: Math.cos(d) }; });
//api.dataPoints = d3.range(-10, 15, 0.5).map(function (d) { return { id: uid++, x: d, y: d*d }; });
//api.dataPoints = [{ x: 1, y: 2 }, { x: 4.5, y: 3.3 }, { x: 1, y: 5 }, { x: 8, y: 2 }]
api.barDataPoints = [/*{ country: "USA", gdp: "17.4" }, { country: "China", gdp: "10.3" }, */{ country: "England", gdp: "2.9" }, { country: "France", gdp: "2.8" }, { country: "Germany", gdp: "3.8" }, { country: "Japan", gdp: "4.6" }]

api.getConf;

// The data dimensions api should read each entry and give the min and max
api.getDataDimensions = function () {
    var dimensions = { x: {}, y: {} };

	dimensions.x.min = d3.min(api.dataPoints, d('x'));
	dimensions.x.max = d3.max(api.dataPoints, d('x'));
	dimensions.y.min = d3.min(api.dataPoints, d('y'));
	dimensions.y.max = d3.max(api.dataPoints, d('y'));

	return dimensions;
};

api.getBarDataDimensions = function () {
    var dimensions = { country: {}, gdp: {} };

    dimensions.country.min = d3.min(api.barDataPoints, d('country'));
    dimensions.country.max = d3.max(api.barDataPoints, d('country'));
    dimensions.gdp.min = d3.min(api.barDataPoints, d('gdp', true));
    dimensions.gdp.max = d3.max(api.barDataPoints, d('gdp', true));

    dimensions.length = api.barDataPoints.length;
    return dimensions;
};

//Not perfect ... need the case x = xmax
api.getData = function (limit) {
	var filteredData = api.dataPoints.filter(function (d) { return d['x'] >= limit.xmin && d['x'] < limit.xmax && d['y'] >= limit.ymin && d['y'] < limit.ymax;})
	return filteredData;
};

var sorter = function (_) {
    return function (a, b) {
        a[_] = +a[_] ? +a[_] : a[_];
        b[_] = +b[_] ? +b[_] : b[_];
        return a[_] > b[_] ? 1 : a[_] < b[_] ? -1 : 0;
    }
};

api.getBarData = function (limit, sortOn) {

    var data = api.barDataPoints.sort(sorter(sortOn || "id"));
    var data = api.barDataPoints.forEach(function (d, i) { d.order = i; });
    var filteredData = api.barDataPoints.filter(function (d, i) { return i >= limit.min && i < limit.max })

    return filteredData;
};

/* 
// Version 1 : one browser get the all path... exact

api.getPathData = function (limit) {
    var d = api.dataPoints[0];
    if (d.x >= limit.xmin && d.x < limit.xmax && d.y >= limit.ymin && d.y < limit.ymax)
        return api.dataPoints;
    else
        return [];
}

/*/
// Version 2 : give to every browser part of it... imprecise but parallelized - faster

api.getPathData = function (limit) {
    var data = api.dataPoints;
    var pts = [], approx = 2;
    var counter = approx, last = 0;

    var isIn = function (d) {
        return (d.x >= limit.xmin && d.x < limit.xmax && d.y >= limit.ymin && d.y < limit.ymax)
    };

    for (var i = 0, l = data.length ; i < l ; i++) {

        if (isIn(data[i])) {
            var d = clamp(approx - counter, -approx, 0);

            for (var j = Math.max(i+d, 0) ; j <= i ; j++) {
                pts.push(data[j]);
            }

            counter = 0;
        } else {
            if (counter < approx) {
                pts.push(data[i]);
            }

            /*
            // For possible later improvement
            // Doing this could possibly improve drawing with a low value for approx => but need to define the method "defined" to pass to the line function...
            else if (counter == approx) {
                pts.push(undefined);
            }
            */
            counter++;
        }

    }

    return pts;
}

//*/

api.getConf = function () {
	var c = {};
	c.margin = {
			top : 20,
			bottom : 30,
			left : 60,
			right : 60
	};
	
	return c;
};
