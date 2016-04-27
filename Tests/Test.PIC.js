describe('PIC Tests', function () {
    var pic;
    var service;
    var irq = null;
    var fiq = null;
    var clockRate = 58.9824;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        pic = new ARM.Simulator.Devices.PIC(0, function (active) {
            if (irq != null)
                irq(active);
        }, function (active) {
            if (fiq != null)
                fiq(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(pic.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        irq = null;
        fiq = null;
        pic.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x00000000],
            [0x04, 0x00000000],
            [0x08, 0x003FFFFF],
            [0x0C, 0x03020100],
            [0x10, 0x07060504],
            [0x14, 0x0B0A0908],
            [0x18, 0x0F0E0D0C],
            [0x1C, 0x13121110],
            [0x20, 0x00000014],
            [0x24, 0x00000054],
            [0x28, 0x00000000],
            [0x30, 0x00000054],
            [0x34, 0x00000054],
        ];
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
            var value = pic.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
});
//# sourceMappingURL=Test.PIC.js.map