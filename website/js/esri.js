define(["require", "exports", "./q"], function(require, exports, Q) {
    var esri;
    (function (esri) {
        var Request = (function () {
            function Request() {
            }
            /**
            * Perform a JSONP style get request.
            */
            Request.GET = function (url, params) {
                var deferred = Q.defer();

                var callback_name = "callback_" + new Date().toISOString().replace(/[-:TZ\.]/g, '');

                params = params || {};
                params.callback = callback_name;

                url = url + "?";
                for (var key in params)
                    url += key + "=" + params[key].toString() + "&";
                url = url.substr(0, url.length - 1);

                var timeout = 10 * 1000;
                var timeout_trigger = window.setTimeout(function () {
                    window[callback_name] = function () {
                    };
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
            };
            return Request;
        })();
        esri.Request = Request;

        (function (task) {
            /**
            * Represents an address and its location.
            */
            var AddressCandidate = (function () {
                function AddressCandidate() {
                }
                AddressCandidate.fromObject = function (object) {
                    if (!object)
                        return null;

                    var instance = new AddressCandidate();
                    instance.address = object.address;
                    instance.attributes = object.attributes;
                    instance.score = object.score;
                    instance.location = new OpenLayers.Geometry.Point(object.location.x, object.location.y);
                    return instance;
                };
                return AddressCandidate;
            })();
            task.AddressCandidate = AddressCandidate;

            /**
            * Represents a geocode service resource exposed by the ArcGIS Server REST API. It is used to generate candidates for an address. It also used to find an address for a given location.
            */
            var Locator = (function () {
                /**
                * Creates a new Locator object.
                */
                function Locator(url) {
                    this.url = url;
                    this.outSpatialReference = 4326;
                }
                /**
                * Find address candidates for the input addresses.
                */
                Locator.prototype.addressToLocations = function (params) {
                    params = params.address;
                    params.outSR = this.outSpatialReference;
                    params.f = "json";
                    return esri.Request.GET(this.url + "/findAddressCandidates", params).then(function (response) {
                        var spatialReference = response.spatialReference.wkid;
                        var candidates = [];
                        for (var index = 0; index < response.candidates.length; index++) {
                            var candidate = AddressCandidate.fromObject(response.candidates[index]);
                            candidates.push(candidate);
                        }
                        return candidates;
                    });
                };
                return Locator;
            })();
            task.Locator = Locator;
        })(esri.task || (esri.task = {}));
        var task = esri.task;
    })(esri || (esri = {}));
    return esri;
});