/// <reference path="openlayers.d.ts" />

import Q = require("q");

export = esri;

module esri {

    export class Request {
        /**
         * Perform a JSONP style get request.
         */
        static GET(url:string, params:any): Q.Promise<any> {
            var deferred = Q.defer<any>();

            var callback_name = "callback_" + new Date().toISOString().replace(/[-:TZ\.]/g, '');

            params = params || {};
            params.callback = callback_name;

            url = url + "?";
            for (var key in params)
                url += key + "=" + params[key].toString() + "&";
            url = url.substr(0, url.length - 1)

            var timeout = 10 * 1000;
            var timeout_trigger = window.setTimeout(function () {
                window[callback_name] = function () { };
                deferred.reject(new Error("Request timedout"));
            }, timeout * 1000);

            window[callback_name] = function (data) {
                window.clearTimeout(timeout_trigger);
                deferred.resolve(data);
            };

            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = url;

            document.getElementsByTagName('head')[0].appendChild(script);

            return deferred.promise;
        }
    }

    export module task {

        /**
         * Represents an address and its location.
         */
        export class AddressCandidate {
            /**
             * Address of the candidate. It contains one property for each of the address fields defined by a geocode service. Each address field describes some part of the address information for the candidate.
             */
            address: Object;
            /**
             * Name value pairs of field name and field value as defined in outFields
             */
            attributes: Object;
            /**
             * X- and y-coordinate of the candidate.
             */
            location: OpenLayers.Geometry.Point;
            /**
             * Numeric score between 0 and 100 for geocode candidates. A candidate with a score of 100 means a perfect match, and 0 means no match.
             */
            score: number;

            static fromObject(object: any): AddressCandidate {
                if (!object)
                    return null;

                var instance = new AddressCandidate();
                instance.address = object.address;
                instance.attributes = object.attributes;
                instance.score = object.score;
                instance.location = new OpenLayers.Geometry.Point(object.location.x, object.location.y);
                return instance;
            }
        }

        /**
         * Represents a geocode service resource exposed by the ArcGIS Server REST API. It is used to generate candidates for an address. It also used to find an address for a given location.
         */
        export class Locator {
            /**
             * URL to the ArcGIS Server REST resource that represents a locator service.
             */
            url: String;
            /**
             * The spatial reference of the output geometries.
             */
            outSpatialReference: number;

            /**
             * Creates a new Locator object.
             */
            constructor(url: String) {
                this.url = url;
                this.outSpatialReference = 4326;
            }

            /**
             * Find address candidates for the input addresses.
             */
            addressToLocations(params: any): Q.Promise<esri.task.AddressCandidate[]> {
                params = params.address;
                params.outSR = this.outSpatialReference;
                params.f = "json";
                return esri.Request.GET(this.url + "/findAddressCandidates", params).then(function (response: any) {
                    var spatialReference = response.spatialReference.wkid;
                    var candidates: esri.task.AddressCandidate[] = [];
                    for (var index = 0; index < response.candidates.length; index++) {
                        var candidate = AddressCandidate.fromObject(response.candidates[index]);
                        candidates.push(candidate);
                    }
                    return candidates;
                });
            }
        }
    }
}