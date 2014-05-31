/// <reference path="./esri.d.ts"/>
/// <reference path="./dojo.d.ts"/>
define(["require", "exports", "esri/map", "esri/SpatialReference", "esri/geometry/Point", "esri/geometry/Polygon", "esri/request", "esri/layers/GraphicsLayer", "esri/graphic", "esri/Color", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/tasks/GeometryService", "esri/tasks/locator", "esri/tasks/ProjectParameters", "dojo/Deferred"], function(require, exports, Map, SpatialReference, Point, Polygon, esriRequest, GraphicsLayer, Graphic, Color, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, GeometryService, Locator, ProjectParameters, Deferred) {
    

    var MapController = (function () {
        function MapController(mapDiv) {
            this.mapDiv = mapDiv;
        }
        MapController.prototype.start = function () {
            this.initialize();
            this.setupMap();
            this.loadCityGeometry();
        };

        MapController.prototype.initialize = function () {
            this.geometryService = new GeometryService("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");
            this.hamiltonGeocoder = new Locator("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Locator_Addressing/GeocodeServer");
            this.worldGeocoder = new Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
            this.wgs84 = new SpatialReference(4326);
        };

        MapController.prototype.setupMap = function () {
            var chattanoogaLocation = new Point(-85.2672, 35.0456, this.wgs84);

            var mapOptions = {};
            mapOptions.basemap = "osm";
            mapOptions.center = chattanoogaLocation;
            mapOptions.zoom = 13;

            this.map = new Map(this.mapDiv, mapOptions);

            this.cityLayer = new GraphicsLayer({ opacity: .3 });
            this.map.addLayer(this.cityLayer);

            this.addressLayer = new GraphicsLayer({ opacity: .6 });
            this.map.addLayer(this.addressLayer);
        };

        MapController.prototype.loadCityGeometry = function () {
            var self = this;
            self.cityLayer.clear();

            var geometryRequest = esriRequest({ url: "geo/chattanooga.geojson", callback: "jsoncallback" });
            geometryRequest.then(function (response) {
                var feature = response.features[0];

                self.cityPolygon = new Polygon(feature.geometry.coordinates);

                //self.cityPolygon.rings = self.cityPolygon.rings.map((ring, index) => index == 0 ? ring : !self.cityPolygon.isClockwise(ring) ? ring : ring.reverse());
                self.cityPolygon.setSpatialReference(self.wgs84);

                var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex("#0000ff"), 2);
                var citySymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, outline, Color.fromHex("#0000ff"));

                var cityGraphic = new Graphic(self.cityPolygon, citySymbol);
                self.cityLayer.add(cityGraphic);
            });
        };

        MapController.prototype.checkAddress = function (address) {
            var deferred = new Deferred();

            var self = this;
            self.addressLayer.clear();

            self.queryWithHamilton(address, deferred, self);

            return deferred.promise;
        };

        MapController.prototype.queryWithHamilton = function (address, deferred, self) {
            self.hamiltonGeocoder.addressToLocations({ address: { "Single Line Input": address } }, function (candidates) {
                if (!candidates.length) {
                    self.queryWithWorld(address, deferred, self);
                    return;
                }

                var candidate = candidates[0];

                var params = new ProjectParameters();
                params.geometries = [candidate.location];
                params.outSR = self.wgs84;
                self.geometryService.project(params, function (locations) {
                    var location = locations[0];

                    var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex("#ff0000"), 2);
                    var addressSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 16, outline, Color.fromHex("#ff0000"));

                    var addressGraphic = new Graphic(location, addressSymbol);
                    self.addressLayer.add(addressGraphic);

                    self.map.centerAndZoom(location, 20);

                    self.geometryService.intersect([location], self.cityPolygon, function (result) {
                        deferred.resolve(!isNaN(result[0].x));
                    });
                });
            });
        };

        MapController.prototype.queryWithWorld = function (address, deferred, self) {
            self.worldGeocoder.addressToLocations({ address: { "SingleLine": address } }, function (candidates) {
                if (!candidates.length) {
                    self.queryWithWorld(address, deferred, self);
                    return;
                }

                var candidate = candidates[0];

                var params = new ProjectParameters();
                params.geometries = [candidate.location];
                params.outSR = self.wgs84;
                self.geometryService.project(params, function (locations) {
                    var location = locations[0];

                    var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, Color.fromHex("#ff0000"), 2);
                    var addressSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 16, outline, Color.fromHex("#ff0000"));

                    var addressGraphic = new Graphic(location, addressSymbol);
                    self.addressLayer.add(addressGraphic);

                    self.map.centerAndZoom(location, 20);

                    deferred.resolve(false);
                });
            });
        };
        return MapController;
    })();
    return MapController;
});
//# sourceMappingURL=MapController.js.map
