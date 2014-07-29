define(["require", "exports", "./HashController", "./MapController"], function(require, exports, HashController, MapController) {
    var hashController = new HashController();
    var mapController = new MapController("map");

    // Check the url for an address and process it if present.
    var checkForAddress = function () {
        if (hashController.containsAddress()) {
            var address = hashController.getAddress();
            addressInput.value = address;
            mapController.checkAddress(address);
        }
    };

    // When the url changes then check for an address. (Caused by setting the address as well as the browser's forward and back buttons)
    window.onhashchange = checkForAddress;

    // Listen for the Enter key and process the address that has been entered.
    var addressInput = document.getElementById("address");
    addressInput.onkeypress = function (evt) {
        if (evt.keyCode != 13)
            return;

        var address = addressInput.value;

        // Settings the address in the url will invoke the hash change event
        hashController.setAddress(address);
    };

    // Initialize the map and when loaded check the url for an address.
    mapController.start().then(function (results) {
        return checkForAddress();
    });
});