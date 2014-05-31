define(["require", "exports", "./MapController"], function(require, exports, MapController) {
    var mapController = new MapController("map");
    mapController.start();

    var address = document.getElementById("address");
    var checkAddress = document.getElementById("checkAddress");

    checkAddress.onclick = function (evt) {
        mapController.checkAddress(address.value).then(function (within) {
            if (within)
                alert("Within");
            else
                alert("Not within");
        });
    };
});
//# sourceMappingURL=main.js.map
