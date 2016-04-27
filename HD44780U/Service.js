var HD44780U;
(function (HD44780U) {
    var GUI;
    (function (GUI) {
        var Service = (function () {
            function Service() {
            }
            Service.prototype.Map = function (region) {
                return true;
            };
            Service.prototype.Unmap = function (region) {
                return true;
            };
            Service.prototype.RegisterCallback = function (timeout, periodic, callback) {
                return self.setTimeout(callback, timeout * 1000);
            };
            Service.prototype.UnregisterCallback = function (handle) {
                self.clearTimeout(handle);
                return true;
            };
            Service.prototype.RaiseEvent = function (event, args) {
                $(this).trigger(event, args);
            };
            Service.prototype.GetClockRate = function () {
                return 58.9824 * 1000000;
            };
            Service.prototype.GetCycles = function () {
                return 1;
            };
            Service.prototype.GetTickCount = function () {
                return 1;
            };
            return Service;
        }());
        GUI.Service = Service;
    })(GUI = HD44780U.GUI || (HD44780U.GUI = {}));
})(HD44780U || (HD44780U = {}));
//# sourceMappingURL=Service.js.map