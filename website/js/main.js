define(["require", "exports", "./HashController", "./MapController"], function(require, exports, HashController, MapController) {
    var urlController = new HashController();
    var mapController = new MapController("map");
    mapController.start();

    var addressInput = document.getElementById("address");
    addressInput.onkeypress = function (evt) {
        if (evt.keyCode != 13)
            return;

        var address = addressInput.value;
        urlController.setAddress(address);
    };

    var checkForAddress = function () {
        if (urlController.containsAddress()) {
            var address = urlController.getAddress();
            addressInput.value = address;
            mapController.checkAddress(address);
        }
    };

    window.onhashchange = checkForAddress;
    checkForAddress();
});
