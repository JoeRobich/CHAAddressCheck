define(["require", "exports", "./MapController"], function(require, exports, MapController) {
    var mapController = new MapController("map");
    mapController.start();

    var address = document.getElementById("address");

    address.onkeypress = function (evt) {
        if (evt.keyCode != 13)
            return;

        mapController.checkAddress(address.value);
    };
});
//# sourceMappingURL=main.js.map
