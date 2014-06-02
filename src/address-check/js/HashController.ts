export = HashController;

class HashController {
    constructor() { }

    /**
     * Determines whether the url contains an address.
     */
    containsAddress(): boolean {
        return window.location.hash != "";
    }

    /**
     * Gets the address from the url.
     */
    getAddress(): string {
        var address = window.location.hash.substring(1).replace(/\+/g, " ");
        return address;
    }

    /**
     * Sets the address in the url.
     */
    setAddress(address: string): void {
        address = address.replace(/ /g, "+");
        window.location.hash = address;
    }
}