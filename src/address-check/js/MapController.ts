/// <reference path="./esri.d.ts"/>
/// <reference path="./dojo.d.ts"/>

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
import promiseAll = require("dojo/promise/all");

export = MapController;

class MapController {
    map: Map;
    cityPolygon: Polygon;
    cityLayer: GraphicsLayer;
    messageLayer: GraphicsLayer;
    geometryService: GeometryService;
    hamiltonGeocoder: Locator;
    worldGeocoder: Locator;
    wgs84: SpatialReference;

    constructor(public mapDiv: string) {
    }

    /**
     * Starts the app. Returns a promise that resolves when loaded.
     */
    start(): dojo.Promise<boolean[]> {
        this.initialize();
        var mapLoaded = this.setupMap();
        var cityLoaded = this.loadCityGeometry();

        return promiseAll([mapLoaded, cityLoaded]);
    }

    /**
     * Initializes the services that will be used.
     */
    initialize(): void {
        this.geometryService = new GeometryService("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer");
        this.hamiltonGeocoder = new Locator("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Locator_Addressing/GeocodeServer");
        this.worldGeocoder = new Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
        this.wgs84 = new SpatialReference(4326);
    }

    /**
     * Creates the map and graphics layers. Returns a promise that resolves when the base map has loaded.
     */
    setupMap(): dojo.Promise<boolean> {
        var deferred = new Deferred<boolean>();

        var chattanoogaLocation = new Point(-85.2672, 35.0456, this.wgs84);
        this.map = new Map(this.mapDiv, { basemap: "osm", center: chattanoogaLocation, zoom: 13 });
        this.map.on("load", (e) => deferred.resolve(true));

        this.cityLayer = new GraphicsLayer({ opacity: .3 });
        this.map.addLayer(this.cityLayer);

        this.messageLayer = new GraphicsLayer({ opacity: .7 });
        this.map.addLayer(this.messageLayer);

        return deferred.promise;
    }

    /**
     * Loads the city polygon as a graphic on the map. Returns a promise that resolves when loaded.
     */
    loadCityGeometry(): dojo.Promise<boolean> {
        this.cityLayer.clear();

        return esriRequest({ url: "geo/chattanooga.geojson", callback: "jsoncallback" }).then((response) => {
            var feature = response.features[0];

            this.cityPolygon = new Polygon(feature.geometry.coordinates);
            this.cityPolygon.setSpatialReference(this.wgs84);

            var color = Color.fromString("blue");
            var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
            var citySymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, outline, color);
            this.cityLayer.add(new Graphic(this.cityPolygon, citySymbol));

            return true;
        });
    }

    /**
     * Checks whether the address is within the city polygon.
     */
    checkAddress(address: string): void {
        address = address.trim();

        this.showCheckingMessage();

        // First attempt to find the address using Hamilton's geocoder.
        this.geocodeAddress(this.hamiltonGeocoder, { "Single Line Input": address }).then(null, (error) => {
            // Failed to find the address within Hamilton. Try Esri's world geocoder.
            return this.geocodeAddress(this.worldGeocoder, { "SingleLine": address });
        }).then((candidate: AddressCandidate): any => {
            // If the address location is already WGS84 there is no need to project it.
            if (candidate.location.spatialReference.wkid == this.wgs84.wkid)
                return candidate.location;

            return this.projectPoint(this.geometryService, candidate.location, this.wgs84);
        }).then((location: Point) => {
            // Use the builtin contains method for determining whether the address is within the city polygon.
            var isWithin = this.cityPolygon.contains(location);
            this.showWithinMessage(isWithin, location)

            this.map.centerAndZoom(location, 20);
        });
    }

    /**
     * Returns the first matching address.
     */
    geocodeAddress(locator: Locator, address: any): dojo.Promise<AddressCandidate> {
        var deferred = new Deferred<Array<AddressCandidate>>();
        locator.addressToLocations({ address: address }, deferred.resolve, deferred.reject);
        return deferred.promise.then((candidates) => {
            // If no candidates are returned then fail the promise.
            if (!candidates.length)
                throw new Error("Could not find address.");

            // We are only going to look at the first candidate.
            return candidates[0];
        });
    }

    /**
     * Returns the projected point.
     */
    projectPoint(geometryService: GeometryService, point: Point, outSpatialReference: SpatialReference): dojo.Promise<Point> {
        var parameters = new ProjectParameters();
        parameters.geometries = [point];
        parameters.outSR = outSpatialReference;

        var deferred = new Deferred<Array<Point>>();
        geometryService.project(parameters, deferred.resolve, deferred.reject);
        return deferred.promise.then((locations) => {
            // 
            return locations[0];
        });
    }

    /**
     * Shows a message in the center of the map.
     */
   showCheckingMessage(): void {
        this.messageLayer.clear();

        var mapCenter = this.map.extent.getCenter();
        var text = "Checking...";
        this.addTextGraphic(mapCenter, text);
    }

    /**
     * Shows a within message and address graphic.
     */
    showWithinMessage(isWithin: boolean, location: Point): void {
        this.messageLayer.clear();

        var text = isWithin ? "Within" : "Not Within";
        this.addTextGraphic(location, text);

        var color = isWithin ? Color.fromString("green") : Color.fromString("red");
        this.addAddressGraphic(location, color);
    }

    /**
     * Adds a text graphic to the message layer.
     */
    addTextGraphic(point: Point, text: string): void {
        var font = new Font("24pt", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "sans-serif");
        var textSymbol = new TextSymbol(text, font, Color.fromString("black"));
        textSymbol.horizontalAlignment = TextSymbol.ALIGN_MIDDLE;
        textSymbol.setOffset(0, 13);
        var textGraphic = new Graphic(point, textSymbol);
        this.messageLayer.add(textGraphic);
    }

    /**
     * Adds an address graphic to the message layer.
     */
    addAddressGraphic(point: Point, color: Color): void {
        var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, 2);
        var addressSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 16, outline, color);
        var addressGraphic = new Graphic(point, addressSymbol);
        this.messageLayer.add(addressGraphic);
    }
} 