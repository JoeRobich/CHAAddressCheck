import HashController = require("./HashController");
import MapController = require("./MapController");

var urlController = new HashController();
var mapController = new MapController("map");
mapController.start();

var addressInput = <HTMLInputElement>document.getElementById("address");
addressInput.onkeypress = (evt) => {
    if (evt.keyCode != 13)
        return;

    var address = addressInput.value;
    urlController.setAddress(address);
};

var checkForAddress = () => {
    if (urlController.containsAddress()) {
        var address = urlController.getAddress();
        addressInput.value = address;
        mapController.checkAddress(address);
    }
};

window.onhashchange = checkForAddress;
checkForAddress();