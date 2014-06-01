define(["require", "exports"], function(require, exports) {
    

    var HashController = (function () {
        function HashController() {
        }
        HashController.prototype.containsAddress = function () {
            return window.location.hash != "";
        };

        HashController.prototype.getAddress = function () {
            var address = window.location.hash.substring(1).replace(/\+/g, " ");
            return address;
        };

        HashController.prototype.setAddress = function (address) {
            address = address.replace(/ /g, "+");
            window.location.hash = address;
        };
        return HashController;
    })();
    return HashController;
});
