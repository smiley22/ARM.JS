describe('DS1307 Tests', function () {
    var rtc;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        rtc = new ARM.Simulator.Devices.DS1307(0, new Date());
        service = new ARM.Simulator.Tests.MockService();
        expect(rtc.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        rtc.OnUnregister();
    });
    var tick = function (ms) {
        jasmine.clock().tick(ms);
    };
    var expectEvent = function (event, properties, numTimes) {
        if (properties === void 0) { properties = null; }
        if (numTimes === void 0) { numTimes = 1; }
        for (var i = 0; i < numTimes; i++) {
            expect(service.RaisedEvents.length).toBeGreaterThan(0);
            var ev = service.RaisedEvents.pop();
            expect(ev[0]).toBe(event);
            if (properties != null) {
                for (var key in properties) {
                    if (!properties.hasOwnProperty(key))
                        continue;
                    expect(ev[1][key]).toBeDefined();
                    expect(ev[1][key]).toBe(properties[key]);
                }
            }
        }
    };
    it('BCD Conversion', function () {
        var pairs = [
            [23, 0x23],
            [18, 0x18],
            [0, 0x00],
            [9, 0x09],
            [10, 0x10]
        ];
        for (var _i = 0, pairs_1 = pairs; _i < pairs_1.length; _i++) {
            var p = pairs_1[_i];
            expect(ARM.Simulator.Devices.DS1307.ToBCD(p[0])).toBe(p[1]);
            expect(ARM.Simulator.Devices.DS1307.FromBCD(p[1])).toBe(p[0]);
        }
    });
    it('Tick Tock', function () {
        expect(service.RaisedEvents.length).toBe(0);
        tick(5210);
        expectEvent('DS1307.Tick', null, 5);
    });
    it('Oscillator Enable/Disable', function () {
        expect(service.RaisedEvents.length).toBe(0);
        tick(43284);
        expectEvent('DS1307.Tick', null, 43);
        var secondsRegister = rtc.Read(0, ARM.Simulator.DataType.Byte);
        secondsRegister |= (1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        expectEvent('DS1307.DataWrite');
        expect(service.RaisedEvents.length).toBe(0);
        tick(67801);
        expect(service.RaisedEvents.length).toBe(0);
        secondsRegister &= ~(1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        tick(92549);
        expectEvent('DS1307.Tick', null, 92);
        expectEvent('DS1307.DataWrite');
    });
    it('Set/Get Time', function () {
        var values = [
            0x00,
            0x24,
            0x03,
            0x05,
            0x17,
            0x12,
            0x15
        ];
        for (var i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        tick(1000 * 60 * 60 * 36);
        var expected = [0x00, 0x24, 0x15, 0x06, 0x18, 0x12, 0x15];
        for (var i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);
    });
    it('12-Hour Mode', function () {
        var values = [
            0x12,
            0x51,
            0x02 | (1 << 6) | (1 << 5),
            0x01,
            0x28,
            0x09,
            0x14
        ];
        for (var i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        tick(1000 * 60 * 60 * 20);
        var expected = [0x12, 0x51,
            0x10 | (1 << 6),
            0x02, 0x29, 0x09, 0x14];
        for (var i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);
        tick(1000 * 60 * 60 * 2);
        var expectedHours = 0x12 | (1 << 6) | (1 << 5);
        expect(rtc.Read(2, ARM.Simulator.DataType.Byte)).toBe(expectedHours);
    });
});
//# sourceMappingURL=Test.DS1307.js.map