export = HashController;

class HashController {
    constructor() { }

    containsAddress(): boolean {
        return window.location.hash != "";
    }

    getAddress(): string {
        var address = window.location.hash.substring(1).replace(/\+/g, " ");
        return address;
    }

    setAddress(address: string): void {
        address = address.replace(/ /g, "+");
        window.location.hash = address;
    }
}