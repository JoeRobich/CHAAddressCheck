/// <reference path="openlayers.d.ts" />

import esri = require("./esri");
import Q = require("q");

export = MapController;

class MapController {
    map: OpenLayers.Map;
    cityPolygon: OpenLayers.Geometry.Polygon;
    cityLayer: OpenLayers.Layer.Vector;
    messageLayer: OpenLayers.Layer.Vector;
    locationLayer: OpenLayers.Layer.Vector;

    hamiltonGeocoder: esri.task.Locator;
    worldGeocoder: esri.task.Locator;

    constructor(public mapDiv: string) {
    }

    /**
     * Starts the app. Returns a promise that resolves when loaded.
     */
    start(): Q.Promise<boolean[]> {
        this.initialize();
        var mapLoaded = this.setupMap();
        var cityLoaded = this.loadCityGeometry();

        return Q.all([mapLoaded, cityLoaded]);
    }

    /**
     * Initializes the services that will be used.
     */
    initialize(): void {
        this.hamiltonGeocoder = new esri.task.Locator("http://mapsdev.hamiltontn.gov/arcgis/rest/services/Locator_Addressing/GeocodeServer");
        this.worldGeocoder = new esri.task.Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
    }

    /**
     * Creates the map and graphics layers. Returns a promise that resolves when the base map has loaded.
     */
    setupMap(): Q.Promise<boolean> {
        this.map = new OpenLayers.Map(this.mapDiv);
        this.map.events.on({
            "zoomend": (e) => {
                for (var index = 0; index < this.map.layers.length; index++)
                    this.map.layers[index].redraw();
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
    }

    /**
     * Loads the city polygon as a graphic on the map. Returns a promise that resolves when loaded.
     */
    loadCityGeometry(): Q.Promise<boolean> {
        this.cityLayer.removeAllFeatures();

        var deferred = Q.defer<XMLHttpRequest>();
        OpenLayers.Request.GET({ url: "geo/chattanooga.geojson", success: deferred.resolve });
        return deferred.promise.then((response:XMLHttpRequest) => {
            var projOptions = {
                'internalProjection': this.map.baseLayer.projection,
                'externalProjection': new OpenLayers.Projection("EPSG:4326")
            };
            var geojsonReader = new OpenLayers.Format.GeoJSON(projOptions);
            var features = geojsonReader.read(response.responseText);

            if (features) {
                if (features.constructor != Array)
                    features = [features];
                this.cityPolygon = features[0].geometry;
                this.cityLayer.addFeatures(features);
            }

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
        }).then((candidate: esri.task.AddressCandidate): any => {
            var location = candidate.location;
            location.transform(new OpenLayers.Projection("EPSG:4326"), this.map.getProjectionObject());

            var locationLonLat = new OpenLayers.LonLat(location.x, location.y);
            this.map.setCenter(locationLonLat, 18);

            // Use the builtin contains method for determining whether the address is within the city polygon.
            var isWithin = this.cityPolygon.intersects(location);
            this.showWithinMessage(isWithin, location)
        });
    }

    /**
     * Returns the first matching address.
     */
    geocodeAddress(locator: esri.task.Locator, address: any): Q.Promise<esri.task.AddressCandidate> {
        return locator.addressToLocations({ address: address }).then((candidates) => {
            // If no candidates are returned then fail the promise.
            if (!candidates.length)
                throw new Error("Could not find address.");

            // We are only going to look at the first candidate.
            return candidates[0];
        });
    }

    /**
     * Shows a message in the center of the map.
     */
   showCheckingMessage(): void {
       this.messageLayer.removeAllFeatures();
       this.locationLayer.removeAllFeatures();

       var centerLonLat = this.map.getCenter();
       var centerPoint = new OpenLayers.Geometry.Point(centerLonLat.lon, centerLonLat.lat);

       var checking = new OpenLayers.Feature.Vector(centerPoint, { label: "Checking..." });
       this.messageLayer.addFeatures([checking]);
    }

    /**
     * Shows a within message and address graphic.
     */
    showWithinMessage(isWithin: boolean, location: OpenLayers.Geometry.Point): void {
        this.messageLayer.removeAllFeatures();
        this.locationLayer.removeAllFeatures();

        var text = isWithin ? "Within" : "Not Within";
        var within = new OpenLayers.Feature.Vector(location, { label: text });
        this.messageLayer.addFeatures([within]);

        var color = isWithin ? "#00FF00" : "#FF0000";
        var house = new OpenLayers.Feature.Vector(location, { color: color });
        this.locationLayer.addFeatures([house]);
    }
}