define(["require", "exports", "./esri", "./q"], function(require, exports, esri, Q) {
    var MapController = (function () {
        function MapController(mapDiv) {
            this.mapDiv = mapDiv;
        }
        /**
        * Starts the app. Returns a promise that resolves when loaded.
        */
        MapController.prototype.start = function () {
            this.initialize();
            var mapLoaded = this.setupMap();
            var cityLoaded = this.loadCityGeometry();

            return Q.all([mapLoaded, cityLoaded]);
        };

        /**
        * Initializes the services that will be used.
        */
        MapController.prototype.initialize = function () {
            this.hamiltonGeocoder = new esri.task.Locator("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Locator_Addressing/GeocodeServer");
            this.worldGeocoder = new esri.task.Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
        };

        /**
        * Creates the map and graphics layers. Returns a promise that resolves when the base map has loaded.
        */
        MapController.prototype.setupMap = function () {
            var _this = this;
            this.map = new OpenLayers.Map(this.mapDiv);
            this.map.events.on({
                "zoomend": function (e) {
                    for (var index = 0; index < _this.map.layers.length; index++)
                        _this.map.layers[index].redraw();
                }
            });

            var osmLayer = new OpenLayers.Layer.OSM();
            this.cityLayer = new OpenLayers.Layer.Vector("Chattanooga", {
                styleMap: new OpenLayers.StyleMap({
                    strokeColor: "#7627a7",
                    strokeOpacity: 0.3,
                    strokeWidth: 2,
                    strokeLinecap: "butt",
                    fillColor: "#7627a7",
                    fillOpacity: 0.3
                }),
                renderers: ['Canvas', 'VML']
            });
            this.messageLayer = new OpenLayers.Layer.Vector("Messages", {
                styleMap: new OpenLayers.StyleMap({
                    label: "${label}",
                    labelYOffset: "26",
                    fontFamily: "Chattype-Bold, helvetica, arial, san-serif",
                    fontSize: "24pt",
                    fontWeight: "bold",
                    fontStyle: "normal",
                    fontColor: "#000000",
                    fontOpacity: 0.7
                })
            });
            this.locationLayer = new OpenLayers.Layer.Vector("Location", {
                styleMap: new OpenLayers.StyleMap({
                    graphicName: "square",
                    graphicOpacity: 0.7,
                    pointRadius: 6,
                    rotation: 45,
                    strokeColor: "${color}",
                    strokeWidth: 1,
                    strokeOpacity: 0.7,
                    fillColor: "${color}",
                    fillOpacity: 0.7
                })
            });
            this.map.addLayers([osmLayer, this.cityLayer, this.messageLayer, this.locationLayer]);

            var chattanoogaLocation = new OpenLayers.LonLat(-85.2672, 35.0456);
            chattanoogaLocation.transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());
            this.map.setCenter(chattanoogaLocation, 13);

            return Q.when(true);
        };

        /**
        * Loads the city polygon as a graphic on the map. Returns a promise that resolves when loaded.
        */
        MapController.prototype.loadCityGeometry = function () {
            var _this = this;
            this.cityLayer.removeAllFeatures();

            var deferred = Q.defer();
            OpenLayers.Request.GET({ url: "geo/chattanooga.geojson", success: deferred.resolve });
            return deferred.promise.then(function (response) {
                var projOptions = {
                    'internalProjection': _this.map.baseLayer.projection,
                    'externalProjection': new OpenLayers.Projection("EPSG:4326")
                };
                var geojsonReader = new OpenLayers.Format.GeoJSON(projOptions);
                var features = geojsonReader.read(response.responseText);

                if (features) {
                    if (features.constructor != Array)
                        features = [features];
                    _this.cityPolygon = features[0].geometry;
                    _this.cityLayer.addFeatures(features);
                }

                return true;
            });
        };

        /**
        * Checks whether the address is within the city polygon.
        */
        MapController.prototype.checkAddress = function (address) {
            var _this = this;
            address = address.trim();

            this.showCheckingMessage();

            // First attempt to find the address using Hamilton's geocoder.
            this.geocodeAddress(this.hamiltonGeocoder, { "Single Line Input": address }).then(null, function (error) {
                // Failed to find the address within Hamilton. Try Esri's world geocoder.
                return _this.geocodeAddress(_this.worldGeocoder, { "SingleLine": address });
            }).then(function (candidate) {
                var location = candidate.location;
                location.transform(new OpenLayers.Projection("EPSG:4326"), _this.map.getProjectionObject());

                var locationLonLat = new OpenLayers.LonLat(location.x, location.y);
                _this.map.setCenter(locationLonLat, 18);

                // Use the builtin contains method for determining whether the address is within the city polygon.
                var isWithin = _this.cityPolygon.intersects(location);
                _this.showWithinMessage(isWithin, location);
            });
        };

        /**
        * Returns the first matching address.
        */
        MapController.prototype.geocodeAddress = function (locator, address) {
            return locator.addressToLocations({ address: address }).then(function (candidates) {
                // If no candidates are returned then fail the promise.
                if (!candidates.length)
                    throw new Error("Could not find address.");

                // We are only going to look at the first candidate.
                return candidates[0];
            });
        };

        /**
        * Shows a message in the center of the map.
        */
        MapController.prototype.showCheckingMessage = function () {
            this.messageLayer.removeAllFeatures();
            this.locationLayer.removeAllFeatures();

            var centerLonLat = this.map.getCenter();
            var centerPoint = new OpenLayers.Geometry.Point(centerLonLat.lon, centerLonLat.lat);

            var checking = new OpenLayers.Feature.Vector(centerPoint, { label: "Checking..." });
            this.messageLayer.addFeatures([checking]);
        };

        /**
        * Shows a within message and address graphic.
        */
        MapController.prototype.showWithinMessage = function (isWithin, location) {
            this.messageLayer.removeAllFeatures();
            this.locationLayer.removeAllFeatures();

            var text = isWithin ? "Within" : "Not Within";
            var within = new OpenLayers.Feature.Vector(location, { label: text });
            this.messageLayer.addFeatures([within]);

            var color = isWithin ? "#00FF00" : "#FF0000";
            var house = new OpenLayers.Feature.Vector(location, { color: color });
            this.locationLayer.addFeatures([house]);
        };
        return MapController;
    })();
    return MapController;
});