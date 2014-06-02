define(["require", "exports"], function(require, exports) {
    

    var HashController = (function () {
        function HashController() {
        }
        /**
        * Determines whether the url contains an address.
        */
        HashController.prototype.containsAddress = function () {
            return window.location.hash != "";
        };

        /**
        * Gets the address from the url.
        */
        HashController.prototype.getAddress = function () {
            var address = window.location.hash.substring(1).replace(/\+/g, " ");
            return address;
        };

        /**
        * Sets the address in the url.
        */
        HashController.prototype.setAddress = function (address) {
            address = address.replace(/ /g, "+");
            window.location.hash = address;
        };
        return HashController;
    })();
    return HashController;
});
//# sourceMappingURL=HashController.js.map
