/// <reference path="./esri.d.ts"/>
/// <reference path="./dojo.d.ts"/>

import esri = require("esri");
import Map = require("esri/map");
import SpatialReference = require("esri/SpatialReference");
import Point = require("esri/geometry/Point");
import Polygon = require("esri/geometry/Polygon");
import esriRequest = require("esri/request");
import GraphicsLayer = require("esri/layers/GraphicsLayer");
import Graphic = require("esri/graphic");
import Color = require("esri/Color");
import Font = require("esri/symbols/Font");
import SimpleMarkerSymbol = require("esri/symbols/SimpleMarkerSymbol");
import SimpleLineSymbol = require("esri/symbols/SimpleLineSymbol");
import SimpleFillSymbol = require("esri/symbols/SimpleFillSymbol");
import TextSymbol = require("esri/symbols/TextSymbol");
import GeometryService = require("esri/tasks/GeometryService");
import Locator = require("esri/tasks/locator");
import AddressCandidate = require("esri/tasks/AddressCandidate");
import ProjectParameters = require("esri/tasks/ProjectParameters");
import Deferred = require("dojo/Deferred");
import Promise = require("dojo/promise/Promise");

export = MapController;

class MapController {
    map: Map;
    cityPolygon: Polygon;
    cityLayer: GraphicsLayer;
    addressLayer: GraphicsLayer;
    geometryService: GeometryService;
    hamiltonGeocoder: Locator;
    worldGeocoder: Locator;
    wgs84: SpatialReference;

    constructor(public mapDiv: string) {
    }

    start():void {
        this.initialize();
        this.setupMap();
        this.loadCityGeometry();
    }

    initialize(): void {
        this.geometryService = new GeometryService("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");
        this.hamiltonGeocoder = new Locator("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Locator_Addressing/GeocodeServer");
        this.worldGeocoder = new Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
        this.wgs84 = new SpatialReference(4326);
    }

    setupMap():void {
        var chattanoogaLocation = new Point(-85.2672, 35.0456, this.wgs84);
        this.map = new Map(this.mapDiv, { basemap: "osm", center: chattanoogaLocation, zoom: 13 });

        this.cityLayer = new GraphicsLayer({ opacity: .3 });
        this.map.addLayer(this.cityLayer);

        this.addressLayer = new GraphicsLayer({ opacity: .7 });
        this.map.addLayer(this.addressLayer);
    }

    loadCityGeometry(): void {
        var self = this;
        self.cityLayer.clear();

        esriRequest({ url: "geo/chattanooga.geojson", callback: "jsoncallback" }).then((response) => {
            var feature = response.features[0];

            self.cityPolygon = new Polygon(feature.geometry.coordinates);
            self.cityPolygon.setSpatialReference(self.wgs84);

            var citySymbol = self.getCitySymbol();
            self.cityLayer.add(new Graphic(self.cityPolygon, citySymbol));
        });
    }

    getCitySymbol(): SimpleFillSymbol {
        var color = Color.fromString("blue");
        var outline: SimpleLineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
        var citySymbol: SimpleFillSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, outline, color);
        return citySymbol;
    }

    checkAddress(address: string): void {
        address = address.trim();

        var self = this;
        self.addressLayer.clear();
        var addressLocation: Point = null;

        self.geocodeAddress(self.hamiltonGeocoder, { "Single Line Input": address }).then(null, (error) => {
            return self.geocodeAddress(self.worldGeocoder, { "SingleLine": address });
        }).then((candidate: AddressCandidate) => {
            return self.projectGeometry(self.geometryService, candidate.location, self.wgs84);
        }).then((location: Point) => {
            addressLocation = location;
            self.map.centerAndZoom(addressLocation, 20);

            var text = "Checking...";
            self.addTextGraphic(self.addressLayer, addressLocation, text);

            var color = Color.fromString("grey");
            self.addAddressGraphic(self.addressLayer, addressLocation, color);

            return self.intersects(self.geometryService, self.cityPolygon, location);
        }).then((intersects: boolean) => {
            self.addressLayer.clear();

            var text = intersects ? "Within" : "Not Within";
            self.addTextGraphic(self.addressLayer, addressLocation, text);

            var color = intersects ? Color.fromString("green") : Color.fromString("red");
            self.addAddressGraphic(self.addressLayer, addressLocation, color);
        });
    }

    geocodeAddress(locator: Locator, address: any): dojo.Promise<AddressCandidate> {
        var deferred = new Deferred<Array<AddressCandidate>>();
        locator.addressToLocations({ address: address }, deferred.resolve, deferred.reject);
        return deferred.promise.then((candidates) => {
            if (!candidates.length)
                throw new Error("No candidates found.");
            return candidates[0];
        });
    }

    projectGeometry(geometryService: GeometryService, point: Point, outSpatialReference: SpatialReference): dojo.Promise<Point> {
        var deferred = new Deferred<Array<Point>>();
        var parameters = new ProjectParameters();
        parameters.geometries = [point];
        parameters.outSR = outSpatialReference;
        geometryService.project(parameters, deferred.resolve, deferred.reject);
        return deferred.promise.then((locations) => {
            return locations[0];
        });
    }

    intersects(geometryService: GeometryService, polygon: Polygon, point: Point): dojo.Promise<boolean> {
        var deferred = new Deferred<Array<Point>>();
        geometryService.intersect([polygon], point, deferred.resolve, deferred.reject);
        return deferred.promise.then((intersections) => {
            return !isNaN(intersections[0].x);
        });
    }

    addTextGraphic(layer: GraphicsLayer, point: Point, text: string): void {
        var font = new Font("24pt", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "sans-serif");
        var textSymbol = new TextSymbol(text, font, Color.fromString("black"));
        textSymbol.horizontalAlignment = TextSymbol.ALIGN_MIDDLE;
        textSymbol.setOffset(0, 13);
        var textGraphic: Graphic = new Graphic(point, textSymbol);
        layer.add(textGraphic);
    }

    addAddressGraphic(layer: GraphicsLayer, point: Point, color: Color): void {
        var outline: SimpleLineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
        var addressSymbol: SimpleMarkerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 16, outline, color);
        var addressGraphic: Graphic = new Graphic(point, addressSymbol);
        layer.add(addressGraphic);
    }
} 