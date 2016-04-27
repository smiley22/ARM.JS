describe('Watchdog Tests', function () {
    var watchdog;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        watchdog = new ARM.Simulator.Devices.Watchdog(0);
        service = new ARM.Simulator.Tests.MockService(58.9824);
        expect(watchdog.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        watchdog.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x5312ACED],
            [0x04, 0x00000FFF],
            [0x08, 0x00000000],
            [0x0C, 0x01FFFFFF]
        ];
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
            var value = watchdog.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Counter Timings #1', function () {
        var expectedTime = 8.388608 * 1000;
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(expectedTime - 10);
        expect(service.RaisedEvents.length).toBe(0);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });
    it('Counter Timings #2', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        var expectedTime = 8.388608 * 1000;
        var current = 0x0FFF;
        expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBe(current);
        for (var i = 1; i <= 4; i++) {
            tick(expectedTime * 0.25);
            current = (0x0FFF * (1.0 - i * 0.25)) | 0;
            expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBe(current);
        }
    });
    it('Counter Reload', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        var start = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(start).toBe(0x0FFF);
        tick(1000);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(counter).toBeLessThan(start);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xE51A);
        tick(10);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0xA35C);
        tick(10);
        var reloaded = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        expect(reloaded).toBeGreaterThan(counter);
    });
    it('Invalid Key Value', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        expect(service.RaisedEvents.length).toBe(0);
        tick(1000);
        expect(service.RaisedEvents.length).toBe(0);
        watchdog.Write(8, ARM.Simulator.DataType.Word, 0x12345678);
        tick(10);
        expect(service.RaisedEvents.length).toBeGreaterThan(0);
        expect(service.RaisedEvents[0][0]).toBe('Watchdog.Reset');
    });
    it('Cannot be disabled', function () {
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x0FFF);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0xACED5312);
        tick(10);
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        watchdog.Write(0, ARM.Simulator.DataType.Word, 0x5312ACED);
        var counter = watchdog.Read(0x0C, ARM.Simulator.DataType.Word);
        tick(10);
        expect(watchdog.Read(0, ARM.Simulator.DataType.Word)).toBe(0xACED5312);
        expect(watchdog.Read(0x0C, ARM.Simulator.DataType.Word)).toBeLessThan(counter);
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
        watchdog.Write(4, ARM.Simulator.DataType.Word, 0x1234);
        tick(10);
        expect(watchdog.Read(4, ARM.Simulator.DataType.Word)).toBe(0x0FFF);
    });
});
//# sourceMappingURL=Test.Watchdog.js.map