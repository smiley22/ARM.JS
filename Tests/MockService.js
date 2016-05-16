var ARM;
(function (ARM) {
    var Simulator;
    (function (Simulator) {
        var Tests;
        (function (Tests) {
            var MockService = (function () {
                function MockService(clockRateMhz) {
                    this.raisedEvents = [];
                    this.cycles = 0;
                    this.clockRate = clockRateMhz * 1000000;
                }
                Object.defineProperty(MockService.prototype, "RaisedEvents", {
                    get: function () {
                        return this.raisedEvents;
                    },
                    enumerable: true,
                    configurable: true
                });
                MockService.prototype.Tick = function (ms) {
                    this.cycles = this.cycles + (this.clockRate * (ms / 1000.0) | 0);
                };
                MockService.prototype.Map = function (region) {
                    return true;
                };
                MockService.prototype.Unmap = function (region) {
                    return true;
                };
                MockService.prototype.RegisterCallback = function (timeout, periodic, callback) {
                    if (!periodic)
                        return self.setTimeout(callback, timeout * 1000);
                    return self.setInterval(callback, timeout * 1000);
                };
                MockService.prototype.UnregisterCallback = function (handle) {
                    self.clearInterval(handle);
                    self.clearTimeout(handle);
                    return true;
                };
                MockService.prototype.RegisterDevice = function (device) {
                    return true;
                };
                MockService.prototype.UnregisterDevice = function (device) {
                    return true;
                };
                MockService.prototype.RaiseEvent = function (event, sender, args) {
                    this.raisedEvents.push([event, args]);
                };
                MockService.prototype.GetClockRate = function () {
                    return this.clockRate;
                };
                MockService.prototype.GetCycles = function () {
                    return this.cycles;
                };
                MockService.prototype.GetTickCount = function () {
                    return this.cycles / this.clockRate;
                };
                return MockService;
            }());
            Tests.MockService = MockService;
        })(Tests = Simulator.Tests || (Simulator.Tests = {}));
    })(Simulator = ARM.Simulator || (ARM.Simulator = {}));
})(ARM || (ARM = {}));
//# sourceMappingURL=MockService.js.map