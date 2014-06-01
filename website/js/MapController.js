define(["require", "exports", "esri/map", "esri/SpatialReference", "esri/geometry/Point", "esri/geometry/Polygon", "esri/request", "esri/layers/GraphicsLayer", "esri/graphic", "esri/Color", "esri/symbols/Font", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/symbols/TextSymbol", "esri/tasks/GeometryService", "esri/tasks/locator", "esri/tasks/ProjectParameters", "dojo/Deferred"], function(require, exports, Map, SpatialReference, Point, Polygon, esriRequest, GraphicsLayer, Graphic, Color, Font, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, TextSymbol, GeometryService, Locator, ProjectParameters, Deferred) {
    

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
            this.map = new Map(this.mapDiv, { basemap: "osm", center: chattanoogaLocation, zoom: 13 });

            this.cityLayer = new GraphicsLayer({ opacity: .3 });
            this.map.addLayer(this.cityLayer);

            this.addressLayer = new GraphicsLayer({ opacity: .7 });
            this.map.addLayer(this.addressLayer);
        };

        MapController.prototype.loadCityGeometry = function () {
            var self = this;
            self.cityLayer.clear();

            esriRequest({ url: "geo/chattanooga.geojson", callback: "jsoncallback" }).then(function (response) {
                var feature = response.features[0];

                self.cityPolygon = new Polygon(feature.geometry.coordinates);
                self.cityPolygon.setSpatialReference(self.wgs84);

                var citySymbol = self.getCitySymbol();
                self.cityLayer.add(new Graphic(self.cityPolygon, citySymbol));
            });
        };

        MapController.prototype.getCitySymbol = function () {
            var color = Color.fromString("blue");
            var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
            var citySymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, outline, color);
            return citySymbol;
        };

        MapController.prototype.checkAddress = function (address) {
            address = address.trim();

            var self = this;
            self.addressLayer.clear();
            var addressLocation = null;

            self.geocodeAddress(self.hamiltonGeocoder, { "Single Line Input": address }).then(null, function (error) {
                return self.geocodeAddress(self.worldGeocoder, { "SingleLine": address });
            }).then(function (candidate) {
                return self.projectGeometry(self.geometryService, candidate.location, self.wgs84);
            }).then(function (location) {
                addressLocation = location;
                self.map.centerAndZoom(addressLocation, 20);

                var text = "Checking...";
                self.addTextGraphic(self.addressLayer, addressLocation, text);

                var color = Color.fromString("grey");
                self.addAddressGraphic(self.addressLayer, addressLocation, color);

                return self.intersects(self.geometryService, self.cityPolygon, location);
            }).then(function (intersects) {
                self.addressLayer.clear();

                var text = intersects ? "Within" : "Not Within";
                self.addTextGraphic(self.addressLayer, addressLocation, text);

                var color = intersects ? Color.fromString("green") : Color.fromString("red");
                self.addAddressGraphic(self.addressLayer, addressLocation, color);
            });
        };

        MapController.prototype.geocodeAddress = function (locator, address) {
            var deferred = new Deferred();
            locator.addressToLocations({ address: address }, deferred.resolve, deferred.reject);
            return deferred.promise.then(function (candidates) {
                if (!candidates.length)
                    throw new Error("No candidates found.");
                return candidates[0];
            });
        };

        MapController.prototype.projectGeometry = function (geometryService, point, outSpatialReference) {
            var deferred = new Deferred();
            var parameters = new ProjectParameters();
            parameters.geometries = [point];
            parameters.outSR = outSpatialReference;
            geometryService.project(parameters, deferred.resolve, deferred.reject);
            return deferred.promise.then(function (locations) {
                return locations[0];
            });
        };

        MapController.prototype.intersects = function (geometryService, polygon, point) {
            var deferred = new Deferred();
            geometryService.intersect([polygon], point, deferred.resolve, deferred.reject);
            return deferred.promise.then(function (intersections) {
                return !isNaN(intersections[0].x);
            });
        };

        MapController.prototype.addTextGraphic = function (layer, point, text) {
            var font = new Font("24pt", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "sans-serif");
            var textSymbol = new TextSymbol(text, font, Color.fromString("black"));
            textSymbol.horizontalAlignment = TextSymbol.ALIGN_MIDDLE;
            textSymbol.setOffset(0, 13);
            var textGraphic = new Graphic(point, textSymbol);
            layer.add(textGraphic);
        };

        MapController.prototype.addAddressGraphic = function (layer, point, color) {
            var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
            var addressSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 16, outline, color);
            var addressGraphic = new Graphic(point, addressSymbol);
            layer.add(addressGraphic);
        };
        return MapController;
    })();
    return MapController;
});
