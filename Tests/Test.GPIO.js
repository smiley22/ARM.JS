describe('GPIO Tests', function () {
    var gpio;
    var service;
    var read = null;
    var write = null;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        gpio = new ARM.Simulator.Devices.GPIO(0, 2, function (p) {
            if (read)
                return read(p);
            return 0;
        }, function (p, v, s, c, d) {
            if (write)
                write(p, v, s, c, d);
        });
        service = new ARM.Simulator.Tests.MockService();
        expect(gpio.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        read = null;
        write = null;
        gpio.OnUnregister();
    });
    it('Reset Values', function () {
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        value = gpio.Read(0x14, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
    });
    it('Read from I/O port', function () {
        var ports = [0x12345678, 0x87654321];
        read = function (p) {
            return ports[p];
        };
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[0]);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[1]);
    });
    it('Write to I/O port', function () {
        var ports = [0, 0];
        write = function (p, v, s, c, d) {
            if (s)
                ports[p] |= v;
            if (c)
                ports[p] &= v;
        };
        read = function (p) {
            return ports[p];
        };
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x00, ARM.Simulator.DataType.Word, 0x12345678);
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x10, ARM.Simulator.DataType.Word, 0x44444444);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x44444444);
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
    });
    it('Set Pin Direction', function () {
        var m = 0x407001;
        var clear = false;
        write = function (p, v, s, c, d) {
            if (!clear) {
                expect(s).toBe(true);
                expect(c).toBe(false);
                expect(d).toBe(m);
            }
            else {
                expect(s).toBe(false);
                expect(c).toBe(true);
                expect(v).toBe(0);
            }
        };
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x04, ARM.Simulator.DataType.Word, m);
        value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(m);
        gpio.Write(0x08, ARM.Simulator.DataType.Word, m);
        clear = true;
        gpio.Write(0x0C, ARM.Simulator.DataType.Word, ~0);
    });
});
//# sourceMappingURL=Test.GPIO.js.map